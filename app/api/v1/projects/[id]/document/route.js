import { route, json, parseId, readLimited, maxDocBytes } from '../../../../../../src/http/api.js';
import { unauthorized, unsupportedMedia } from '../../../../../../src/projects/errors.js';

// La interfaz envía el nombre con encodeURIComponent (los encabezados no admiten tildes).
const decodeName = (v) => { try { return decodeURIComponent(v ?? ''); } catch { return v ?? ''; } };

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PUT /api/v1/projects/:id/document — sube o reemplaza el PDF de soporte (RN-17)
export const PUT = route(async ({ service, user, params, request }) => {
  if (!user) throw unauthorized();
  const id = parseId(params.id);
  const type = String(request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/pdf') throw unsupportedMedia('Content-Type debe ser application/pdf');
  const max = maxDocBytes();
  const contenido = await readLimited(request, max);
  const meta = await service.attachDocument(
    user, id, { contenido, nombreArchivo: decodeName(request.headers.get('x-filename')) }, { maxBytes: max },
  );
  return json(200, { data: meta });
});

// GET /api/v1/projects/:id/document — descarga (cualquier usuario autenticado que vea el proyecto)
export const GET = route(async ({ service, user, params }) => {
  const doc = await service.getDocument(user, parseId(params.id));
  return new Response(doc.contenido, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(doc.contenido.length),
      'Content-Disposition': `inline; filename="${doc.nombreArchivo}"`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

// DELETE /api/v1/projects/:id/document — elimina el PDF (autor o administrador)
export const DELETE = route(async ({ service, user, params }) =>
  json(200, { data: await service.removeDocument(user, parseId(params.id)) }));
