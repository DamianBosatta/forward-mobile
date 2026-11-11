/**
 * Escenarios de cobro compartidos por el formulario de siempre (`RegistrarCobro`) y el cobro en pasos
 * (`CobroEnPasos`): los mismos datos cargados tienen que mandar el mismo cuerpo. `esperado` es el cuerpo que
 * mandaba el formulario antes del cobro en pasos (sin la clave de idempotencia, que es al azar).
 * Quien lo use mockea `@/core/api/client` (api.get, api.post, api.postConSobre).
 */
import { ApiError, api } from '@/core/api/client'
import { formatImporte } from '@/core/ui/fw/formatImporte'
import { diaArgentina } from '@/core/utils/fecha'
import { clienteDeLista, pagina } from '@/features/clientes/__testing__/ayuda'
import { estadoDeCuenta, fichaConCuentas, mov, paginaDeMovimientos } from './servidor'

export const get = api.get as jest.Mock
export const subir = api.post as jest.Mock
export const post = api.postConSobre as jest.Mock
export const ESPERA = { timeout: 5000 }

export const MEDIOS = [
  { id: 'm-ef', nombre: 'Efectivo', requiereCaja: true, esCheque: false, activo: true },
  { id: 'm-tr', nombre: 'Transferencia', requiereCaja: false, esCheque: false, activo: true, cuentaPropiaDefaultId: 'cp-galicia' },
  { id: 'm-ch', nombre: 'Cheque', requiereCaja: false, esCheque: true, activo: true },
]
const cp = (id: string, nombre: string, extra: object = {}) =>
  ({ id, nombre, moneda: 'ARS', esPrincipal: false, esCuentaCajaEfectivo: false, esCuentaCarteraCheques: false, ...extra })
const PARA_COBRAR = [cp('cp-galicia', 'Galicia'), cp('cp-mp', 'Mercado Pago'), cp('cp-caja', 'Caja central', { esCuentaCajaEfectivo: true })]
export const PENDIENTES = [
  { documentoId: 'v-409', codigoPedido: 'A00409', fecha: '2026-10-01T12:00:00Z', total: 50000, saldoPendiente: 50000, tipoCuenta: 'Tst', tipo: 'Venta' },
  { documentoId: 'v-410', codigoPedido: 'A00410', fecha: '2026-10-05T12:00:00Z', total: 40000, saldoPendiente: 30000, tipoCuenta: 'Tst', tipo: 'Venta' },
]
export const UNA_CAJA = [{ depositoId: 'dep-a', depositoNombre: 'Caja A' }]
export const DOS_CAJAS = [{ depositoId: 'dep-a', depositoNombre: 'Caja A' }, { depositoId: 'dep-b', depositoNombre: 'Caja B' }]

export function servidor(cajas: unknown = UNA_CAJA) {
  get.mockImplementation(async (url: string) => {
    if (url === '/api/v1/gastos/medios-pago') return MEDIOS
    if (url === '/api/v1/Cajas/abiertas/estado') { if (cajas instanceof Error) throw cajas; return cajas }
    if (url === '/api/v1/cuentas-corrientes/propias/para-cobrar') return PARA_COBRAR
    if (url.startsWith('/api/v1/deudas/socios/c1/pendientes')) return PENDIENTES
    if (url.startsWith('/api/v1/socios-comerciales?')) return { ...pagina([clienteDeLista()], 1), saldoTotal: 186420 }
    if (url.startsWith('/api/v1/Pagos/')) throw new ApiError(404, 'No encontrado')
    if (url.endsWith('/estado-cuenta')) return estadoDeCuenta({ deudaVencida: 50000, tieneDeudaVencida: true })
    if (url.includes('/movimientos')) return paginaDeMovimientos([mov('m1', '2026-10-11T14:00:00Z', { haber: 50000, pagoId: 'p1' })])
    return fichaConCuentas()
  })
}
export const ok = (sobre: object = {}) => ({ data: 'p1', sobre: { statusCode: 200, succeeded: true, data: 'p1', tipoCuenta: 'Tst', ...sobre } })
export const otroCuerpo = () => Object.assign(new ApiError(409, 'Este cobro ya se había registrado antes con otros datos.'), { codigo: 'ClaveIdempotenciaConOtroCuerpo', data: 'p9' })
export const deOtroSocio = () => Object.assign(new ApiError(409, 'Esta clave de idempotencia ya se usó en otra operación.'), { codigo: 'ClaveIdempotenciaConOtroCuerpo', data: '00000000-0000-0000-0000-000000000000' })
export const sinRed = () => new ApiError(0, 'Sin conexión')
/** La foto subida: `POST /Media/upload-…` devuelve su URL. */
export const urlDeFoto = (url: string) => ({ url: `https://r2.forward/${url.split('/').pop()}/foto.jpg` })

