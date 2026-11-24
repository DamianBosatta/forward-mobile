import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { TarjetaDeProducto } from '../components/TarjetaDeStock'
import type { StockItem } from '@/libs/api-client/types'

jest.mock('expo-image', () => ({ Image: () => null }))

const item = (extra: Record<string, unknown>) =>
  ({ id: 's1', productoId: 'p1', producto: 'Make Lavajean', codigoPropio: 'PRO1', ...extra }) as unknown as StockItem

describe('TarjetaDeProducto: same stock rule as the list row', () => {
  it('0 available says "Sin stock" even when the server flags it as alert', () => {
    render(<TarjetaDeProducto item={item({ cantidadDisponible: 0, enAlerta: true })} onPress={jest.fn()} />)
    expect(screen.getByText('un. · Sin stock')).toBeTruthy()
    expect(screen.queryByText('un. · En alerta')).toBeNull()
    expect(screen.queryByText(/disponibles?$/)).toBeNull()
  })

  it('stock above 0 flagged as alert still says "En alerta"', () => {
    render(<TarjetaDeProducto item={item({ cantidadDisponible: 8, enAlerta: true })} onPress={jest.fn()} />)
    expect(screen.getByText('un. · En alerta')).toBeTruthy()
    expect(screen.queryByText('un. · Sin stock')).toBeNull()
  })

  it('healthy stock says "disponible"', () => {
    render(<TarjetaDeProducto item={item({ cantidadDisponible: 50, enAlerta: false })} onPress={jest.fn()} />)
    expect(screen.getByText('un. disponibles')).toBeTruthy()
  })
})
