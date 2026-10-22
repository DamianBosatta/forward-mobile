// Arma libs/api-client/generated/codigos-error.ts desde Forward-Api/errores.json (el catálogo de
// errores del backend, C-007). Lo comparten generate-codigos-error.js (escribe) y check-types.js
// (verifica la copia commiteada). Mismo formato que forward-frontend/scripts/generar-codigos-error.mjs.
function renderCodigosError(errores) {
  if (!Array.isArray(errores) || errores.length === 0) throw new Error('errores.json no tiene errores')
  const filas = errores
    .slice()
    .sort((a, b) => (a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0))
    .map((e) => `  ${e.codigo}: { status: ${Number(e.status)}, mensaje: ${JSON.stringify(e.mensaje)} },`)
  return `/**
 * Generado desde Forward-Api/errores.json (el catálogo de errores del backend, C-007) por
 * scripts/generate-codigos-error.js. No editar a mano: \`npm run generate:errores\`.
 */

/** Cada código estable que puede traer \`ApiError.codigo\`, con su status y su mensaje por defecto. */
export const CATALOGO_DE_ERRORES = {
${filas.join('\n')}
} as const

/** Un código del catálogo de errores del backend. */
export type CodigoError = keyof typeof CATALOGO_DE_ERRORES
`
}

module.exports = { renderCodigosError }
