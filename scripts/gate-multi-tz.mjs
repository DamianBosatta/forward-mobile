#!/usr/bin/env node
/**
 * Gate multi-huso (L-31, C-014): corre las suites de fechas dos veces, con TZ=UTC y con
 * TZ=America/Argentina/Buenos_Aires. Falla si cualquiera de las dos falla.
 * Espejo de forward-frontend/scripts/gate-multi-tz.mjs, adaptado a jest. `npm run gate:multi-tz`.
 *
 * TZ va por el env del proceso hijo (no por sintaxis de shell) para que funcione en Windows.
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)))
const ZONAS = ['UTC', 'America/Argentina/Buenos_Aires']

// Suites sensibles al huso: utilidades de fecha, día de negocio en ventas y fechas de compras.
const SUITES = [
  'src/utils/__tests__/date.test.ts',
  'src/features/ventas/hooks/__tests__/useVentasList.mes.test.ts',
  'src/features/ventas/__tests__/lib/diaArgentina.test.ts',
  'src/features/compras/__tests__/recepcion.test.ts',
]

const jest = join(RAIZ, 'node_modules', 'jest', 'bin', 'jest.js')
const fallas = []

for (const tz of ZONAS) {
  console.log(`\nGate multi-huso: TZ=${tz}\n`)
  const r = spawnSync(process.execPath, [jest, '--forceExit', '--runTestsByPath', ...SUITES], {
    cwd: RAIZ,
    stdio: 'inherit',
    env: { ...process.env, TZ: tz },
  })
  if (r.status !== 0) fallas.push(tz)
}

if (fallas.length > 0) {
  console.error(`\nGate multi-huso: FALLÓ con TZ=${fallas.join(', ')}`)
  process.exit(1)
}
console.log('\nGate multi-huso: verde en todas las zonas.')
