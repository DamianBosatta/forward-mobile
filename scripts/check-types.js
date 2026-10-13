// Fails when libs/api-client/generated/schema.ts differs from the types generated from the
// openapi.json on forward-system's main. Reads the contract with `git show`, so it does not
// depend on what the local forward-system checkout has checked out.
// Repo path from FORWARD_SYSTEM_REPO (default: ../fs-combo); ref from FORWARD_SYSTEM_REF
// (default: origin/main, fetched first).
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repo = process.env.FORWARD_SYSTEM_REPO || path.join('..', 'fs-combo');
const ref = process.env.FORWARD_SYSTEM_REF || 'origin/main';
const committed = path.join('libs', 'api-client', 'generated', 'schema.ts');
const bin = path.join(__dirname, '..', 'node_modules', 'openapi-typescript', 'bin', 'cli.js');

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

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'check-types-'));
try {
  const openapi = path.join(tmp, 'openapi.json');
  const generated = path.join(tmp, 'schema.ts');
  fs.writeFileSync(openapi, git(['show', `${ref}:Forward-Api/openapi.json`]));

  const r = spawnSync(process.execPath, [bin, openapi, '-o', generated], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(r.stderr);
    process.exit(2);
  }

  const normalize = (s) => s.replace(/\r\n/g, '\n');
  if (normalize(fs.readFileSync(generated, 'utf8')) !== normalize(fs.readFileSync(committed, 'utf8'))) {
    console.error(
      `${committed} is out of date with forward-system ${ref} (${sha}).\n` +
        `Regenerate it: OPENAPI_PATH=<forward-system>/Forward-Api/openapi.json npm run generate:types`,
    );
    process.exit(1);
  }
  console.log(`${committed} matches forward-system ${ref} (${sha}).`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
