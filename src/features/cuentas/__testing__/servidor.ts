import type { MovimientoCuentaDto, MovimientoSocioDto, MovimientoSocioDtoPaginatedResponse } from '@/libs/api-client/types'
import { clienteDeLista, pagina } from '@/features/clientes/__testing__/ayuda'

/** Ficha del cliente como la manda el servidor: cuenta TST `cTst`, cuenta Normal `cNor`. */
export const fichaConCuentas = (extra: object = {}) => ({
  ...clienteDeLista(),
  condicionesDeCompraFaltantes: [],
  topeCredito: 300000,
  cuentaId: 'cTst',
  cuentaNormalId: 'cNor',
  ...extra,
})

export const estadoDeCuenta = (extra: object = {}) => ({
  socioComercialId: 'c1',
  razonSocial: 'Graciela Ruiz',
  saldoActual: 186420,
  saldoTst: 132020,
  saldoNormal: 54400,
  saldoAFavor: 0,
  movimientosPendientes: [],
  ...extra,
})

export const mov = (id: string, fecha: string, extra: Partial<MovimientoCuentaDto> = {}): MovimientoCuentaDto => ({
  id,
  fecha,
  referencia: `Mov ${id}`,
  debe: 0,
  haber: 0,
  saldoHistorico: 0,
  ...extra,
})

/** Respuesta de GET /cuentas-corrientes/{id}/movimientos. */
export const paginaDeMovimientos = (items: MovimientoCuentaDto[], page = 1, totalPages = 1) => ({
  cuentaId: 'x',
  nombre: 'x',
  saldoActual: 0,
  activo: true,
  movimientos: { ...pagina(items, items.length), page, totalPages, hasNextPage: page < totalPages },
})

/** Un asiento como lo manda GET /cuentas-corrientes/socios/{id}/movimientos (forward-system #905). */
export const movSocio = (id: string, fecha: string, extra: Partial<MovimientoSocioDto> = {}): MovimientoSocioDto => ({
  id,
  fecha,
  tipo: 'Deuda',
  cuenta: 'Tst',
  referencia: `Mov ${id}`,
  debe: 0,
  haber: 0,
  saldoHistorico: 0,
  imputadoA: [],
  ...extra,
})

/** Página de GET /cuentas-corrientes/socios/{id}/movimientos. */
export const paginaDeMovimientosSocio = (items: MovimientoSocioDto[], page = 1, totalPages = 1): MovimientoSocioDtoPaginatedResponse => ({
  items,
  page,
  pageSize: 20,
  totalCount: items.length,
  totalPages,
  hasNextPage: page < totalPages,
})

/** El 404 de un servidor que todavía no tiene el endpoint (mismo `status` que el ApiError del cliente). */
export const noEncontrado = () => Object.assign(new Error('El recurso solicitado no existe.'), { status: 404 })
