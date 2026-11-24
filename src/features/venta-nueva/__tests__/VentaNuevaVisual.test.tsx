import React from 'react'
import { render, screen, within } from '@testing-library/react-native'
import { ScrollView, StyleSheet } from 'react-native'
import { Pencil } from 'lucide-react-native'
import { ProductoCatalogoCard } from '../components/ProductoCatalogoCard'
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
      expect(screen.queryByText('Crédito disponible')).toBeNull()
      expect(screen.toJSON()).toBeNull()
    })
    it('con crédito visible y sin deuda vencida muestra solo el crédito', () => {
      mockSocio = { puedeVerSaldo: true, creditoDisponible: 1000, tieneDeudaVencida: false }
      render(<CreditoDeudaVenta clienteId="c1" tipo="Pedido" />)
      expect(screen.getByText('Crédito disponible')).toBeTruthy()
      expect(screen.queryByText('Deuda vencida')).toBeNull()
    })
    it('con deuda vencida y sin crédito visible muestra la deuda', () => {
      mockSocio = { puedeVerSaldo: false, tieneDeudaVencida: true, deudaVencidaAmount: 500 }
      render(<CreditoDeudaVenta clienteId="c1" tipo="Pedido" />)
      expect(screen.getByText('Deuda vencida')).toBeTruthy()
      expect(screen.queryByText('Crédito disponible')).toBeNull()
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
    })
    it('la barra de desplazamiento horizontal queda a la vista (MV-30)', () => {
      render(<TiraDeDias cab={cab} />)
      const tira = screen.UNSAFE_getByType(ScrollView)
      expect(tira.props.horizontal).toBe(true)
      expect(tira.props.showsHorizontalScrollIndicator).toBe(true)
      expect(tira.props.persistentScrollbar).toBe(true)
    })
    it('el día se escribe con el día de la semana primero: "mar" y después "24" (MV-13)', () => {
      render(<TiraDeDias cab={cab} />)
      const dia = screen.getByRole('radio', { name: 'mar 24' })
      expect(within(dia).getAllByText(/./).map((t) => t.props.children)).toEqual(['mar', '24'])
    })
  })
  describe('MV-7: stock en vivo y edición de la cantidad en la tarjeta', () => {
    const tarjeta = (cantidad: number, extra: Record<string, unknown> = {}) =>
      render(<ProductoCatalogoCard producto={producto({ id: 'p1', nombre: 'Rollo', disponible: 12 })} cantidad={cantidad} verCantidades enVivo onAbrirOferta={jest.fn()} {...extra} />)
    it('el stock se dice con texto ("Quedan 12 u · ahora") junto al punto, no solo con el color', () => {
      tarjeta(0)
      expect(screen.getByText('Quedan 12 u · ahora')).toBeTruthy()
      expect(screen.getByTestId('stock-punto-p1')).toBeTruthy()
    })
    it('sin stock el texto lo dice igual', () => {
      render(<ProductoCatalogoCard producto={producto({ id: 'p1', nombre: 'Rollo', disponible: 0 })} cantidad={0} verCantidades onAbrirOferta={jest.fn()} />)
      expect(screen.getByText('Sin stock · se puede pedir')).toBeTruthy()
    })
    it('con cantidad en el carrito, el control se llama "Editar <producto>" y lleva el lápiz junto a la cantidad', () => {
      tarjeta(3)
      const editar = screen.getByRole('button', { name: 'Editar Rollo' })
      expect(within(editar).UNSAFE_getAllByType(Pencil)).toHaveLength(1)
    })
    it('sin cantidad el control es "Añadir <producto>" y no lleva lápiz', () => {
      tarjeta(0)
      expect(screen.queryByRole('button', { name: 'Editar Rollo' })).toBeNull()
      expect(screen.UNSAFE_queryAllByType(Pencil)).toHaveLength(0)
    })
  })
})
