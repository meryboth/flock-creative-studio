import "server-only";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

/**
 * Slack: una app interna con un bot token (scopes files:write y chat:write) invitada al canal.
 * Variables: SLACK_BOT_TOKEN y, opcional, SLACK_DEFAULT_CHANNEL (id del canal, ej. C0123ABCD).
 */
export const slackStatus = () => ({
  connected: Boolean(process.env.SLACK_BOT_TOKEN),
  defaultChannel: process.env.SLACK_DEFAULT_CHANNEL ?? null,
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

/** Publica la imagen con el mensaje en el canal (subida externa de archivos, API vigente de Slack). */
export async function publishToSlack({ file, text, channel }: { file: string; text: string; channel?: string | null }) {
  if (!process.env.SLACK_BOT_TOKEN) throw new Error("Slack no está conectado (falta SLACK_BOT_TOKEN)");
  const channelId = channel || process.env.SLACK_DEFAULT_CHANNEL;
  if (!channelId) throw new Error("Falta el canal de Slack");
  const data = await readFile(file);
  const upload = await call<{ upload_url: string; file_id: string }>("files.getUploadURLExternal", {
    filename: basename(file),
    length: String(data.length),
  });
  const put = await fetch(upload.upload_url, { method: "POST", body: new Uint8Array(data), signal: AbortSignal.timeout(60_000) });
  if (!put.ok) throw new Error(`Slack: la subida de la imagen falló (${put.status})`);
  const done = await call<{ files?: { permalink?: string }[] }>("files.completeUploadExternal", {
    files: JSON.stringify([{ id: upload.file_id, title: basename(file) }]),
    channel_id: channelId,
    initial_comment: text,
  });
  return { url: done.files?.[0]?.permalink ?? null };
}
