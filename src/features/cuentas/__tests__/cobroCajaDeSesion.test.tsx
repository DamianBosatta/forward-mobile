import React from 'react'
import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import CobroRoute from '@/app/(tabs)/cuentas/cobro'
import { RegistrarCobro } from '../components/RegistrarCobro'
import { api } from '@/core/api/client'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { elegirDepositoDeSesion, limpiarDepositoDeSesion } from '@/core/api/depositoSesion'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { renderConQuery } from '@/features/clientes/__testing__/ayuda'
import { estadoDeCuenta, fichaConCuentas } from '../__testing__/servidor'

// S2 (G3): el cobro usa la caja del depósito de la sesión, como la web (useCajaActivaDeTrabajo): la muestra como
// texto y no ofrece elegir entre todas las cajas abiertas.
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ socioId: 'c1' }),
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

const SUR = '33333333-3333-4333-8333-333333333333'
const PROPIO = '44444444-4444-4444-8444-444444444444'
const NOMBRES: Record<string, string> = { [SUR]: 'Depósito Sur', [PROPIO]: 'Depósito Norte', [DEPOSITO_CENTRAL_ID]: 'Depósito Central' }
const MEDIOS = [
  { id: 'm-ef', nombre: 'Efectivo', requiereCaja: true, esCheque: false, activo: true },
  { id: 'm-tr', nombre: 'Transferencia', requiereCaja: false, esCheque: false, activo: true },
]
const PAGOS = [{ module: 'MOD_PAGOS', canRead: true, canCreate: true }]

/** Depósitos con la caja abierta; `GET /Cajas/activa?depositoId=` contesta la de ese depósito o nada (204). */
function servidor(abiertas: string[] = [SUR, PROPIO, DEPOSITO_CENTRAL_ID]) {
  get.mockImplementation(async (url: string) => {
    if (url === '/api/v1/gastos/medios-pago') return MEDIOS
    if (url.startsWith('/api/v1/Cajas/activa')) {
      const id = new URLSearchParams(url.split('?')[1] ?? '').get('depositoId')
      return id && abiertas.includes(id)
        ? { id: `caja-${id}`, fecha: '2026-11-11T09:00:00Z', saldoInicialAmount: 0, abierta: true, depositoId: id, depositoNombre: NOMBRES[id] }
        : undefined
    }
    if (url === '/api/v1/Cajas/abiertas/estado') return abiertas.map(id => ({ depositoId: id, depositoNombre: NOMBRES[id] }))
    if (url.startsWith('/api/v1/deudas/socios/')) return []
    if (url.endsWith('/estado-cuenta')) return estadoDeCuenta()
    return fichaConCuentas()
  })
}

/** Quien ve todos los depósitos y eligió `deposito` en Inicio (`null`: "Todos"). */
function conDepositoDeSesion(deposito: string | null) {
  useAuthStore.setState({ user: { id: 'u1', roles: [], permissions: [...PAGOS, { module: 'CAP_VER_TODOS_LOS_DEPOSITOS', canRead: true }] } as never })
  elegirDepositoDeSesion('u1', deposito)
}

const pidioCajaActiva = () => get.mock.calls.map(([u]) => String(u)).filter(u => u.startsWith('/api/v1/Cajas/activa'))
const pidioCajasAbiertas = () => get.mock.calls.some(([u]) => u === '/api/v1/Cajas/abiertas/estado')
const presionar = async (n: string | RegExp) => userEvent.press(await screen.findByRole('button', { name: n }, ESPERA))
const apagado = (n: string | RegExp) => screen.getByRole('button', { name: n }).props.accessibilityState?.disabled === true

async function cargarMontoYMedio(monto: string, medio: string) {
  fireEvent.changeText(await screen.findByLabelText('Monto', {}, ESPERA), monto)
  await userEvent.press(await screen.findByRole('radio', { name: medio }, ESPERA))
}

beforeEach(() => {
  jest.clearAllMocks()
  servidor()
  post.mockResolvedValue({ data: 'p1', sobre: { statusCode: 200, succeeded: true, data: 'p1', tipoCuenta: 'Tst' } })
})
afterEach(() => limpiarDepositoDeSesion())

