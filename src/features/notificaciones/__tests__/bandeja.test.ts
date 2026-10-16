/**
 * Qué hace tocar un aviso según su `accion` (`AccionDestino`), para cada destino que emite el
 * servidor (forward-system: `AccionDestino.cs`; los 13 se usan en algún emisor). La tabla de abajo
 * es la decisión escrita: si el contrato suma un destino, el `it.each` sobre el `schema.ts`
 * generado falla hasta que se decida acá.
 */
import { readFileSync } from 'fs'
import { join, resolve } from 'path'
import { cuandoFue, destinoDelAviso } from '../bandeja'
import type { AccionDestino } from '../avisos'

const SCHEMA = readFileSync(join(resolve(__dirname, '../../../..'), 'libs/api-client/generated/schema.ts'), 'utf8')
const DESTINOS = Array.from(
  /\n\s{8}AccionDestino: ((?:"[^"]+"(?: \| )?)+);/.exec(SCHEMA)![1].matchAll(/"([^"]+)"/g),
  (m) => m[1] as AccionDestino,
)

const ESPERADO: Record<AccionDestino, string> = {
  Cheques: '/tesoreria/cheques',
  Venta: '/ventas/id-1',
  VentasPendientesAutorizacion: '/autorizaciones',
  Caja: 'web',
  Socios: '/socios',
  SolicitudesSocio: 'web',
  Importaciones: 'web',
  Picking: '/logistica/pedidos',
  Compra: '/compras/id-1',
  Calendario: '/calendario',
  Inventario: '/inventario',
  ConfiguracionFacturacion: 'web',
  PosicionIva: 'web',
}

describe('destinoDelAviso', () => {
  it('el contrato tiene los 13 destinos que emite el servidor', () => {
    expect(DESTINOS).toHaveLength(13)
  })

  it.each(DESTINOS)('%s: navega a su pantalla de mobile o dice que se abre desde la web', (destino) => {
    const d = destinoDelAviso({ destino, entidadId: 'id-1', etiqueta: 'Ver' })
    expect(ESPERADO[destino]).toBeDefined()
    if (ESPERADO[destino] === 'web') expect(d).toEqual({ tipo: 'web', etiqueta: 'Ver' })
    else expect(d).toEqual({ tipo: 'ruta', ruta: ESPERADO[destino], etiqueta: 'Ver' })
  })

  it('una ficha sin id no navega ni promete la web: no hay adónde ir', () => {
    expect(destinoDelAviso({ destino: 'Venta', entidadId: null, etiqueta: 'Ver venta' })).toEqual({ tipo: 'ninguno' })
  })

  it('un aviso sin acción es solo informativo', () => {
    expect(destinoDelAviso(null)).toEqual({ tipo: 'ninguno' })
    expect(destinoDelAviso(undefined)).toEqual({ tipo: 'ninguno' })
  })

  it('un destino que esta versión no conoce se muestra como de la web, sin navegar', () => {
    expect(destinoDelAviso({ destino: 'Futuro' as AccionDestino, etiqueta: 'Ver' })).toEqual({ tipo: 'web', etiqueta: 'Ver' })
  })
})

describe('cuandoFue', () => {
  // Viernes 16 de octubre de 2026, 15:00 en Argentina.
  const AHORA = Date.parse('2026-10-16T18:00:00Z')

  it('hoy y ayer por su nombre, con la hora argentina', () => {
    expect(cuandoFue('2026-10-16T12:05:00Z', AHORA)).toBe('Hoy 09:05')
    expect(cuandoFue('2026-10-16T02:30:00Z', AHORA)).toBe('Ayer 23:30')
  })

  it('antes de ayer con día y mes', () => {
    expect(cuandoFue('2026-10-02T21:10:00Z', AHORA)).toBe('2/10 18:10')
  })

  it('una fecha sin zona del servidor se lee como UTC', () => {
    expect(cuandoFue('2026-10-16T12:05:00', AHORA)).toBe('Hoy 09:05')
  })

  it('una fecha ilegible no rompe la fila', () => {
    expect(cuandoFue('no-es-fecha', AHORA)).toBe('')
  })
})
