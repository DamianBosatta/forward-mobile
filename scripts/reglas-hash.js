// Hash de la copia de libs/reglas (C-022, D25): SHA-256 sobre la lista ordenada de archivos .ts,
// con ruta relativa (con "/") y contenido con CRLF normalizado a LF. Lo comparten sync-reglas.js
// (escribe libs/reglas/reglas.hash) y check-reglas.js (lo verifica).
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function listar(dir, base = dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? listar(path.join(dir, e.name), base)
        : e.name.endsWith('.ts')
          ? [path.relative(base, path.join(dir, e.name)).split(path.sep).join('/')]
          : [],
    )
    .sort();
}

// `leer(rel)` devuelve el contenido (string) de cada archivo relativo.
function hashDe(archivos, leer) {
  const h = crypto.createHash('sha256');
  for (const rel of [...archivos].sort()) {
    h.update(rel + '\n');
    h.update(leer(rel).replace(/\r\n/g, '\n') + '\n');
  }
  return h.digest('hex');
}

// Qué copian sync-validaciones.js y check-validaciones.js de forward-frontend/packages/validations/src
// a libs/validations/generated (C-010, L-26). COPIADOS va tal cual (CRLF a LF); no se copian index.ts
// (propio de la web) ni los *.test.ts. `reglas/index.ts` importa '../cuit': mobile ya tiene esa regla
// en libs/reglas (X1), así que en vez de una segunda copia se escribe este reexport, que entra al hash.
const VALIDACIONES = {
  fuente: 'forward-frontend/packages/validations/src',
  destino: 'libs/validations/generated',
  copiados: ['generated/esquemas.ts', 'desde-contrato.ts', 'reglas/index.ts'],
  cuitReexport:
    "// Escrito por sync-validaciones.js: la regla del CUIT es la de libs/reglas, no una segunda copia.\n" +
    "export { cuitEsValido } from '../../reglas/cuit';\n",
};

module.exports = { listar, hashDe, VALIDACIONES };
