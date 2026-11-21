import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { PedidoDetalleModal } from '../components/PedidoDetalleModal'
import { formatImporte } from '@/core/ui/fw'

let mockReducido = false
jest.mock('react-native-reanimated', () => {
  const real = jest.requireActual('react-native-reanimated')
  return new Proxy(real, { get: (t, k) => (k === 'useReducedMotion' ? () => mockReducido : t[k]) })
})
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

describe('PedidoDetalleModal: Reduce Motion (ME-R7-2)', () => {
  it('con Reduce Motion el fondo y la hoja no animan su entrada', () => {
    mockReducido = true
    const Animated = require('react-native-reanimated').default
    render(<PedidoDetalleModal ventaId="v1" clienteNombre="C" isVisible onClose={jest.fn()} />)
    const vistas = screen.UNSAFE_getAllByType(Animated.View)
    expect(vistas.length).toBeGreaterThan(0)
    expect(vistas.every((v) => v.props.entering === undefined)).toBe(true)
    mockReducido = false
  })
})
