import React from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { storage } from '@/core/utils/storage'
import { useConfirmarVenta } from '../hooks/useConfirmarVenta'
import { MOTIVO_CALCULANDO_IVA, ERROR_IVA } from '../components/TotalConIvaVista'
import { producto } from '../__testing__/producto'

const mockPost = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: jest.fn(), post: (...a: unknown[]) => mockPost(...a), put: jest.fn() },
}))
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }) }))
jest.mock('../hooks/useDepositoDeVenta', () => ({ useDepositoDeVenta: () => 'd1' }))

/** 12 unidades al precio del servidor de la fixture: lo que el vendedor vio como neto. */
const pala = producto({ real: 100, disponible: 100 })
const borrador = { borrador: null, cerrar: jest.fn(), descartar: jest.fn(), flush: jest.fn() }

function hook(extra: object, conFactura = true) {
  const qc = new QueryClient()
  const datos = {
    clienteId: 'c1', cliente: null, esPedido: true, descuentoGeneral: 0, borrador, alGuardar: jest.fn(),
    lineas: [{ productoId: pala.id, producto: pala, cantidad: 12, descuentoPct: 0 }],
    cabecera: { metodoEntrega: 1, fecha: null, flete: 0, observaciones: '', conFactura },
    ...extra,
  }
  return renderHook(() => useConfirmarVenta(datos as never), { wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider> })
}

beforeEach(() => {
  storage.clearAll()
  mockPost.mockReset()
  mockPost.mockResolvedValue({ ventaId: 'v1', version: 1, message: 'ok', estado: 2 })
  useAuthStore.setState({ user: { id: 'u', username: 'u', roles: [], permissions: [] } as never })
})

describe('useConfirmarVenta: guardas de la venta con factura (la única puerta es el botón deshabilitado)', () => {
  it('con el cálculo en curso no manda nada y explica por qué', async () => {
    const { result } = hook({ totalConIva: { estado: 'calculando' } })
    await act(async () => { await result.current.confirmar() })
    expect(mockPost).not.toHaveBeenCalled()
    expect(result.current.error).toBe(MOTIVO_CALCULANDO_IVA)
  })

  it('con el cálculo fallado con red no manda nada y lo dice', async () => {
    const { result } = hook({ totalConIva: { estado: 'error', sinSenal: false } })
    await act(async () => { await result.current.confirmar() })
    expect(mockPost).not.toHaveBeenCalled()
    expect(result.current.error).toBe(ERROR_IVA)
  })

  it('con factura y sin total del servidor manda el neto que vio el vendedor, nunca sin totalEsperado', async () => {
    const { result } = hook({ totalConIva: { estado: 'error', sinSenal: true } })
    await act(async () => { await result.current.confirmar() })
    expect(mockPost.mock.calls[0][1].totalEsperado).toBe(29952)
  })

  it('con el cálculo listo pero sin total (null) también manda el neto visto', async () => {
    const { result } = hook({ totalConIva: { estado: 'listo', total: null } })
    await act(async () => { await result.current.confirmar() })
    expect(mockPost.mock.calls[0][1].totalEsperado).toBe(29952)
  })

  it('sin el tilde el cuerpo no lleva totalEsperado, como siempre', async () => {
    const { result } = hook({}, false)
    await act(async () => { await result.current.confirmar() })
    expect(mockPost.mock.calls[0][1]).not.toHaveProperty('totalEsperado')
  })
})
