// Copia los esquemas zod generados desde openapi.json (L-23) y las reglas entre campos de
// forward-system a libs/validations/generated y escribe validaciones.hash (C-010, L-26). Lee con
// `git show`. Repo en FORWARD_SYSTEM_REPO (default ../fs-combo); ref en FORWARD_SYSTEM_REF
// (default origin/main, con fetch previo).
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { hashDe, VALIDACIONES } = require('./reglas-hash');
const { fuente, destino, copiados: COPIADOS, cuitReexport: CUIT_REEXPORT } = VALIDACIONES;

const repo = process.env.FORWARD_SYSTEM_REPO || path.join('..', 'fs-combo');
const ref = process.env.FORWARD_SYSTEM_REF || 'origin/main';

function git(args) {
  const r = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    console.error(`git ${args.join(' ')} failed in ${repo}:\n${r.stderr}`);
    process.exit(2);
  }
  return r.stdout;
}

if (ref.startsWith('origin/')) git(['fetch', '-q', 'origin', ref.slice('origin/'.length)]);
const sha = git(['rev-parse', '--short', ref]).trim();
const contenidos = new Map(COPIADOS.map((rel) => [rel, git(['show', `${ref}:${fuente}/${rel}`])]));
contenidos.set('cuit.ts', CUIT_REEXPORT);

fs.rmSync(destino, { recursive: true, force: true });
for (const [rel, texto] of contenidos) {
  const out = path.join(destino, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, texto.replace(/\r\n/g, '\n'));
}
const hash = hashDe([...contenidos.keys()], (rel) => contenidos.get(rel));
fs.writeFileSync(path.join(destino, 'validaciones.hash'), hash + '\n');
console.log(`${destino} copiado de forward-system ${ref} (${sha}): ${contenidos.size} archivos, sha256 ${hash}.`);
