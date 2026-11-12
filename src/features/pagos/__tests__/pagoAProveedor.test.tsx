import React from 'react'
import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import PagarRoute from '@/app/(tabs)/tesoreria/pagos/pagar'
import CuentasCorrientesScreen from '../../../../app/(tabs)/cuentas/index'
import { api } from '@/core/api/client'
import { formatImporte } from '@/core/ui/fw'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { AVISO_IMPUTACION_PAGO } from '@/features/cuentas/lib/contraparte'
import { clienteDeLista, conPermisos, pagina, renderConQuery } from '@/features/clientes/__testing__/ayuda'
import { cajaActivaDe } from '@/features/cuentas/__testing__/servidor'

let mockParams: Record<string, string | undefined> = {}
const mockPush = jest.fn()
const mockBack = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}))
jest.mock('@/core/ui/fw/useMenuLeading', () => ({ useMenuLeading: () => undefined }))
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: 390, isTablet: false, isTabletLandscape: false }) }))
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: jest.fn(), post: jest.fn(), postConSobre: jest.fn() },
  API_URL: '',
}))

const get = api.get as jest.Mock
const post = api.postConSobre as jest.Mock
const ESPERA = { timeout: 5000 }
jest.setTimeout(20_000)
const $ = (n: number) => formatImporte(n)
const MEDIOS = [
  { id: 'm-ef', nombre: 'Efectivo', requiereCaja: true, esCheque: false, activo: true },
  { id: 'm-tr', nombre: 'Transferencia', requiereCaja: false, esCheque: false, activo: true },
  { id: 'm-ch', nombre: 'Cheque', requiereCaja: false, esCheque: true, activo: true },
]
const PROVEEDOR = clienteDeLista({ id: 'p1', razonSocial: 'Molinos SA', tipo: 'Proveedor', nombreFantasia: '', direccion: 'Ruta 8 km 40', displayName: 'Molinos SA' })
const PENDIENTES = [{ documentoId: 'd1', numeroFactura: 'C-00031', fecha: '2026-10-01T00:00:00Z', total: 80000, saldoPendiente: 80000, tipoCuenta: 'Normal' }]

beforeEach(() => {
  jest.clearAllMocks()
  mockParams = { socioId: 'p1' }
  conPermisos([{ module: 'MOD_PAGOS', canRead: true, canCreate: true }, { module: 'CAP_VER_TESORERIA', canRead: true }])
  get.mockImplementation(async (url: string) => {
    if (url === '/api/v1/gastos/medios-pago') return MEDIOS
    if (url.startsWith('/api/v1/Cajas/activa')) return cajaActivaDe(url, 'Caja del depósito')
    if (url.startsWith('/api/v1/deudas/socios/p1/pendientes')) return PENDIENTES
    if (url.startsWith('/api/v1/cuentas-corrientes/propias')) return []
    if (url.startsWith('/api/v1/socios-comerciales?')) return pagina([PROVEEDOR], 1)
    if (url.startsWith('/api/v1/deudas/proveedores')) {
      return { pagina: { page: 1, totalCount: 1, totalPages: 1, hasNextPage: false, items: [{ socioId: 'p1', razonSocial: 'Molinos SA', saldoDeuda: 80000, diasDeudaMasVieja: 10 }] }, deudaTotal: 80000 }
    }
    if (url === '/api/v1/socios-comerciales/p1') return { ...PROVEEDOR, puedeVerCuentaCorriente: true }
    return null
  })
  post.mockResolvedValue({ data: 'pg9', sobre: { statusCode: 200, succeeded: true, data: 'pg9' } })
})

const presionar = async (nombre: string | RegExp) => userEvent.press(await screen.findByRole('button', { name: nombre }, ESPERA))

async function cargarMedio(medio: string, monto: string) {
  await presionar('Agregar un medio')
  await userEvent.press(await screen.findByRole('radio', { name: medio }, ESPERA))
  fireEvent.changeText(screen.getByLabelText('Monto'), monto)
}

