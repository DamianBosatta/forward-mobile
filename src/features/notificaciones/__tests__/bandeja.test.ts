/**
 * Qué hace tocar un aviso según su `accion` (`AccionDestino`), para cada destino que emite el
 * servidor (forward-system: `AccionDestino.cs`; los 13 se usan en algún emisor). La tabla de abajo
 * es la decisión escrita: si el contrato suma un destino, el `it.each` sobre el `schema.ts`
 * generado falla hasta que se decida acá.
 */
import { readFileSync } from 'fs'
import { join, resolve } from 'path'
import { conEncabezadosDeDia, cuandoFue, destinoDelAviso, horaDelAviso } from '../bandeja'
import type { AccionDestino } from '../avisos'

const SCHEMA = readFileSync(join(resolve(__dirname, '../../../..'), 'libs/api-client/generated/schema.ts'), 'utf8')
const DESTINOS = Array.from(
  /\n\s{8}AccionDestino: ((?:"[^"]+"(?: \| )?)+);/.exec(SCHEMA)![1].matchAll(/"([^"]+)"/g),
  (m) => m[1] as AccionDestino,
)

const ESPERADO: Record<AccionDestino, string> = {
  Cheques: 'web',
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

describe('conEncabezadosDeDia', () => {
  // Viernes 16 de octubre de 2026, 15:00 en Argentina.
  const AHORA = Date.parse('2026-10-16T18:00:00Z')
  const a = (id: string, fechaCreacion: string) => ({ id, fechaCreacion })

  it('un encabezado por día argentino: hoy, ayer y los demás con su fecha', () => {
    const filas = conEncabezadosDeDia(
      [a('1', '2026-10-16T12:05:00Z'), a('2', '2026-10-16T11:00:00Z'), a('3', '2026-10-16T02:30:00Z'), a('4', '2026-10-13T15:00:00Z')],
      AHORA,
    )
    expect(filas.map((f) => (f.tipo === 'dia' ? f.titulo : f.clave))).toEqual([
      'HOY · VIERNES 16/10', '1', '2', 'AYER · JUEVES 15/10', '3', 'MARTES 13/10', '4',
    ])
  })

  it('la hora del aviso es la argentina, sin el día', () => {
    expect(horaDelAviso('2026-10-16T02:30:00Z')).toBe('23:30')
    expect(horaDelAviso('no es una fecha')).toBe('')
  })
})
