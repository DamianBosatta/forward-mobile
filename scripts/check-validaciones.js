// Gate de los esquemas generados (C-010, L-26): libs/validations/generated tiene que ser la que dice
// validaciones.hash y, si forward-system es alcanzable, la que tiene forward-system.
// Repo en FORWARD_SYSTEM_REPO (default ../fs-combo); ref en FORWARD_SYSTEM_REF (default origin/main).
// Sin el repo solo verifica la copia contra su hash; con CHECK_VALIDACIONES_EXIGIR_FUENTE=1 falla.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { listar, hashDe, VALIDACIONES } = require('./reglas-hash');
const { fuente, destino, copiados: COPIADOS, cuitReexport: CUIT_REEXPORT } = VALIDACIONES;

const repo = process.env.FORWARD_SYSTEM_REPO || path.join('..', 'fs-combo');
const ref = process.env.FORWARD_SYSTEM_REF || 'origin/main';

let fallo = false;
const archivos = listar(destino);
const local = hashDe(archivos, (rel) => fs.readFileSync(path.join(destino, rel), 'utf8'));
const guardado = fs.readFileSync(path.join(destino, 'validaciones.hash'), 'utf8').trim();
if (local !== guardado) {
  console.error(
    `${destino} fue editada a mano: su hash ${local} no es el de validaciones.hash (${guardado}).\n` +
      'Volvé a copiarla: npm run sync:validaciones',
  );
  fallo = true;
} else {
  console.log(`${destino} coincide con validaciones.hash (${guardado.slice(0, 12)}).`);
}

function git(args) {
  return spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}
const existe = fs.existsSync(repo) && git(['rev-parse', '--git-dir']).status === 0;
if (!existe) {
  if (process.env.CHECK_VALIDACIONES_EXIGIR_FUENTE === '1') {
    console.error(`No encuentro forward-system en ${repo} (FORWARD_SYSTEM_REPO).`);
    fallo = true;
  } else {
    console.log(`forward-system no está en ${repo}: solo se verificó la copia contra su hash.`);
  }
} else {
  if (ref.startsWith('origin/')) git(['fetch', '-q', 'origin', ref.slice('origin/'.length)]);
  const remotos = new Map();
  for (const rel of COPIADOS) {
    const r = git(['show', `${ref}:${fuente}/${rel}`]);
    if (r.status !== 0) {
      console.error(`git show ${ref}:${fuente}/${rel} falló en ${repo}:\n${r.stderr}`);
      process.exit(2);
    }
    remotos.set(rel, r.stdout);
  }
  remotos.set('cuit.ts', CUIT_REEXPORT);
  const remoto = hashDe([...remotos.keys()], (rel) => remotos.get(rel));
  if (remoto !== guardado) {
    console.error(`${destino} está desactualizada respecto de forward-system ${ref}.\nCopiala de nuevo: npm run sync:validaciones`);
    fallo = true;
  } else {
    console.log(`${destino} coincide con forward-system ${ref}.`);
  }
}
process.exit(fallo ? 1 : 0);