describe('pago a un proveedor', () => {
  it('con el proveedor elegido arranca en "Qué se paga", con lo que se le debe y la imputación del pago', async () => {
    renderConQuery(<PagarRoute />)
    expect(await screen.findByLabelText('Paso 2 de 4: Qué se paga', {}, ESPERA)).toBeTruthy()
    expect(screen.getByLabelText('Paso 1 de 4: Proveedor')).toBeTruthy()
    expect(await screen.findByLabelText(`Le debés: ${$(80000)}`, {}, ESPERA)).toBeTruthy()
    expect(screen.getByText(AVISO_IMPUTACION_PAGO)).toBeTruthy()
    expect(screen.getByText('Molinos SA')).toBeTruthy()
    expect(get.mock.calls.some(([u]) => String(u).endsWith('/estado-cuenta'))).toBe(false)
  })

  it('manda el pago al mismo POST del cobro, con el proveedor y una clave de idempotencia', async () => {
    renderConQuery(<PagarRoute />)
    await presionar('Continuar a medios')
    expect(await screen.findByText('¿Cómo le pagás?', {}, ESPERA)).toBeTruthy()
    await cargarMedio('Transferencia', '80000')
    await presionar('Agregar este medio')
    await presionar('Continuar a confirmar')
    expect(screen.getByText('Queda registrado en la cuenta corriente del proveedor')).toBeTruthy()
    await presionar(`Registrar pago de ${$(80000)}`)

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1), ESPERA)
    const [url, cuerpo] = post.mock.calls[0]
    expect(url).toBe('/api/v1/Finanzas/pagos/multilinea')
    expect(cuerpo).toEqual({ socioComercialId: 'p1', claveIdempotencia: expect.any(String), lineas: [{ medioPagoId: 'm-tr', monto: 80000 }] })
    expect(cuerpo.claveIdempotencia.length).toBeGreaterThan(0)
    expect(await screen.findByLabelText(`Pagado: ${$(80000)}`, {}, ESPERA)).toBeTruthy()
    expect(screen.getAllByText('Pago registrado').length).toBeGreaterThan(0)
  })

  it('reintentar tras un corte reusa la misma clave', async () => {
    post.mockRejectedValueOnce(new Error('Sin respuesta del servidor.'))
    renderConQuery(<PagarRoute />)
    await presionar('Continuar a medios')
    await cargarMedio('Transferencia', '1000')
    await presionar('Agregar este medio')
    await presionar('Continuar a confirmar')
    await presionar(`Registrar pago de ${$(1000)}`)
    expect(await screen.findByText('Sin respuesta del servidor.', {}, ESPERA)).toBeTruthy()
    await presionar(`Registrar pago de ${$(1000)}`)
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2), ESPERA)
    expect(post.mock.calls[1][1].claveIdempotencia).toBe(post.mock.calls[0][1].claveIdempotencia)
  })

  it('el efectivo sale de la caja del depósito propio de quien no ve todos los depósitos (como la web)', async () => {
    useAuthStore.setState(s => ({ user: { ...s.user!, depositoId: 'dep-propio' } }))
    renderConQuery(<PagarRoute />)
    await presionar('Continuar a medios')
    await cargarMedio('Efectivo', '5000')
    await presionar('Agregar este medio')
    await presionar('Continuar a confirmar')
    await presionar(`Registrar pago de ${$(5000)}`)

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1), ESPERA)
    expect(post.mock.calls[0][1]).toMatchObject({ socioComercialId: 'p1', depositoId: 'dep-propio' })
    expect(get.mock.calls.map(([u]) => String(u))).toContain('/api/v1/Cajas/activa?depositoId=dep-propio')
  })

  it('con cheque, es un cheque propio que se entrega (chequesPropiosEntregados), no uno recibido', async () => {
    renderConQuery(<PagarRoute />)
    await presionar('Continuar a medios')
    await cargarMedio('Cheque', '30000')
    fireEvent.changeText(screen.getByLabelText('N.º de cheque'), '000123')
    fireEvent.changeText(screen.getByLabelText('Banco'), 'Nación')
    fireEvent.changeText(screen.getByLabelText('Titular'), 'Mi empresa SA')
    fireEvent.changeText(screen.getByLabelText('Fecha de emisión'), '10/11/2026')
    fireEvent.changeText(screen.getByLabelText('Fecha de pago'), '10/12/2026')
    await presionar('Agregar este medio')
    expect(await screen.findByText('El cheque propio va en un pago de un solo medio.', {}, ESPERA)).toBeTruthy()
    await presionar('Continuar a confirmar')
    await presionar(`Registrar pago de ${$(30000)}`)

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1), ESPERA)
    const [linea] = post.mock.calls[0][1].lineas
    expect(linea).toEqual({
      medioPagoId: 'm-ch',
      monto: 30000,
      chequesPropiosEntregados: [{ numero: '000123', banco: 'Nación', titular: 'Mi empresa SA', fechaEmision: '2026-11-10', fechaPago: '2026-12-10', monto: 30000 }],
    })
    expect(linea.chequesRecibidos).toBeUndefined()
  })

  it('sin proveedor elegido, el paso 1 lista los proveedores y elegir uno lleva a "Qué se paga"', async () => {
    mockParams = {}
    renderConQuery(<PagarRoute />)
    expect(await screen.findByText('Pago a proveedor', {}, ESPERA)).toBeTruthy()
    const continuar = screen.getByRole('button', { name: 'Continuar a qué se paga' })
    expect(continuar.props.accessibilityState?.disabled).toBe(true)
    await presionar(/^Molinos SA/)
    await presionar('Continuar a qué se paga')
    expect(await screen.findByLabelText('Paso 2 de 4: Qué se paga', {}, ESPERA)).toBeTruthy()
    expect(get.mock.calls.map(([u]) => String(u)).some(u => u.startsWith('/api/v1/socios-comerciales?') && u.includes('tipo=2'))).toBe(true)
  })
})

describe('Cuentas > Debo: "Pagar"', () => {
  it('abre el pago con ese proveedor ya elegido', async () => {
    mockParams = {}
    get.mockImplementation(async (url: string) => {
      if (url.startsWith('/api/v1/deudas/proveedores')) {
        return { pagina: { page: 1, totalCount: 1, totalPages: 1, hasNextPage: false, items: [{ socioId: 'p1', razonSocial: 'Molinos SA', saldoDeuda: 80000, diasDeudaMasVieja: 10 }] }, deudaTotal: 80000 }
      }
      if (url.startsWith('/api/v1/socios-comerciales?')) return pagina([clienteDeLista()], 1)
      return null
    })
    renderConQuery(<CuentasCorrientesScreen />)
    await userEvent.press(await screen.findByRole('radio', { name: 'Debo' }, ESPERA))
    await presionar('Pagar a Molinos SA')
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(tabs)/tesoreria/pagos/pagar', params: { socioId: 'p1' } })
  })
})
