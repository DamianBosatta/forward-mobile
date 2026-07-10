/**
 * StockListRow — compact list-view row tests (Slice 6, mobile).
 *
 * Asserts:
 *   1. Renders product name, código propio, stock real, stock mínimo and precio.
 *   2. Tapping the row calls onOpenDetail.
 *   3. Alert icon/label color reflects enAlerta (no separate "Agotado" text — that's
 *      StockCard's job; the list row just needs to visually flag the row).
 */

import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { StockListRow } from '../../components/StockListRow'
import type { StockItem } from '@/libs/api-client/types'

jest.mock('expo-image', () => ({
  Image: () => null,
}))

jest.mock('@/core/utils/haptics', () => ({
  safeHaptics: { impact: jest.fn(), notification: jest.fn() },
}))

jest.mock('@/libs/api-client', () => ({
  getFullImageUrl: (url: string) => url,
}))

function makeItem(overrides: Partial<StockItem> = {}): StockItem {
  return {
    id: 'stock-1',
    productoId: 'prod-abc-123',
    producto: 'Producto Test',
    codigoPropio: '000042',
    depositoId: 'dep-1',
    deposito: 'Depósito Central',
    cantidadActual: 30,
    cantidadVirtual: 2,
    cantidadTransito: 0,
    cantidadReservada: 5,
    cantidadDisponible: 25,
    stockMinimo: 10,
    enAlerta: false,
    activo: true,
    imageUrl: null,
    precioVenta: 1500,
    ...overrides,
  } as StockItem
}

describe('StockListRow — rendering', () => {
  it('renders the product name', () => {
    const { getByText } = render(<StockListRow item={makeItem()} onOpenDetail={jest.fn()} />)
    expect(getByText('Producto Test')).toBeTruthy()
  })

  it('renders the código propio and depósito as a subtitle', () => {
    const { getByText } = render(<StockListRow item={makeItem()} onOpenDetail={jest.fn()} />)
    expect(getByText('#000042 · Depósito Central')).toBeTruthy()
  })

  it('renders the stock real number', () => {
    const { getByText } = render(<StockListRow item={makeItem({ cantidadActual: 77 })} onOpenDetail={jest.fn()} />)
    expect(getByText('77')).toBeTruthy()
  })

  it('renders the stock mínimo with a "mín." prefix', () => {
    const { getByText } = render(<StockListRow item={makeItem({ stockMinimo: 12 })} onOpenDetail={jest.fn()} />)
    expect(getByText('mín. 12')).toBeTruthy()
  })

  it('renders the precio formatted with a $ prefix', () => {
    const { getByText } = render(<StockListRow item={makeItem({ precioVenta: 2500 })} onOpenDetail={jest.fn()} />)
    // es-AR uses "." as the thousands separator (matches formatNumber conventions
    // elsewhere in the app, e.g. InventarioDetailSheet's toLocaleString('es-AR')).
    expect(getByText('$2.500')).toBeTruthy()
  })
})

describe('StockListRow — tap behavior', () => {
  it('calls onOpenDetail when the row is pressed', () => {
    const onOpenDetail = jest.fn()
    const { getByRole } = render(<StockListRow item={makeItem()} onOpenDetail={onOpenDetail} />)

    fireEvent.press(getByRole('button', { name: /Producto Test/ }))

    expect(onOpenDetail).toHaveBeenCalledTimes(1)
  })
})

describe('StockListRow — alert state', () => {
  it('includes "en alerta" in the accessibility label when enAlerta=true', () => {
    const { getByRole } = render(
      <StockListRow item={makeItem({ enAlerta: true })} onOpenDetail={jest.fn()} />,
    )
    expect(getByRole('button', { name: /en alerta/ })).toBeTruthy()
  })

  it('does NOT include "en alerta" in the accessibility label when enAlerta=false', () => {
    const { getByRole } = render(
      <StockListRow item={makeItem({ enAlerta: false })} onOpenDetail={jest.fn()} />,
    )
    expect(getByRole('button', { name: 'Producto Test, stock 30 unidades' })).toBeTruthy()
  })
})
