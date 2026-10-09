import "server-only";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

/**
 * Slack: una app interna con un bot token, invitada a los canales donde publica.
 * Configuración paso a paso y manifiesto de la app: docs/integraciones/slack.md (estado: preparado, sin conectar).
 * Variables: SLACK_BOT_TOKEN; opcionales SLACK_DEFAULT_CHANNEL, SLACK_CHANNELS (sugeridos) y
 * SLACK_NATIVE_SCHEDULE=1 (programar en Slack mismo, así publica aunque la app esté cerrada).
 */
export const slackStatus = () => ({
  connected: Boolean(process.env.SLACK_BOT_TOKEN),
  defaultChannel: process.env.SLACK_DEFAULT_CHANNEL ?? null,
  nativeSchedule: process.env.SLACK_NATIVE_SCHEDULE === "1",
});

async function call<T>(method: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(30_000),
  });
  const data = (await res.json()) as { ok: boolean; error?: string } & T;
  if (!data.ok) throw new Error(`Slack ${method}: ${data.error ?? res.status}`);
  return data;
}

/**
 * Id de un canal a partir de su nombre ("#eventos") o de su id ("C0123ABCD").
 * Requiere los scopes channels:read y groups:read (privados: la app tiene que estar invitada).
 */
export async function resolveChannel(nameOrId: string) {
  if (/^[CG][A-Z0-9]{6,}$/.test(nameOrId)) return nameOrId;
  const name = nameOrId.replace(/^#/, "").toLowerCase();
  let cursor = "";
  do {
    const page = await call<{ channels: { id: string; name: string }[]; response_metadata?: { next_cursor?: string } }>("conversations.list", {
      types: "public_channel,private_channel",
      exclude_archived: "true",
      limit: "1000",
      ...(cursor && { cursor }),
    });
    const hit = page.channels.find((c) => c.name === name);
    if (hit) return hit.id;
    cursor = page.response_metadata?.next_cursor ?? "";
  } while (cursor);
  throw new Error(`No encontré el canal #${name} (¿la app está invitada?)`);
}

/** Sube la imagen a Slack; si se pasa canal, la comparte ahí con el mensaje. */
async function upload(file: string, share?: { channel: string; text: string }) {
  const data = await readFile(file);
  const up = await call<{ upload_url: string; file_id: string }>("files.getUploadURLExternal", {
    filename: basename(file),
    length: String(data.length),
  });
  const put = await fetch(up.upload_url, { method: "POST", body: new Uint8Array(data), signal: AbortSignal.timeout(60_000) });
  if (!put.ok) throw new Error(`Slack: la subida de la imagen falló (${put.status})`);
  const done = await call<{ files?: { id: string; permalink?: string }[] }>("files.completeUploadExternal", {
    files: JSON.stringify([{ id: up.file_id, title: basename(file) }]),
    ...(share && { channel_id: share.channel, initial_comment: share.text }),
  });
  return { id: up.file_id, permalink: done.files?.[0]?.permalink ?? null };
}

/** Publica ya la imagen con el mensaje en el canal (subida externa de archivos, API vigente de Slack). */
export async function publishToSlack({ file, text, channel }: { file: string; text: string; channel?: string | null }) {
  if (!process.env.SLACK_BOT_TOKEN) throw new Error("Slack no está conectado (falta SLACK_BOT_TOKEN)");
  const target = channel || process.env.SLACK_DEFAULT_CHANNEL;
  if (!target) throw new Error("Falta el canal de Slack");
  const result = await upload(file, { channel: await resolveChannel(target), text });
  return { url: result.permalink };
}

/**
 * Programa el mensaje en Slack mismo (chat.scheduleMessage), con la imagen ya subida como bloque.
 * Así Slack lo publica aunque la app esté cerrada. Devuelve una referencia para poder cancelarlo.
 * Sin probar contra un Slack real: se activa con SLACK_NATIVE_SCHEDULE=1 (ver docs/integraciones/slack.md).
 */
export async function scheduleInSlack({ file, text, channel, at }: { file: string; text: string; channel: string; at: Date }) {
  const channelId = await resolveChannel(channel);
  const image = await upload(file);
  const res = await call<{ scheduled_message_id: string }>("chat.scheduleMessage", {
    channel: channelId,
    post_at: String(Math.floor(at.getTime() / 1000)),
    text,
    blocks: JSON.stringify([
      { type: "section", text: { type: "mrkdwn", text } },
      { type: "image", slack_file: { id: image.id }, alt_text: basename(file) },
    ]),
  });
  return { ref: `slack:scheduled:${channelId}:${res.scheduled_message_id}` };
}

/** Cancela un mensaje programado en Slack (referencia devuelta por scheduleInSlack). */
export async function cancelInSlack(ref: string) {
  const [, , channel, id] = ref.split(":");
  await call("chat.deleteScheduledMessage", { channel, scheduled_message_id: id });
}
