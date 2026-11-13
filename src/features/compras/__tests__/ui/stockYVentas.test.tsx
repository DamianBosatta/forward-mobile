import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { useThemeStore } from '@/libs/theme'
import { ProductoCompraCard, type ProductoComprable } from '../../components/ProductoCompraCard'

const base: ProductoComprable = { id: 'p1', nombre: 'Balde Nuvia 10L', marca: 'Nuvia', codigoPropio: 'PROBL912' }
const props = { onAgregar: jest.fn(), onCambiar: jest.fn(), onQuitar: jest.fn(), onAbrir: jest.fn() }

describe.each(['light', 'dark'] as const)('catálogo de la compra: stock actual y vendido desde la última compra (%s)', (modo) => {
  beforeEach(() => useThemeStore.setState({ mode: modo }))
  afterAll(() => useThemeStore.setState({ mode: 'system' }))

  it('muestra el stock real y lo vendido desde la última compra', () => {
    render(<ProductoCompraCard producto={{ ...base, stockActual: 108, vendidoDesdeUltimaCompra: 42 }} {...props} />)
    expect(screen.getByLabelText('Stock actual: 108')).toBeTruthy()
    expect(screen.getByLabelText('Vendido desde la última compra: 42')).toBeTruthy()
    expect(screen.getByText('Stock actual')).toBeTruthy()
    expect(screen.getByText('Vendido desde la última compra')).toBeTruthy()
  })

  it('un cero es un dato: se muestra 0, no un guion', () => {
    render(<ProductoCompraCard producto={{ ...base, stockActual: 0, vendidoDesdeUltimaCompra: 0 }} {...props} />)
    expect(screen.getByLabelText('Stock actual: 0')).toBeTruthy()
    expect(screen.getByLabelText('Vendido desde la última compra: 0')).toBeTruthy()
  })

  it('sin dato (producto nunca comprado o sin stock informado) muestra un guion', () => {
    render(<ProductoCompraCard producto={{ ...base, stockActual: null, vendidoDesdeUltimaCompra: null }} {...props} />)
    expect(screen.getByLabelText('Stock actual: sin dato')).toBeTruthy()
    expect(screen.getByLabelText('Vendido desde la última compra: sin dato')).toBeTruthy()
    expect(screen.getAllByText('—')).toHaveLength(2)
  })

  it('también se muestra con el producto ya en la compra', () => {
    const linea = { productoId: 'p1', nombre: base.nombre, cantidad: 2, unidad: 'Unidad' as const, unidadesPorUnidad: 1, costoUnitario: 100 }
    render(<ProductoCompraCard producto={{ ...base, stockActual: 5, vendidoDesdeUltimaCompra: 3 }} linea={linea} {...props} />)
    expect(screen.getByLabelText('Stock actual: 5')).toBeTruthy()
  })
})
