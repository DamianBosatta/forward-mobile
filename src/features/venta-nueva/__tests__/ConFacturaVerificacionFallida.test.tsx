import React from 'react'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { api } from '@/core/api/client'
import { ConFactura } from '../components/ConFactura'
import { producto } from '../__testing__/producto'

jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}))
const post = api.post as jest.Mock

const URL_VERIFICAR = '/api/v1/Ventas/stock-fiscal/verificar'
const pala = producto()
const LINEAS = [{ productoId: pala.id, producto: pala, cantidad: 12, descuentoPct: 0 }]
const FALLO = /No se pudo verificar el stock fiscal/

/** React Query real sin reintentos; el wrapper sobrevive al rerender. */
function renderConQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(ui, { wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider> })
}

beforeEach(() => { jest.clearAllMocks() })

describe('Con factura: la verificación del stock fiscal falla (RED-11)', () => {
  it('lo avisa con Reintentar, sin bloquear: el interruptor sigue andando', async () => {
    post.mockRejectedValue(new Error('falló'))
    const onChange = jest.fn()
    renderConQuery(<ConFactura conFactura onChange={onChange} lineas={LINEAS} />)

    expect(await screen.findByText(FALLO)).toBeTruthy()
    await userEvent.press(screen.getByRole('switch', { name: 'Con factura' }))
    expect(onChange).toHaveBeenCalledWith(false)

    post.mockResolvedValue([])
    await userEvent.press(screen.getByRole('button', { name: 'Reintentar la verificación del stock fiscal' }))
    await waitFor(() => expect(screen.queryByText(FALLO)).toBeNull())
    expect(post).toHaveBeenLastCalledWith(URL_VERIFICAR, { items: [{ productoId: pala.id, cantidad: 12 }] })
  })

  it('sin factura no avisa la falla de una verificación anterior', async () => {
    post.mockRejectedValue(new Error('falló'))
    const { rerender } = renderConQuery(<ConFactura conFactura onChange={jest.fn()} lineas={LINEAS} />)
    await screen.findByText(FALLO)
    rerender(<ConFactura conFactura={false} onChange={jest.fn()} lineas={LINEAS} />)
    expect(screen.queryByText(FALLO)).toBeNull()
  })

  it('con la verificación hecha, los faltantes se avisan como siempre', async () => {
    post.mockResolvedValue([{ productoId: pala.id, nombre: 'Pala', cantidad: 12, stockFiscal: 3 }])
    renderConQuery(<ConFactura conFactura onChange={jest.fn()} lineas={LINEAS} />)
    expect(await screen.findByText(/Pala: pide 12, hay 3 en stock fiscal/)).toBeTruthy()
    expect(screen.queryByText(FALLO)).toBeNull()
  })
})
