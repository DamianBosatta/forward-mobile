/**
 * FASE 3 — StockMovimientosSheet and StockDetailSheet movement affordance tests (mobile).
 *
 * Non-hollow: mounts the REAL components.
 * Asserts:
 *   - StockMovimientosSheet renders movement rows when data is available.
 *   - Tipo labels (Compra, Venta, Ajuste) appear in the rendered tree.
 *   - Signed cantidades are shown.
 *   - Observaciones are shown.
 *   - Empty state renders when no movements.
 *   - Loading state renders while fetching.
 *   - StockDetailSheet includes the "ver movimientos" button (testID="ver-movimientos-btn").
 */

import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import type { StockItem } from '@/libs/api-client/types'
import type { MovimientoStockHistorialDto } from '@/libs/api-client/types'
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

jest.mock('@/core/utils/haptics', () => ({
  safeHaptics: { impact: jest.fn(), notification: jest.fn() },
}))

// ── Mock useMovimientosStock ──────────────────────────────────────────────────

const mockUseMovimientosStock = jest.fn()
jest.mock('@/libs/api-client/stock', () => ({
  useMovimientosStock: (...args: any[]) => mockUseMovimientosStock(...args),
  useAjustarStock: () => ({ mutate: jest.fn(), isPending: false }),
  useStock: () => ({ data: undefined, isLoading: false }),
  useInfiniteStock: () => ({ data: undefined, isLoading: false }),
}))

// ─────────────────────────────────────────────────────────────────────────────
// Test data
// ─────────────────────────────────────────────────────────────────────────────

const stubMovimientos: MovimientoStockHistorialDto[] = [
  {
    id: 'mov-1',
    fecha: '2026-06-01T10:00:00Z',
    tipoMovimiento: 1,
    tipoLabel: 'Compra',
    cantidad: 50,
    direccion: 'Entrada',
    observacion: 'Reposición Q2',
    usuarioNombre: 'Juan Pérez',
  },
  {
    id: 'mov-2',
    fecha: '2026-06-02T14:30:00Z',
    tipoMovimiento: 2,
    tipoLabel: 'Venta',
    cantidad: -10,        // backend negates SP-stored absolute positive
    direccion: 'Salida',  // outbound — must render as negative, red
    observacion: 'Venta mostrador',
    usuarioNombre: 'Ana García',
  },
  {
    id: 'mov-3',
    fecha: '2026-06-03T09:00:00Z',
    tipoMovimiento: 4,
    tipoLabel: 'Ajuste',
    cantidad: -5,
    direccion: 'Salida',
    observacion: 'Rotura en almacén',
    usuarioNombre: 'Sistema',
  },
]

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
// StockMovimientosSheet — render tests
// ─────────────────────────────────────────────────────────────────────────────

import { StockMovimientosSheet } from '../../components/StockMovimientosSheet'

