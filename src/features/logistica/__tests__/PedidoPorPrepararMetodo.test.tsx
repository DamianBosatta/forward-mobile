import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { PedidoPorPrepararDetalle } from '../porPreparar/PedidoPorPrepararDetalle'

jest.mock('@/libs/api-client', () => ({
  ...jest.requireActual('@/libs/api-client'),
  useVenta: () => ({ data: { detalles: [], venta: {} }, isLoading: false, isError: false }),
}))

const pedido = (o: Record<string, unknown>) => ({
  id: 'v1', codigoPedido: 'A00419', clienteNombre: 'Abel SRL', vendedorNombre: 'Emanuel', direccion: 'Tarantino 1898',
  estado: 3, itemsCount: 2, fechaEntrega: '2026-10-22T00:00:00', metodoEntrega: 1, metodoEntregaNombre: 'LogisticaPropia', ...o,
}) as never

describe.each(['light', 'dark'] as const)('Detalle del pedido por preparar, fila "Cómo" (%s)', () => {
  it.each([
    [1, 'LogisticaPropia', 'Logística'],
    [2, 'RetiroEnLocal', 'Retiro'],
    [3, 'Expreso', 'Expreso'],
  ])('método %s muestra la etiqueta humana y nunca el enum crudo', (metodoEntrega, metodoEntregaNombre, esperado) => {
    render(<PedidoPorPrepararDetalle pedido={pedido({ metodoEntrega, metodoEntregaNombre })} />)
    expect(screen.getByText(esperado)).toBeTruthy()
    if (metodoEntregaNombre !== esperado) expect(screen.queryByText(metodoEntregaNombre)).toBeNull()
  })
})
