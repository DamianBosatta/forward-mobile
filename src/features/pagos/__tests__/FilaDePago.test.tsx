import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react-native'
import { themeColors, useThemeStore } from '@/libs/theme'
import { FilaDePago } from '../components/FilaDePago'

const pago = (factor: number) =>
  ({
    id: 'p1',
    fecha: '2026-11-10T13:30:00Z',
    monto: 25000,
    moneda: 'ARS',
    tipoNombre: 'Pago a proveedor',
    cuentaOrigenNombre: 'Caja',
    socioRazonSocial: 'Molinos SA',
    observaciones: 'Efectivo',
    factor,
    esAnulacion: false,
    estaAnulado: false,
    fuente: 'pago',
    sinMovimientoDeCaja: false,
    creadoPorNombre: 'Ana Gómez',
  }) as never

describe.each(['light', 'dark'] as const)('FilaDePago, flechas de Tesorería (%s)', (modo) => {
  const c = themeColors[modo]
  beforeEach(() => useThemeStore.setState({ mode: modo }))
  afterAll(() => useThemeStore.setState({ mode: 'system' }))

  it('la salida de dinero usa dangerFill (S5) y el texto "Sale" lo dice por escrito', () => {
    render(<FilaDePago pago={pago(-1)} primera ultima onAbrir={jest.fn()} />)
    expect(screen.UNSAFE_getByType(ArrowUpRight).props.color).toBe(c.dangerFill)
    expect(screen.getByRole('button').props.accessibilityLabel).toContain('Sale')
  })

  it('la entrada de dinero usa success', () => {
    render(<FilaDePago pago={pago(1)} primera ultima onAbrir={jest.fn()} />)
    expect(screen.UNSAFE_getByType(ArrowDownLeft).props.color).toBe(c.success)
  })
})
