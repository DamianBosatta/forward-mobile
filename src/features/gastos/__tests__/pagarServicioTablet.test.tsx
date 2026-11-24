import React from 'react'
import { StyleSheet } from 'react-native'
import { screen, userEvent } from '@testing-library/react-native'
import { PagarServicio } from '../components/PagarServicio'
import { api } from '@/core/api/client'
import { conPermisos, renderConQuery } from '@/features/clientes/__testing__/ayuda'

jest.mock('@/core/ui/Toast', () => ({ useToast: () => ({ show: jest.fn() }) }))
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: 820, isTablet: true, isTabletLandscape: false }) }))
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: jest.fn(), post: jest.fn() },
  API_URL: '',
}))

const get = api.get as jest.Mock
const ESPERA = { timeout: 5000 }
jest.setTimeout(15_000)

beforeEach(() => {
  jest.clearAllMocks()
  conPermisos([
    { module: 'MOD_PAGOS', canRead: true, canCreate: true },
    { module: 'MOD_CC', canRead: true },
    { module: 'CAP_VER_TESORERIA', canRead: true },
  ])
  get.mockImplementation(async (url: string) => {
    if (url === '/api/v1/gastos/tipos-gasto') return [{ id: 'tg-luz', nombre: 'Luz', activo: true }]
    if (url === '/api/v1/gastos/medios-pago') return [{ id: 'm-tr', nombre: 'Transferencia', requiereCaja: false, esCheque: false, activo: true }]
    if (url.startsWith('/api/v1/cuentas-corrientes/propias')) return []
    throw new Error(`sin respuesta para ${url}`)
  })
})

describe('Pagar un servicio en tablet y sin cuentas', () => {
  it('el pie va en la misma columna que el formulario (MP-25)', async () => {
    renderConQuery(<PagarServicio onListo={jest.fn()} />)
    const pie = await screen.findByTestId('pie-columna', {}, ESPERA)
    expect(StyleSheet.flatten(pie.props.style)).toMatchObject({ maxWidth: 640, alignSelf: 'center' })
  })

  it('el botón se llama igual que el título de la pantalla (MP-15)', async () => {
    renderConQuery(<PagarServicio onListo={jest.fn()} />)
    expect(await screen.findByRole('button', { name: 'Pagar un servicio' }, ESPERA)).toBeTruthy()
  })

  it('sin cuentas para elegir avisa en vez de dejar un título suelto (MP-20)', async () => {
    renderConQuery(<PagarServicio onListo={jest.fn()} />)
    await userEvent.press(await screen.findByRole('radio', { name: 'Transferencia' }, ESPERA))
    expect(await screen.findByText('No hay cuentas disponibles para elegir.', {}, ESPERA)).toBeTruthy()
  })
})