describe('formulario de siempre: la caja del depósito de la sesión', () => {
  it('el efectivo entra a la caja del depósito elegido en Inicio, que se muestra como texto y sin chips de caja', async () => {
    conDepositoDeSesion(SUR)
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await cargarMontoYMedio('5.000', 'Efectivo')

    expect(await screen.findByText('Se registra en Depósito Sur', {}, ESPERA)).toBeTruthy()
    expect(screen.queryByRole('radio', { name: 'Depósito Central' })).toBeNull()
    expect(screen.queryByRole('radio', { name: 'Depósito Norte' })).toBeNull()
    expect(pidioCajaActiva()).toContain(`/api/v1/Cajas/activa?depositoId=${SUR}`)
    expect(pidioCajasAbiertas()).toBe(false)

    await waitFor(() => expect(apagado(/^Registrar cobro de/)).toBe(false), ESPERA)
    await presionar(/^Registrar cobro de/)
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1), ESPERA)
    expect(post.mock.calls[0][1]).toEqual({
      socioComercialId: 'c1', depositoId: SUR, claveIdempotencia: expect.stringMatching(/^mobile-/), lineas: [{ medioPagoId: 'm-ef', monto: 5000 }],
    })
  })

  it('con "Todos" elegido, el efectivo entra a la caja del Central', async () => {
    conDepositoDeSesion(null)
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await cargarMontoYMedio('5.000', 'Efectivo')

    expect(await screen.findByText('Se registra en Depósito Central', {}, ESPERA)).toBeTruthy()
    await waitFor(() => expect(apagado(/^Registrar cobro de/)).toBe(false), ESPERA)
    await presionar(/^Registrar cobro de/)
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1), ESPERA)
    expect(post.mock.calls[0][1].depositoId).toBe(DEPOSITO_CENTRAL_ID)
  })

  it('sin permiso de ver todos los depósitos, el efectivo entra a la caja del propio aunque haya una elección guardada', async () => {
    useAuthStore.setState({ user: { id: 'u1', roles: [], depositoId: PROPIO, permissions: PAGOS } as never })
    elegirDepositoDeSesion('u1', SUR)
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await cargarMontoYMedio('5.000', 'Efectivo')

    expect(await screen.findByText('Se registra en Depósito Norte', {}, ESPERA)).toBeTruthy()
    await waitFor(() => expect(apagado(/^Registrar cobro de/)).toBe(false), ESPERA)
    await presionar(/^Registrar cobro de/)
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1), ESPERA)
    expect(post.mock.calls[0][1].depositoId).toBe(PROPIO)
  })

  it('sin caja abierta en el depósito de la sesión avisa y no deja cobrar en efectivo, aunque otro depósito tenga la suya abierta', async () => {
    servidor([DEPOSITO_CENTRAL_ID])
    conDepositoDeSesion(SUR)
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await cargarMontoYMedio('5.000', 'Efectivo')

    expect(await screen.findByText('No hay una caja abierta en este depósito. Abrí una caja para registrar cobros en efectivo.', {}, ESPERA)).toBeTruthy()
    expect(apagado(/^Registrar cobro de/)).toBe(true)
    await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))
    expect(post).not.toHaveBeenCalled()
  })

  it('una transferencia no pide la caja ni manda depósito', async () => {
    conDepositoDeSesion(SUR)
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await cargarMontoYMedio('5.000', 'Transferencia')
    await presionar(/^Registrar cobro de/)

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1), ESPERA)
    expect(post.mock.calls[0][1]).not.toHaveProperty('depositoId')
    expect(pidioCajaActiva()).toEqual([])
    expect(screen.queryByText(/^Se registra en/)).toBeNull()
  })
})

describe('cobro en pasos: la caja del depósito de la sesión', () => {
  async function abrirEfectivo() {
    await screen.findByText('Paso 2 de 4', {}, ESPERA)
    await presionar('Continuar a medios')
    await presionar('Agregar un medio')
    await userEvent.press(await screen.findByRole('radio', { name: 'Efectivo' }, ESPERA))
    fireEvent.changeText(screen.getByLabelText('Monto'), '1.000')
  }

  it('"Medio y monto" muestra la caja del depósito de la sesión como texto y el cobro la manda', async () => {
    conDepositoDeSesion(SUR)
    renderConQuery(<CobroRoute />)
    await abrirEfectivo()

    expect(await screen.findByText('Se registra en Depósito Sur', {}, ESPERA)).toBeTruthy()
    expect(screen.queryByRole('radio', { name: 'Depósito Central' })).toBeNull()
    await waitFor(() => expect(apagado('Agregar este medio')).toBe(false), ESPERA)
    await presionar('Agregar este medio')
    await presionar('Continuar a confirmar')
    await screen.findByText('Paso 4 de 4', {}, ESPERA)
    await presionar(/^Registrar cobro/)

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1), ESPERA)
    expect(post.mock.calls[0][1].depositoId).toBe(SUR)
    expect(pidioCajasAbiertas()).toBe(false)
  })

  it('sin caja abierta en el depósito de la sesión no se agrega el efectivo', async () => {
    servidor([DEPOSITO_CENTRAL_ID])
    conDepositoDeSesion(SUR)
    renderConQuery(<CobroRoute />)
    await abrirEfectivo()

    expect(await screen.findByText('No hay una caja abierta en este depósito. Abrí una caja para registrar cobros en efectivo.', {}, ESPERA)).toBeTruthy()
    expect(apagado('Agregar este medio')).toBe(true)
  })
})
