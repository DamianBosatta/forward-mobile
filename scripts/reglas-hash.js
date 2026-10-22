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

module.exports = { listar, hashDe };
