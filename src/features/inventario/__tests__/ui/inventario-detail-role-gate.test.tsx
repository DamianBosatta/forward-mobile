/**
 * FASE 2 — Role-gate render tests for StockDetailSheet (mobile).
 *
 * Strategy: mount the REAL StockDetailSheet. Desde 0.2c el contenedor decide
 * `puedeVerCostos` con CAP_VER_COSTOS (no con el rol) y la hoja solo lo respeta.
 * Asserts:
 *   - Sin la capacidad no hay sección Rentabilidad, ni costo, ni bandas, ni sus etiquetas.
 *   - Con la capacidad, la sección muestra costo real y las tres bandas.
 *
 * Mirrors the web InventarioDetailSheet render tests (FASE 1).
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

describe('StockDetailSheet — Rentabilidad section gate (CAP_VER_COSTOS)', () => {
  const item = makeStockItem()
  const catalogoItem = makeCatalogoItem()

  it('sin la capacidad: no se dibuja ningún costo ni margen, ni sus etiquetas', () => {
    const { queryByTestId, queryByText } = render(
      <StockDetailSheet
        item={item}
        catalogoItem={catalogoItem}
        puedeVerCostos={false}
        visible
        onClose={jest.fn()}
      />
    )
    expect(queryByTestId('rentabilidad-section')).toBeNull()
    expect(queryByText('Rentabilidad')).toBeNull()
    expect(queryByText('Costo real')).toBeNull()
    expect(queryByText('Precio adecuado')).toBeNull()
    expect(queryByText('Precio premium')).toBeNull()
  })

  it('con la capacidad: sección con costo real y las tres bandas', () => {
    const { queryByTestId, getByText } = render(
      <StockDetailSheet
        item={item}
        catalogoItem={catalogoItem}
        puedeVerCostos
        visible
        onClose={jest.fn()}
      />
    )
    expect(queryByTestId('rentabilidad-section')).not.toBeNull()
    expect(getByText('Costo real')).toBeTruthy()
    expect(getByText('Precio mínimo')).toBeTruthy()
    expect(getByText('Precio adecuado')).toBeTruthy()
    expect(getByText('Precio premium')).toBeTruthy()
  })

  it('sheet is not rendered when item is null', () => {
    const { queryByTestId } = render(
      <StockDetailSheet
        item={null}
        catalogoItem={null}
        puedeVerCostos
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
        puedeVerCostos={false}
        visible
        onClose={jest.fn()}
      />
    )
    expect(getByText('Por entrar')).toBeTruthy()
    expect(queryByText('Virtual')).toBeNull()
  })
})
