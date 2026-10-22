// Genera libs/api-client/generated/codigos-error.ts desde el errores.json de la API.
// Ruta por variable de entorno ERRORES_PATH (default: ../Forward/Forward-Api/errores.json).
const fs = require('node:fs')
const path = require('node:path')
const { renderCodigosError } = require('./codigos-error')

const entrada = process.env.ERRORES_PATH || path.join('..', 'Forward', 'Forward-Api', 'errores.json')
const salida = path.join('libs', 'api-client', 'generated', 'codigos-error.ts')

const errores = JSON.parse(fs.readFileSync(entrada, 'utf8'))
fs.writeFileSync(salida, renderCodigosError(errores), 'utf8')
console.log(`[codigos-error] ${errores.length} códigos → ${salida}`)