describe('StockMovimientosSheet — renders movements', () => {
  beforeEach(() => {
    mockUseMovimientosStock.mockReturnValue({
      data: {
        items: stubMovimientos,
        page: 1,
        pageSize: 20,
        totalCount: 3,
        totalPages: 1,
        hasNextPage: false,
      },
      isLoading: false,
      isError: false,
    })
  })

  it('renders the movements list when visible', () => {
    const { getByTestId } = render(
      <StockMovimientosSheet
        productoId="prod-abc-123"
        productoNombre="Producto Test"
        visible
        onClose={jest.fn()}
      />
    )

    expect(getByTestId('movimientos-list')).toBeTruthy()
  })

  it('renders tipo labels from the data', () => {
    const { getByText } = render(
      <StockMovimientosSheet
        productoId="prod-abc-123"
        productoNombre="Producto Test"
        visible
        onClose={jest.fn()}
      />
    )

    expect(getByText('Compra')).toBeTruthy()
    expect(getByText('Venta')).toBeTruthy()
    expect(getByText('Ajuste')).toBeTruthy()
  })

  it('renders signed cantidades', () => {
    const { getByText } = render(
      <StockMovimientosSheet
        productoId="prod-abc-123"
        productoNombre="Producto Test"
        visible
        onClose={jest.fn()}
      />
    )

    expect(getByText('+50')).toBeTruthy()
    expect(getByText('-10')).toBeTruthy()
    expect(getByText('-5')).toBeTruthy()
  })

  it('renders observaciones', () => {
    const { getByText } = render(
      <StockMovimientosSheet
        productoId="prod-abc-123"
        productoNombre="Producto Test"
        visible
        onClose={jest.fn()}
      />
    )

    expect(getByText('Reposición Q2')).toBeTruthy()
    expect(getByText('Venta mostrador')).toBeTruthy()
  })

  it('renders usuario nombres', () => {
    const { getByText } = render(
      <StockMovimientosSheet
        productoId="prod-abc-123"
        productoNombre="Producto Test"
        visible
        onClose={jest.fn()}
      />
    )

    expect(getByText('Juan Pérez')).toBeTruthy()
    expect(getByText('Ana García')).toBeTruthy()
  })

  it('Venta movement renders as negative cantidad (Fix B — direction correctness)', () => {
    // A Venta must NEVER render as "+10" (green, looks like stock went up).
    // Backend returns cantidad=-10 for Venta (semantic negation applied server-side).
    const { getByText, queryByText } = render(
      <StockMovimientosSheet
        productoId="prod-abc-123"
        productoNombre="Producto Test"
        visible
        onClose={jest.fn()}
      />
    )

    expect(getByText('-10')).toBeTruthy()
    expect(queryByText('+10')).toBeNull()
  })
})

describe('StockMovimientosSheet — empty state', () => {
  it('shows empty state when no movements', () => {
    mockUseMovimientosStock.mockReturnValue({
      data: { items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasNextPage: false },
      isLoading: false,
      isError: false,
    })

    const { getByText } = render(
      <StockMovimientosSheet
        productoId="prod-abc-123"
        productoNombre="Producto Test"
        visible
        onClose={jest.fn()}
      />
    )

    expect(getByText(/no hay movimientos/i)).toBeTruthy()
  })
})

describe('StockMovimientosSheet — loading state', () => {
  it('shows loading state while fetching', () => {
    mockUseMovimientosStock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    })

    const { getByText } = render(
      <StockMovimientosSheet
        productoId="prod-abc-123"
        productoNombre="Producto Test"
        visible
        onClose={jest.fn()}
      />
    )

    expect(getByText(/cargando historial/i)).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// StockDetailSheet — ver movimientos button
// ─────────────────────────────────────────────────────────────────────────────

import { StockDetailSheet } from '../../components/StockDetailSheet'

describe('StockDetailSheet — ver movimientos affordance', () => {
  beforeEach(() => {
    mockUseMovimientosStock.mockReturnValue({
      data: { items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasNextPage: false },
      isLoading: false,
      isError: false,
    })
  })

  it('renders the ver-movimientos button', () => {
    const item = makeStockItem()
    const catalogoItem = makeCatalogoItem()

    const { getByTestId } = render(
      <StockDetailSheet
        item={item}
        catalogoItem={catalogoItem}
        userRoles={['Administrador']}
        visible
        onClose={jest.fn()}
      />
    )

    expect(getByTestId('ver-movimientos-btn')).toBeTruthy()
  })

  it('ver movimientos button has correct accessibility label', () => {
    const item = makeStockItem()

    const { getByTestId } = render(
      <StockDetailSheet
        item={item}
        catalogoItem={null}
        userRoles={['Vendedor']}
        visible
        onClose={jest.fn()}
      />
    )

    const btn = getByTestId('ver-movimientos-btn')
    expect(btn.props.accessibilityLabel).toMatch(/ver movimientos de/i)
  })
})
