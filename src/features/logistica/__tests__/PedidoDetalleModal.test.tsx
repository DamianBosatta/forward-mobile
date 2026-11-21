import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { PedidoDetalleModal } from '../components/PedidoDetalleModal'
import { formatImporte } from '@/core/ui/fw'

jest.mock('@/libs/api-client', () => ({
  useVenta: () => ({ data: { venta: { totalAmount: 1234567.89 }, detalles: [{ id: 'd1', cantidad: 2, productoNombre: 'Yerba' }], bultos: [] }, isLoading: false, isError: false }),
}))

describe.each(['light', 'dark'])('PedidoDetalleModal (%s)', () => {
  it('el total sale por el formateador de importes compartido, en pesos y sin centavos', () => {
    render(<PedidoDetalleModal ventaId="v1" clienteNombre="Cliente" isVisible onClose={jest.fn()} />)
    const esperado = formatImporte(1234567.89, { centavos: false })
    const textos = screen.UNSAFE_getAllByType(require('react-native').Text).map((t) => [t.props.children].flat().join(''))
    expect(textos).toContain(esperado)
  })
})
