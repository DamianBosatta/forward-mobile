/**
 * FASE 2 — Role-gate render tests for StockDetailSheet (mobile).
 *
 * Strategy: mount the REAL StockDetailSheet with real canViewCost logic.
 * Asserts:
 *   - Rentabilidad section (testID="rentabilidad-section") is NOT in tree for Empleado.
 *   - Rentabilidad section IS in tree for cost roles (Administrador, Gerencia).
 *
 * Mirrors the web InventarioDetailSheet render tests (FASE 1).
 * Non-hollow: uses real canViewCost from descuentos.ts (no inline copy).
 */

import React from 'react'
import { render } from '@testing-library/react-native'
import { StockDetailSheet } from '../../components/StockDetailSheet'
import type { StockItem } from '@/libs/api-client/types'
import type { CatalogoStockItem } from '@/libs/api-client/productos'

// ── Shared mocks ──────────────────────────────────────────────────────────────

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('expo-image', () => ({
  Image: ({ accessibilityLabel }: any) => {
    const { View } = require('react-native')
    return <View testID={`image-${accessibilityLabel}`} />
  },
}))

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: any) => {
    const { View } = require('react-native')
    return <View>{children}</View>
  },
}))

jest.mock('moti', () => ({
  MotiView: ({ children }: any) => {
    const { View } = require('react-native')
    return <View>{children}</View>
  },
}))

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => ({
  default: {
    createAnimatedComponent: (c: any) => c,
  },
  useReducedMotion: () => false,
  useSharedValue: (v: any) => ({ value: v }),
  useAnimatedStyle: () => ({}),
  withSpring: (v: any) => v,
  withRepeat: (v: any) => v,
  withSequence: (v: any) => v,
  withTiming: (v: any) => v,
  cancelAnimation: jest.fn(),
  FadeInRight: {
    delay: () => ({ springify: () => ({ damping: () => ({ stiffness: () => ({}) }) }) }),
  },
}))

// BandChip — use the REAL component (real canViewCost flows through it)
// We intentionally do NOT mock it.

jest.mock('@/core/utils/haptics', () => ({
  safeHaptics: { impact: jest.fn(), notification: jest.fn() },
}))

// StockDetailSheet now renders StockMovimientosSheet which calls useMovimientosStock.
// Mock the stock api-client to prevent react-query QueryClient errors.
jest.mock('@/libs/api-client/stock', () => ({
  useMovimientosStock: () => ({
    data: { items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasNextPage: false },
    isLoading: false,
    isError: false,
  }),
  useAjustarStock: () => ({ mutate: jest.fn(), isPending: false }),
  useStock: () => ({ data: undefined, isLoading: false }),
  useInfiniteStock: () => ({ data: undefined, isLoading: false }),
  stockKeys: { all: ['stock'], lists: () => ['stock', 'list'], list: (p: any) => ['stock', 'list', p] },
}))

// ── Test data ──────────────────────────────────────────────────────────────────

function makeStockItem(overrides: Partial<StockItem> = {}): StockItem {
  return {
    id: 'stock-1',
    productoId: 'prod-abc-123',
    producto: 'Producto Test',
    depositoId: 'dep-1',
    deposito: 'Depósito Central',
    cantidadActual: 42,
    cantidadVirtual: 3,
    cantidadTransito: 0,
    cantidadReservada: 2,
    cantidadDisponible: 40,
    stockMinimo: 10,
    enAlerta: false,
    activo: true,
    imageUrl: null,
    precioVenta: 1500,
    ...overrides,
  } as StockItem
}

function makeCatalogoItem(): CatalogoStockItem {
  return {
    id: 'prod-abc-123',
    nombre: 'Producto Test',
    precioVenta: 1500,
    precioMinimoRentable: 800,
    precioAdecuado: 1000,
    precioPremium: 1400,
    costoRealPricing: 700,
    precioCompraBase: 650,
    deposito: 40,
    reservado: 2,
    real: 42,
    virtual: 3,
  } as CatalogoStockItem
}

// ─────────────────────────────────────────────────────────────────────────────
// Rentabilidad section — role gating
// ─────────────────────────────────────────────────────────────────────────────

describe('StockDetailSheet — Rentabilidad section role gate', () => {
  const item = makeStockItem()
  const catalogoItem = makeCatalogoItem()

  it('Empleado: Rentabilidad section is NOT rendered', () => {
    const { queryByTestId } = render(
      <StockDetailSheet
        item={item}
        catalogoItem={catalogoItem}
        userRoles={['Empleado']}
        visible
        onClose={jest.fn()}
      />
    )
    expect(queryByTestId('rentabilidad-section')).toBeNull()
  })

  it('Empleado role (non-cost): Rentabilidad section is NOT rendered', () => {
    const { queryByTestId } = render(
      <StockDetailSheet
        item={item}
        catalogoItem={catalogoItem}
        userRoles={['Empleado']}
        visible
        onClose={jest.fn()}
      />
    )
    expect(queryByTestId('rentabilidad-section')).toBeNull()
  })

  it('empty roles: Rentabilidad section is NOT rendered', () => {
    const { queryByTestId } = render(
      <StockDetailSheet
        item={item}
        catalogoItem={catalogoItem}
        userRoles={[]}
        visible
        onClose={jest.fn()}
      />
    )
    expect(queryByTestId('rentabilidad-section')).toBeNull()
  })

  it('Administrador: Rentabilidad section IS rendered', () => {
    const { queryByTestId } = render(
      <StockDetailSheet
        item={item}
        catalogoItem={catalogoItem}
        userRoles={['Administrador']}
        visible
        onClose={jest.fn()}
      />
    )
    expect(queryByTestId('rentabilidad-section')).not.toBeNull()
  })

  it('Gerencia: Rentabilidad section IS rendered', () => {
    const { queryByTestId } = render(
      <StockDetailSheet
        item={item}
        catalogoItem={catalogoItem}
        userRoles={['Gerencia']}
        visible
        onClose={jest.fn()}
      />
    )
    expect(queryByTestId('rentabilidad-section')).not.toBeNull()
  })

  it('AdministradorSistemas: Rentabilidad section IS rendered', () => {
    const { queryByTestId } = render(
      <StockDetailSheet
        item={item}
        catalogoItem={catalogoItem}
        userRoles={['AdministradorSistemas']}
        visible
        onClose={jest.fn()}
      />
    )
    expect(queryByTestId('rentabilidad-section')).not.toBeNull()
  })

  it('sheet is not rendered when item is null', () => {
    const { queryByTestId } = render(
      <StockDetailSheet
        item={null}
        catalogoItem={null}
        userRoles={['Administrador']}
        visible
        onClose={jest.fn()}
      />
    )
    expect(queryByTestId('rentabilidad-section')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Disponibilidad labels — "Por entrar" must be shown (never "Virtual")
// ─────────────────────────────────────────────────────────────────────────────

describe('StockDetailSheet — Disponibilidad labels', () => {
  it('shows "Por entrar" label, never "Virtual"', () => {
    const item = makeStockItem({ cantidadVirtual: 5 })
    const { getByText, queryByText } = render(
      <StockDetailSheet
        item={item}
        catalogoItem={null}
        userRoles={[]}
        visible
        onClose={jest.fn()}
      />
    )
    expect(getByText('Por entrar')).toBeTruthy()
    expect(queryByText('Virtual')).toBeNull()
  })
})
