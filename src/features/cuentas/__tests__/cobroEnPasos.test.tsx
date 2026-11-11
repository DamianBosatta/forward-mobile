import React from 'react'
import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import CobroRoute from '@/app/(tabs)/cuentas/cobro'
import { RegistrarCobro } from '../components/RegistrarCobro'
import { COBRO_CON_LO_DE_ANTES, COBRO_YA_ESTABA } from '../components/CobroListo'
import { AVISO_IMPUTACION } from '../components/RegistrarCobro'
import { CHEQUE_SOLO_EN_UN_MEDIO } from '../lib/cobro'
import { api, ApiError } from '@/core/api/client'
import { formatImporte } from '@/core/ui/fw'
import { MOTIVO_SIN_PERMISO_DE_COBRO } from '@/core/ui/fw/MotivoDeshabilitado'
import { clienteDeLista, conPermisos, pagina, renderConQuery } from '@/features/clientes/__testing__/ayuda'
import { estadoDeCuenta, fichaConCuentas, mov, paginaDeMovimientos } from '../__testing__/servidor'

let mockParams: Record<string, string | undefined> = {}
const mockBack = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}))
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: jest.fn(), post: jest.fn(), postConSobre: jest.fn() },
  API_URL: '',
}))

const get = api.get as jest.Mock
const post = api.postConSobre as jest.Mock
const ESPERA = { timeout: 5000 }
jest.setTimeout(20_000)
const MEDIOS = [
  { id: 'm-ef', nombre: 'Efectivo', requiereCaja: true, esCheque: false, activo: true },
  { id: 'm-tr', nombre: 'Transferencia', requiereCaja: false, esCheque: false, activo: true },
  { id: 'm-ch', nombre: 'Cheque', requiereCaja: false, esCheque: true, activo: true },
]
const UNA_CAJA = [{ depositoId: 'dep-central', depositoNombre: 'Caja Central' }]
const $ = (n: number) => formatImporte(n)
const registrado = (sobre: object = {}) => ({ data: 'p1', sobre: { statusCode: 200, succeeded: true, data: 'p1', tipoCuenta: 'Tst', ...sobre } })

beforeEach(() => {
  jest.clearAllMocks()
  mockParams = { socioId: 'c1' }
  conPermisos([{ module: 'MOD_PAGOS', canRead: true, canCreate: true }])
  get.mockImplementation(async (url: string) => {
    if (url === '/api/v1/gastos/medios-pago') return MEDIOS
    if (url === '/api/v1/Cajas/abiertas/estado') return UNA_CAJA
    if (url.endsWith('/estado-cuenta')) return estadoDeCuenta({ deudaVencida: 50000, tieneDeudaVencida: true })
    if (url.includes('/movimientos')) return paginaDeMovimientos([mov('m1', '2026-10-11T14:00:00Z', { haber: 50000, pagoId: 'p1' })])
    if (url.startsWith('/api/v1/socios-comerciales?')) return { ...pagina([clienteDeLista()], 1), saldoTotal: 186420 }
    return fichaConCuentas()
  })
  post.mockResolvedValue(registrado())
})

const presionar = async (nombre: string | RegExp) => userEvent.press(await screen.findByRole('button', { name: nombre }, ESPERA))

/** Abre "Medio y monto", elige el medio y escribe el monto (si se pasa). */
async function cargarMedio(agregar: string, medio: string, monto?: string) {
  await presionar(agregar)
  await userEvent.press(await screen.findByRole('radio', { name: medio }, ESPERA))
  if (monto !== undefined) fireEvent.changeText(screen.getByLabelText('Monto'), monto)
}