export type Linea = { medio: string; monto: string; caja?: string; cuenta?: string; foto?: boolean; cheque?: { numero: string; banco: string; titular: string } }
export type Escenario = { nombre: string; cajas?: unknown; lineas: Linea[]; imputar?: [string, string | null][]; referencia?: string; esperado: Record<string, unknown> }

/** Las fechas del cheque arrancan en el día argentino de hoy. */
const HOY_ISO = diaArgentina(Date.now())

export const ESCENARIOS: Escenario[] = [
  {
    nombre: 'efectivo con una caja abierta',
    lineas: [{ medio: 'Efectivo', monto: '30.000' }],
    esperado: { socioComercialId: 'c1', depositoId: 'dep-a', lineas: [{ medioPagoId: 'm-ef', monto: 30000 }] },
  },
  {
    nombre: 'efectivo con dos cajas, elegida la B',
    cajas: DOS_CAJAS,
    lineas: [{ medio: 'Efectivo', monto: '30.000', caja: 'Caja B' }],
    esperado: { socioComercialId: 'c1', depositoId: 'dep-b', lineas: [{ medioPagoId: 'm-ef', monto: 30000 }] },
  },
  {
    nombre: 'transferencia con cuenta, foto y referencia',
    lineas: [{ medio: 'Transferencia', monto: '86.400', cuenta: 'Mercado Pago', foto: true }],
    referencia: 'OP-77',
    esperado: {
      socioComercialId: 'c1',
      referencia: 'OP-77',
      comprobanteUrl: 'https://r2.forward/upload-comprobante/foto.jpg',
      lineas: [{ medioPagoId: 'm-tr', monto: 86400, cuentaPropiaId: 'cp-mp' }],
    },
  },
  {
    nombre: 'transferencia sin cuenta elegida, con centavos',
    lineas: [{ medio: 'Transferencia', monto: '1.234,56' }],
    esperado: { socioComercialId: 'c1', lineas: [{ medioPagoId: 'm-tr', monto: 1234.56 }] },
  },
  {
    nombre: 'cheque con sus datos y su foto',
    lineas: [{ medio: 'Cheque', monto: '50.000', foto: true, cheque: { numero: '00412377', banco: 'Banco Provincia', titular: 'Graciela Ruiz' } }],
    esperado: {
      socioComercialId: 'c1',
      lineas: [{
        medioPagoId: 'm-ch',
        monto: 50000,
        chequesRecibidos: [{
          numero: '00412377', banco: 'Banco Provincia', titular: 'Graciela Ruiz', fechaEmision: HOY_ISO, fechaPago: HOY_ISO, monto: 50000,
          imagenUrl: 'https://r2.forward/upload-cheque/foto.jpg',
        }],
      }],
    },
  },
  {
    nombre: 'combinado: efectivo y transferencia',
    lineas: [{ medio: 'Efectivo', monto: '30.000' }, { medio: 'Transferencia', monto: '20.000' }],
    esperado: { socioComercialId: 'c1', depositoId: 'dep-a', lineas: [{ medioPagoId: 'm-ef', monto: 30000 }, { medioPagoId: 'm-tr', monto: 20000 }] },
  },
  {
    nombre: 'combinado: transferencia con cuenta y efectivo con dos cajas',
    cajas: DOS_CAJAS,
    lineas: [{ medio: 'Transferencia', monto: '10.000', cuenta: 'Galicia' }, { medio: 'Efectivo', monto: '5.000', caja: 'Caja A' }],
    esperado: {
      socioComercialId: 'c1',
      depositoId: 'dep-a',
      lineas: [{ medioPagoId: 'm-tr', monto: 10000, cuentaPropiaId: 'cp-galicia' }, { medioPagoId: 'm-ef', monto: 5000 }],
    },
  },
  {
    nombre: 'imputación manual a dos comprobantes',
    lineas: [{ medio: 'Transferencia', monto: '60.000' }],
    imputar: [[`A00409, pendiente ${formatImporte(50000)}`, null], [`A00410, pendiente ${formatImporte(30000)}`, '10.000']],
    esperado: {
      socioComercialId: 'c1',
      imputaciones: [{ documentoId: 'v-409', monto: 50000 }, { documentoId: 'v-410', monto: 10000 }],
      lineas: [{ medioPagoId: 'm-tr', monto: 60000 }],
    },
  },
]

export const sinClave = (b: Record<string, unknown>) => { const { claveIdempotencia: _clave, ...resto } = b; return resto }
export const claves = () => post.mock.calls.map(c => c[1].claveIdempotencia as string)
