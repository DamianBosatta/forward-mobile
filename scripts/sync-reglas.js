// Copia el paquete de reglas compartidas de forward-system a libs/reglas (C-022, D25) y escribe
// libs/reglas/reglas.hash. Lee con `git show`, así que no depende de lo que tenga checkouteado el
// repo local. Repo en FORWARD_SYSTEM_REPO (default ../fs-combo); ref en FORWARD_SYSTEM_REF
// (default origin/main, con fetch previo). No copia los *.test.ts: el test de mobile es propio.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { hashDe, REGLAS_DATOS } = require('./reglas-hash');

const repo = process.env.FORWARD_SYSTEM_REPO || path.join('..', 'fs-combo');
const ref = process.env.FORWARD_SYSTEM_REF || 'origin/main';
const fuente = 'forward-frontend/packages/reglas/src';
const destino = path.join('libs', 'reglas');

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
const archivos = git(['ls-tree', '-r', '--name-only', ref, fuente])
  .split('\n')
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
  .map((f) => f.slice(fuente.length + 1));
if (archivos.length === 0) {
  console.error(`No hay archivos en ${fuente} de ${ref}.`);
  process.exit(2);
}

const contenidos = new Map(archivos.map((rel) => [rel, git(['show', `${ref}:${fuente}/${rel}`])]));
for (const [rel, origen] of Object.entries(REGLAS_DATOS)) contenidos.set(rel, git(['show', `${ref}:${origen}`]));

// Se reemplaza la carpeta entera: un archivo que ya no existe en la fuente no sobrevive.
fs.rmSync(destino, { recursive: true, force: true });
for (const [rel, texto] of contenidos) {
  const out = path.join(destino, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, texto.replace(/\r\n/g, '\n'));
}
const hash = hashDe([...contenidos.keys()], (rel) => contenidos.get(rel));
fs.writeFileSync(path.join(destino, 'reglas.hash'), hash + '\n');
console.log(`libs/reglas copiado de forward-system ${ref} (${sha}): ${contenidos.size} archivos, sha256 ${hash}.`);