describe('pasos del cobro', () => {
  it('con el cliente ya elegido salta el paso 1 y arranca en "Qué se cobra"', async () => {
    renderConQuery(<CobroRoute />)
    expect(await screen.findByText('Paso 2 de 4', {}, ESPERA)).toBeTruthy()
    expect(screen.getByLabelText('Paso 1 de 4: Cliente')).toBeTruthy()
    expect(screen.getByLabelText('Paso 2 de 4: Qué se cobra')).toBeTruthy()
    expect(screen.queryByLabelText('Buscar cliente')).toBeNull()
    expect(await screen.findByText(AVISO_IMPUTACION, {}, ESPERA)).toBeTruthy()
  })

  it('sin cliente arranca en el paso 1: elegir el cliente lleva a "Qué se cobra"', async () => {
    mockParams = {}
    renderConQuery(<CobroRoute />)
    expect(await screen.findByText('Paso 1 de 4', {}, ESPERA)).toBeTruthy()
    const continuar = screen.getByRole('button', { name: 'Continuar a qué se cobra' })
    expect(continuar.props.accessibilityState?.disabled).toBe(true)

    await userEvent.press(await screen.findByRole('button', { name: /^Av\. del Valle 89/ }, ESPERA))
    expect(await screen.findByText('Saldo del cliente', {}, ESPERA)).toBeTruthy()
    await presionar('Continuar a qué se cobra')

    expect(await screen.findByText('Paso 2 de 4', {}, ESPERA)).toBeTruthy()
    // Atrás desde el paso 2 vuelve a elegir cliente, no sale de la pantalla.
    await userEvent.press(screen.getByLabelText('Volver'))
    expect(await screen.findByText('Paso 1 de 4', {}, ESPERA)).toBeTruthy()
    expect(mockBack).not.toHaveBeenCalled()
  })

  it('sin permiso de cobrar, el paso 1 no deja seguir y dice por qué', async () => {
    mockParams = {}
    conPermisos([{ module: 'MOD_PAGOS', canRead: true, canCreate: false }])
    renderConQuery(<CobroRoute />)
    await userEvent.press(await screen.findByRole('button', { name: /^Av\. del Valle 89/ }, ESPERA))
    expect(screen.getByText(MOTIVO_SIN_PERMISO_DE_COBRO)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Continuar a qué se cobra' }).props.accessibilityState?.disabled).toBe(true)
  })

  it('cobro completo: objetivo, un medio, Cobrás / Cubierto / Falta y "Registrar cobro de $X"', async () => {
    renderConQuery(<CobroRoute />)
    await userEvent.press(await screen.findByRole('radio', { name: 'Todo lo vencido' }, ESPERA))
    await presionar('Continuar a medios')
    expect(await screen.findByText('Paso 3 de 4', {}, ESPERA)).toBeTruthy()

    // El objetivo precarga el monto del primer medio.
    await cargarMedio('Agregar un medio', 'Efectivo')
    expect(screen.getByText('Medio y monto')).toBeTruthy()
    expect(screen.getByLabelText('Monto').props.value).toBe('50000')
    fireEvent.changeText(screen.getByLabelText('Monto'), '30.000')
    await presionar('Agregar este medio')

    expect(await screen.findByLabelText(`Cobrás: ${$(30000)}`, {}, ESPERA)).toBeTruthy()
    expect(screen.getByLabelText(`Cubierto: ${$(30000)}`)).toBeTruthy()
    expect(screen.getByLabelText(`Falta: ${$(20000)}`)).toBeTruthy()
    expect(screen.getByRole('button', { name: `Editar Efectivo, ${$(30000)}` })).toBeTruthy()

    await cargarMedio('Agregar otro medio', 'Transferencia', '20.000')
    await presionar('Agregar este medio')
    expect(await screen.findByLabelText(`Falta: ${$(0)}`, {}, ESPERA)).toBeTruthy()

    await presionar('Continuar a confirmar')
    expect(await screen.findByText('Paso 4 de 4', {}, ESPERA)).toBeTruthy()
    fireEvent.changeText(screen.getByLabelText('Referencia (opcional)'), 'Op 77')
    await presionar(`Registrar cobro de ${$(50000)}`)

    expect(post).toHaveBeenCalledTimes(1)
    expect(post.mock.calls[0][1]).toEqual({
      socioComercialId: 'c1',
      referencia: 'Op 77',
      depositoId: 'dep-central',
      claveIdempotencia: expect.stringMatching(/^mobile-/),
      lineas: [{ medioPagoId: 'm-ef', monto: 30000 }, { medioPagoId: 'm-tr', monto: 20000 }],
    })
    expect(await screen.findAllByRole('header', { name: 'Cobro registrado' }, ESPERA)).toHaveLength(2)
    expect(await screen.findByText('Quedó en la cuenta TST', {}, ESPERA)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Mandar recibo' })).toBeTruthy()
  })

  it('quitar un medio lo saca de la lista y del total', async () => {
    renderConQuery(<CobroRoute />)
    await presionar('Continuar a medios')
    await cargarMedio('Agregar un medio', 'Transferencia', '10.000')
    await presionar('Agregar este medio')
    await cargarMedio('Agregar otro medio', 'Efectivo', '5.000')
    await presionar('Agregar este medio')
    expect(await screen.findByLabelText(`Cobrás: ${$(15000)}`, {}, ESPERA)).toBeTruthy()

    await presionar('Quitar Transferencia')
    expect(await screen.findByLabelText(`Cobrás: ${$(5000)}`, {}, ESPERA)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Editar Transferencia/ })).toBeNull()
    expect(screen.getByRole('button', { name: `Editar Efectivo, ${$(5000)}` })).toBeTruthy()
  })

  it('el cheque va solo: con un cheque en la lista no se puede agregar otro medio', async () => {
    renderConQuery(<CobroRoute />)
    await presionar('Continuar a medios')
    await cargarMedio('Agregar un medio', 'Cheque', '40.000')
    expect(screen.getByText('El cheque se carga en un cobro de un solo medio.')).toBeTruthy()
    // Sin número, banco y titular no se agrega.
    expect(screen.getByRole('button', { name: 'Agregar este medio' }).props.accessibilityState?.disabled).toBe(true)
    fireEvent.changeText(screen.getByLabelText('N.º de cheque'), '000123')
    fireEvent.changeText(screen.getByLabelText('Banco'), 'Banco Uno')
    fireEvent.changeText(screen.getByLabelText('Titular'), 'Chela')
    await presionar('Agregar este medio')

    expect(await screen.findByRole('button', { name: `Editar Cheque, ${$(40000)}` }, ESPERA)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Agregar otro medio' })).toBeNull()
    expect(screen.getByText('El cheque se carga en un cobro de un solo medio.')).toBeTruthy()

    await presionar('Continuar a confirmar')
    await presionar(`Registrar cobro de ${$(40000)}`)
    expect(post.mock.calls[0][1].lineas).toEqual([
      { medioPagoId: 'm-ch', monto: 40000, chequesRecibidos: [expect.objectContaining({ numero: '000123', banco: 'Banco Uno', titular: 'Chela', monto: 40000 })] },
    ])
  })

  it('un cheque como segundo medio no deja confirmar: el aviso dice que el cheque va solo', async () => {
    renderConQuery(<CobroRoute />)
    await presionar('Continuar a medios')
    await cargarMedio('Agregar un medio', 'Transferencia', '10.000')
    await presionar('Agregar este medio')
    await cargarMedio('Agregar otro medio', 'Cheque', '5.000')
    await presionar('Agregar este medio')

    expect(await screen.findByText(CHEQUE_SOLO_EN_UN_MEDIO, {}, ESPERA)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Continuar a confirmar' }).props.accessibilityState?.disabled).toBe(true)
  })

  it('"Cobro registrado": un reintento que ya estaba lo avisa', async () => {
    post.mockResolvedValue(registrado({ message: 'Pago registrado con esta clave de idempotencia (operación repetida)' }))
    renderConQuery(<CobroRoute />)
    await presionar('Continuar a medios')
    await cargarMedio('Agregar un medio', 'Transferencia', '10.000')
    await presionar('Agregar este medio')
    await presionar('Continuar a confirmar')
    await presionar(`Registrar cobro de ${$(10000)}`)

    expect(await screen.findByText(COBRO_YA_ESTABA, {}, ESPERA)).toBeTruthy()
    expect(screen.getAllByRole('header', { name: 'Cobro registrado' })).toHaveLength(2)
  })

  it('"Cobro ya registrado": tras un corte, la misma clave y el 409 dice que lo nuevo no se guardó', async () => {
    post
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockRejectedValueOnce(Object.assign(new ApiError(409, 'Este cobro ya se había registrado antes con otros datos.'), { codigo: 'ClaveIdempotenciaConOtroCuerpo', data: 'p1' }))
    renderConQuery(<CobroRoute />)
    await presionar('Continuar a medios')
    await cargarMedio('Agregar un medio', 'Transferencia', '10.000')
    await presionar('Agregar este medio')
    await presionar('Continuar a confirmar')
    await presionar(`Registrar cobro de ${$(10000)}`)
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    fireEvent.changeText(screen.getByLabelText('Referencia (opcional)'), 'otra')
    await presionar(`Registrar cobro de ${$(10000)}`)

    expect(await screen.findByText(COBRO_CON_LO_DE_ANTES, {}, ESPERA)).toBeTruthy()
    expect(screen.getByRole('header', { name: 'Cobro ya registrado' })).toBeTruthy()
    const [primera, segunda] = post.mock.calls.map(([, cuerpo]) => cuerpo.claveIdempotencia)
    expect(segunda).toBe(primera)
  })

  it('"Registrar otro cobro" vuelve a "Qué se cobra" con otra clave', async () => {
    renderConQuery(<CobroRoute />)
    await presionar('Continuar a medios')
    await cargarMedio('Agregar un medio', 'Transferencia', '10.000')
    await presionar('Agregar este medio')
    await presionar('Continuar a confirmar')
    await presionar(`Registrar cobro de ${$(10000)}`)
    await presionar('Registrar otro cobro')

    expect(await screen.findByText('Paso 2 de 4', {}, ESPERA)).toBeTruthy()
    await presionar('Continuar a medios')
    await cargarMedio('Agregar un medio', 'Transferencia', '2.000')
    await presionar('Agregar este medio')
    await presionar('Continuar a confirmar')
    await presionar(`Registrar cobro de ${$(2000)}`)
    const [primera, segunda] = post.mock.calls.map(([, cuerpo]) => cuerpo.claveIdempotencia)
    expect(segunda).not.toBe(primera)
  })
})

it('embebido (tablet, sin barra): RegistrarCobro sigue siendo el formulario de una sola pantalla', async () => {
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  expect(await screen.findByLabelText('Monto', {}, ESPERA)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Otro medio' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Registrar cobro' })).toBeTruthy()
  expect(screen.queryByText(/^Paso \d de 4$/)).toBeNull()
  expect(await screen.findByRole('radio', { name: 'Cheque' }, ESPERA)).toBeTruthy()
})
