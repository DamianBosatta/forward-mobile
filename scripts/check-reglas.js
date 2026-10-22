// Gate de las reglas compartidas (C-022, D25): la copia en libs/reglas tiene que ser la que dice
// libs/reglas/reglas.hash y, si forward-system es alcanzable, la que tiene forward-system.
// Repo en FORWARD_SYSTEM_REPO (default ../fs-combo); ref en FORWARD_SYSTEM_REF (default origin/main).
// Si el repo no está, solo verifica la copia contra su hash; con CHECK_REGLAS_EXIGIR_FUENTE=1 eso falla.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { listar, hashDe } = require('./reglas-hash');

const repo = process.env.FORWARD_SYSTEM_REPO || path.join('..', 'fs-combo');
const ref = process.env.FORWARD_SYSTEM_REF || 'origin/main';
const fuente = 'forward-frontend/packages/reglas/src';
const carpeta = path.join('libs', 'reglas');

let fallo = false;
const archivos = listar(carpeta);
const local = hashDe(archivos, (rel) => fs.readFileSync(path.join(carpeta, rel), 'utf8'));
const guardado = fs.readFileSync(path.join(carpeta, 'reglas.hash'), 'utf8').trim();
if (local !== guardado) {
  console.error(
    `libs/reglas fue editada a mano: su hash ${local} no es el de reglas.hash (${guardado}).\n` +
      'Volvé a copiarla: npm run sync:reglas',
  );
  fallo = true;
} else {
  console.log(`libs/reglas coincide con reglas.hash (${guardado.slice(0, 12)}).`);
}

function git(args) {
  return spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}
const existe = fs.existsSync(repo) && git(['rev-parse', '--git-dir']).status === 0;
if (!existe) {
  if (process.env.CHECK_REGLAS_EXIGIR_FUENTE === '1') {
    console.error(`No encuentro forward-system en ${repo} (FORWARD_SYSTEM_REPO).`);
    fallo = true;
  } else {
    console.log(`forward-system no está en ${repo}: solo se verificó la copia contra su hash.`);
  }
} else {
  if (ref.startsWith('origin/')) git(['fetch', '-q', 'origin', ref.slice('origin/'.length)]);
  const lista = git(['ls-tree', '-r', '--name-only', ref, fuente]);
  if (lista.status !== 0) {
    console.error(`git ls-tree falló para ${ref} en ${repo}:\n${lista.stderr}`);
    process.exit(2);
  }
  const rels = lista.stdout
    .split('\n')
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => f.slice(fuente.length + 1));
  const remoto = hashDe(rels, (rel) => git(['show', `${ref}:${fuente}/${rel}`]).stdout);
  if (remoto !== guardado) {
    console.error(`libs/reglas está desactualizada respecto de forward-system ${ref}.\nCopiala de nuevo: npm run sync:reglas`);
    fallo = true;
  } else {
    console.log(`libs/reglas coincide con forward-system ${ref}.`);
  }
}
process.exit(fallo ? 1 : 0);
