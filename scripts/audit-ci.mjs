#!/usr/bin/env node
/**
 * Corre `npm audit --omit=dev` y falla si hay avisos high o critical, salvo los que figuran en
 * EXCEPCIONES con fecha de vencimiento vigente.
 *
 * `npm audit` no permite ignorar un aviso puntual: sin este script, un aviso nuevo sin parche
 * publicado bloquea todo merge de mobile hasta que el autor del paquete saque una versión.
 *
 * Reglas:
 *   - Cada excepción lleva el id GHSA, el motivo y la fecha en que vence. Aprobada por el dueño.
 *   - Vencida la fecha, el aviso vuelve a frenar: hay que actualizar la dependencia o renovar la
 *     excepción con una nueva aprobación.
 *   - La lista solo se achica (X15).
 */
import { spawnSync } from 'node:child_process'

const UMBRAL = new Set(['high', 'critical'])

/** @type {{ id: string, motivo: string, vence: string }[]} */
const EXCEPCIONES = [
  {
    id: 'GHSA-fc5q-39xc-vjpf',
    motivo:
      'picomatch <=4.0.7 (ReDoS). Sin versión parcheada al 2026-11-17; llega por expo, metro y babel (herramientas de build).',
    vence: '2026-12-17',
  },
]

const hoy = new Date().toISOString().slice(0, 10)

const resultado = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
  stdio: ['ignore', 'pipe', 'pipe'],
  maxBuffer: 64 * 1024 * 1024,
})

let reporte
try {
  reporte = JSON.parse(resultado.stdout)
} catch {
  console.error('[audit:ci] npm audit no devolvió un JSON válido.')
  process.stderr.write(resultado.stderr ?? '')
  process.exit(1)
}

if (reporte.error) {
  console.error(`[audit:ci] npm audit falló: ${reporte.error.summary ?? JSON.stringify(reporte.error)}`)
  process.exit(1)
}

/** Avisos raíz (los objetos de `via`), uno por URL. */
const avisos = new Map()
for (const vulnerabilidad of Object.values(reporte.vulnerabilities ?? {})) {
  for (const via of vulnerabilidad.via) {
    if (typeof via === 'object' && UMBRAL.has(via.severity)) {
      avisos.set(via.url, via)
    }
  }
}

const vigentes = EXCEPCIONES.filter((e) => e.vence >= hoy)
const ignorados = []
const bloqueantes = []
for (const aviso of avisos.values()) {
  const excepcion = vigentes.find((e) => aviso.url.endsWith(e.id))
  ;(excepcion ? ignorados : bloqueantes).push({ aviso, excepcion })
}

for (const { aviso, excepcion } of ignorados) {
  console.warn(`[audit:ci] IGNORADO hasta ${excepcion.vence}: ${aviso.severity} ${aviso.name} ${aviso.url}`)
}

for (const vencida of EXCEPCIONES.filter((e) => e.vence < hoy)) {
  console.warn(`[audit:ci] Excepción VENCIDA el ${vencida.vence}: ${vencida.id}. Ya no se ignora.`)
}

if (bloqueantes.length > 0) {
  for (const { aviso } of bloqueantes) {
    console.error(`[audit:ci] ${aviso.severity} ${aviso.name} ${aviso.range} ${aviso.url}`)
  }
  console.error(`[audit:ci] ${bloqueantes.length} aviso(s) high o critical sin excepción.`)
  process.exit(1)
}

console.log('[audit:ci] Sin avisos high o critical fuera de las excepciones.')
