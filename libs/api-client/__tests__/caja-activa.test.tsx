import React from 'react'
import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { finanzasKeys, useCajaActiva } from '../finanzas'
import { api } from '../client'

jest.mock('../client', () => ({ api: { get: jest.fn() }, API_URL: 'x' }))

const get = api.get as jest.Mock
let qc: QueryClient
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>

beforeEach(() => {
  get.mockReset()
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

describe('useCajaActiva: la caja abierta de un depósito (como la web)', () => {
  it('pide la caja de ese depósito y la guarda con el depósito en la clave', async () => {
    const caja = { id: 'k1', abierta: true, depositoId: 'dep-sur', depositoNombre: 'Depósito Sur' }
    get.mockResolvedValue(caja)
    const { result } = renderHook(() => useCajaActiva('dep-sur'), { wrapper })

    await waitFor(() => expect(result.current.data).toEqual(caja))
    expect(get).toHaveBeenCalledWith('/api/v1/Cajas/activa?depositoId=dep-sur')
    expect(qc.getQueryData(['caja', 'activa', 'dep-sur'])).toEqual(caja)
    expect(finanzasKeys.cajaActiva('dep-sur')).toEqual(['caja', 'activa', 'dep-sur'])
  })

  it('sin caja abierta (204) da null, no un error', async () => {
    get.mockResolvedValue(undefined)
    const { result } = renderHook(() => useCajaActiva('dep-sur'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('apagada no pide nada', async () => {
    renderHook(() => useCajaActiva('dep-sur', { enabled: false }), { wrapper })
    await new Promise(r => setTimeout(r, 20))
    expect(get).not.toHaveBeenCalled()
  })
})
