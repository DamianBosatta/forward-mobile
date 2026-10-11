// Genera libs/api-client/generated/schema.ts desde el openapi.json de la API.
// Ruta por variable de entorno OPENAPI_PATH (default: ../Forward/Forward-Api/openapi.json).
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const openapi = process.env.OPENAPI_PATH || path.join('..', 'Forward', 'Forward-Api', 'openapi.json');
const bin = path.join(__dirname, '..', 'node_modules', 'openapi-typescript', 'bin', 'cli.js');
const out = path.join('libs', 'api-client', 'generated', 'schema.ts');

const r = spawnSync(process.execPath, [bin, openapi, '-o', out], { stdio: 'inherit' });
process.exit(r.status ?? 1);
