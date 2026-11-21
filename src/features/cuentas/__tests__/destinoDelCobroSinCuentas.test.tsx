import React from 'react'
import { act, screen, userEvent, waitFor } from '@testing-library/react-native'
import { api, ApiError } from '@/core/api/client'
import { conPermisos, renderConQuery } from '@/features/clientes/__testing__/ayuda'
import { DestinoDelCobro } from '../components/DestinoDelCobro'

jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: jest.fn(), post: jest.fn() },
  API_URL: '',
}))
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: async () => ({ granted: true }),
  requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}))
const get = api.get as jest.Mock

const URL_CUENTAS = '/api/v1/cuentas-corrientes/propias/para-cobrar'
const CUENTAS = [{ id: 'cp-galicia', nombre: 'Galicia', moneda: 'ARS', esPrincipal: false, esCuentaCajaEfectivo: false, esCuentaCarteraCheques: false }]
const SIN_ELEGIR = 'No se pudieron cargar las cuentas. Si seguís, va a la cuenta del medio de pago.'

function servidor(cuentas: unknown) {
  get.mockImplementation(async (url: string) => {
    if (url !== URL_CUENTAS) return undefined
    if (cuentas instanceof Error) throw cuentas
    return cuentas
  })
}

const pintar = (cuentaPropiaId: string | null = null) =>
  renderConQuery(
    <DestinoDelCobro medio={{ cuentaPropiaDefaultId: 'cp-galicia' }} cuentaPropiaId={cuentaPropiaId} comprobanteUrl={null}
      onCuenta={jest.fn()} onComprobante={jest.fn()} onSubiendo={jest.fn()} />,
  )

beforeEach(() => {
  jest.clearAllMocks()
  conPermisos([{ module: 'MOD_PAGOS', canRead: true, canCreate: true }])
})

describe('cuenta donde entró: la lista de cuentas falla', () => {
  it('lo avisa donde iría el selector, dice adónde va si sigue, y Reintentar la vuelve a pedir', async () => {
    servidor(new Error('falló'))
    pintar()
    expect(await screen.findByText(SIN_ELEGIR)).toBeTruthy()

    servidor(CUENTAS)
    await userEvent.press(screen.getByRole('button', { name: 'Reintentar las cuentas' }))
    expect(await screen.findByRole('radio', { name: 'Galicia' })).toBeTruthy()
    await waitFor(() => expect(screen.queryByText(SIN_ELEGIR)).toBeNull())
  })

  it('con una cuenta ya elegida dice que va a esa, que es la que se manda', async () => {
    servidor(new Error('falló'))
    pintar('cp-galicia')
    expect(await screen.findByText('No se pudieron cargar las cuentas. Si seguís, va a la cuenta que ya elegiste.')).toBeTruthy()
  })

  it('con un servidor anterior (404) y sin MOD_CC:Read no hay lista que cargar: no avisa nada, como antes', async () => {
    servidor(new ApiError(404, 'No encontrado'))
    pintar()
    await waitFor(() => expect(get).toHaveBeenCalledWith(URL_CUENTAS, expect.anything()))
    await act(async () => { await new Promise(r => setTimeout(r, 50)) })
    expect(screen.queryByText(/No se pudieron cargar las cuentas/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reintentar las cuentas' })).toBeNull()
  })
})
