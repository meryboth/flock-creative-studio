# 07 · Nómina y credenciales

**Fecha:** 2026-10-09 · **Estado:** nómina de ejemplo implementada; conector a SharePoint diseñado.

## El requisito

- **Hoy:** las credenciales y los certificados se generan con **nombres de ejemplo**.
- **A futuro:** la nómina se lee de un **Excel en SharePoint**. El agente toma de ahí los nombres y, como se lee en cada generación, **cada evento nuevo trae a los flockers vigentes** sin cargar nada a mano.

## Diseño

```
RosterSource ──► loadRoster() ──► snapshot en el evento (tabla attendees + events.roster)
  mock               (al generar)        { source, fetchedAt }
  csv
  sharepoint-excel
```

- **`RosterSource`** (`packages/studio/src/roster.ts`) es la interfaz de una fuente de nómina:
  - `mock`: la nómina ficticia de `data/nomina-ejemplo.csv`;
  - `csv`: pegada o subida a mano;
  - `sharepoint-excel`: un link compartido a un Excel.
- **Se lee al generar** y se guarda como **snapshot** en el evento. Así se cumplen las dos cosas: los eventos nuevos traen la nómina actualizada, y las piezas de un evento ya generado no cambian si después alguien entra o se va.
- La página del evento avisa cuándo las credenciales usan la nómina de ejemplo.

## Conector a SharePoint (próximo)

1. **Acceso:** una app registrada en Microsoft Entra ID con permiso de solo lectura sobre archivos (`Files.Read.All` o, mejor, `Sites.Selected` limitado al sitio de la nómina). Requiere aprobación de IT.
2. **Lectura:** el link compartido se codifica como `shareId` (`u!` + base64url del link) y se pide `GET /shares/{shareId}/driveItem/content` a Microsoft Graph, que devuelve el `.xlsx`.
3. **Mapeo:** se lee la hoja indicada y se mapean las columnas (nombre, apellido, área, rol) con el mismo parser tolerante que ya acepta encabezados en español o inglés.
4. **Configuración:** el link y la hoja se guardan una vez (configuración de la organización, no por evento), y cada evento puede filtrar por área o sede.

**Alternativa sin Graph:** si el archivo se comparte con un link de descarga anónima, alcanza con un `fetch` del link con `?download=1`. Es más simple, pero expone la nómina a cualquiera con el link; no se recomienda para datos de personas.

**Privacidad:** la nómina es información personal. Se guardan solo los campos necesarios para las piezas (nombre, apellido, área y rol), y el snapshot vive en la base local.
