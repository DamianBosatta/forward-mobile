import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { TiraDeDias } from '../components/TiraDeDias'
import { CreditoDeudaVenta } from '../components/CreditoDeudaVenta'
import { CarritoFlotante, CarritoPanel } from '../components/CarritoVenta'
import { producto } from '../__testing__/producto'
import type { LineaCarrito } from '../lib/carrito'

let mockSocio: Record<string, unknown> | undefined
jest.mock('@/libs/api-client/socios', () => ({ ...jest.requireActual('@/libs/api-client/socios'), useSocio: () => ({ data: mockSocio }) }))

const linea = (id: string): LineaCarrito => ({ productoId: id, producto: producto({ id }), cantidad: 1, descuentoPct: 0 })

describe.each(['light', 'dark'] as const)('venta nueva: ajustes visuales (%s)', () => {
  describe('MV-28: ítems en singular y en plural', () => {
    it('el panel y el botón dicen "1 ítem" y "2 ítems"', () => {
      const { rerender } = render(<CarritoPanel lineas={[linea('a')]} onVerVenta={jest.fn()} />)
      expect(screen.getByText('Carrito · 1 ítem')).toBeTruthy()
      rerender(<CarritoPanel lineas={[linea('a'), linea('b')]} onVerVenta={jest.fn()} />)
      expect(screen.getByText('Carrito · 2 ítems')).toBeTruthy()
    })
    it('MV-3: la barra del teléfono se llama "Ver carrito"', () => {
      render(<CarritoFlotante lineas={[linea('a')]} onVerVenta={jest.fn()} />)
      expect(screen.getByRole('button', { name: /^Ver carrito: 1 ítem/ })).toBeTruthy()
    })
  })

  describe('MV-11: crédito y deuda', () => {
    it('sin crédito visible y sin deuda vencida no dibuja nada', () => {
      mockSocio = { puedeVerSaldo: false, tieneDeudaVencida: false }
      render(<CreditoDeudaVenta clienteId="c1" tipo="Pedido" />)
      expect(screen.queryByText('Deuda vencida')).toBeNull()
      expect(screen.queryByText('Ninguna')).toBeNull()
    })
    it('con deuda vencida la muestra con su monto', () => {
      mockSocio = { puedeVerSaldo: true, creditoDisponible: 1000, tieneDeudaVencida: true, deudaVencidaAmount: 500 }
      render(<CreditoDeudaVenta clienteId="c1" tipo="Pedido" />)
      expect(screen.getByText('Deuda vencida')).toBeTruthy()
    })
  })

  describe('MV-13 y MV-30: tira de días', () => {
    const cab = {
      cabecera: { fecha: '2026-11-25' },
      setFecha: jest.fn(),
      tira: [
        { dia: '2026-11-24', numero: 24, nombre: 'mar', habil: true, feriado: null },
        { dia: '2026-11-29', numero: 29, nombre: 'dom', habil: false, feriado: null },
      ],
    } as never
    it('el día sin entregas sale tachado y la barra de desplazamiento queda visible', () => {
      render(<TiraDeDias cab={cab} />)
      const domingo = screen.getByText('dom')
      expect(StyleSheet.flatten(domingo.props.style).textDecorationLine).toBe('line-through')
      expect(StyleSheet.flatten(screen.getByText('mar').props.style).textDecorationLine).toBeUndefined()
      expect(screen.getByText('mar').parent?.parent).toBeTruthy()
    })
  })
})
