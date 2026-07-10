/**
 * FASE 2 — Tap isolation tests for StockCard (mobile).
 *
 * Asserts:
 *   1. Tapping the CARD BODY calls onOpenDetail and does NOT call onOpenAjuste/onOpenToggle.
 *   2. Tapping "AJUSTAR STOCK" calls onOpenAjuste and does NOT call onOpenDetail.
 *   3. Tapping the toggle-status button calls onOpenToggle and does NOT call onOpenDetail.
 *
 * Uses the REAL StockCard component with testIDs on the action buttons.
 * Non-hollow: exercises the real Pressable + TouchableOpacity handler chain.
 */

import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { StockCard } from '../../components/StockCard'
import type { StockItem } from '@/libs/api-client/types'

// ── Module mocks ──────────────────────────────────────────────────────────────

jest.mock('expo-image', () => ({
  Image: () => null,
}))

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: any) => {
    const { View } = require('react-native')
    return <View>{children}</View>
  },
}))

// Mock react-native-reanimated completely
jest.mock('react-native-reanimated', () => {
  const Animated = require('react-native').Animated
  const { View } = require('react-native')

  return {
    default: {
      createAnimatedComponent: (c: any) => c,
      View,
    },
    useReducedMotion: () => true, // disable animations in tests
    useSharedValue: (v: any) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: any) => v,
    withRepeat: (v: any) => v,
    withSequence: (v: any) => v,
    withTiming: (v: any) => v,
    cancelAnimation: jest.fn(),
    FadeInRight: {
      delay: () => ({
        springify: () => ({ damping: () => ({ stiffness: () => ({}) }) }),
      }),
    },
    // Animated.View passthrough
    View,
  }
})

jest.mock('@/core/utils/haptics', () => ({
  safeHaptics: { impact: jest.fn(), notification: jest.fn() },
}))

jest.mock('@/core/auth/RequirePermission', () => ({
  usePermissions: () => ({
    canUpdate: () => true, // canModify = true so action buttons render
    canRead: () => true,
    canCreate: () => true,
    canDelete: () => true,
    isAdmin: () => false,
    hasRole: () => false,
    roles: ['Administrador'],
  }),
}))

jest.mock('@/libs/api-client', () => ({
  getFullImageUrl: (url: string) => url,
}))

// ── Test data ──────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<StockItem> = {}): StockItem {
  return {
    id: 'stock-1',
    productoId: 'prod-abc-123',
    producto: 'Producto Test',
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
    precioVenta: 1000,
    ...overrides,
  } as StockItem
}

// ─────────────────────────────────────────────────────────────────────────────
// Tap isolation
// ─────────────────────────────────────────────────────────────────────────────

describe('StockCard — tap isolation', () => {
  it('tapping the card body calls onOpenDetail and does NOT call onOpenAjuste or onOpenToggle', () => {
    const onOpenDetail = jest.fn()
    const onOpenAjuste = jest.fn()
    const onOpenToggle = jest.fn()

    const { getByRole } = render(
      <StockCard
        item={makeItem()}
        onOpenDetail={onOpenDetail}
        onOpenAjuste={onOpenAjuste}
        onOpenToggle={onOpenToggle}
      />
    )

    // Card body has accessibilityRole="button" with the product name in the label
    const cardBody = getByRole('button', { name: /Producto Test/ })
    fireEvent.press(cardBody)

    expect(onOpenDetail).toHaveBeenCalledTimes(1)
    expect(onOpenAjuste).not.toHaveBeenCalled()
    expect(onOpenToggle).not.toHaveBeenCalled()
  })

  it('tapping "AJUSTAR STOCK" button calls onOpenAjuste and does NOT call onOpenDetail', () => {
    const onOpenDetail = jest.fn()
    const onOpenAjuste = jest.fn()
    const onOpenToggle = jest.fn()

    const { getByTestId } = render(
      <StockCard
        item={makeItem()}
        onOpenDetail={onOpenDetail}
        onOpenAjuste={onOpenAjuste}
        onOpenToggle={onOpenToggle}
      />
    )

    fireEvent.press(getByTestId('ajustar-stock-btn'))

    expect(onOpenAjuste).toHaveBeenCalledTimes(1)
    expect(onOpenDetail).not.toHaveBeenCalled()
  })

  it('tapping toggle-status button calls onOpenToggle and does NOT call onOpenDetail', () => {
    const onOpenDetail = jest.fn()
    const onOpenAjuste = jest.fn()
    const onOpenToggle = jest.fn()

    const { getByTestId } = render(
      <StockCard
        item={makeItem()}
        onOpenDetail={onOpenDetail}
        onOpenAjuste={onOpenAjuste}
        onOpenToggle={onOpenToggle}
      />
    )

    fireEvent.press(getByTestId('toggle-status-btn'))

    expect(onOpenToggle).toHaveBeenCalledTimes(1)
    expect(onOpenDetail).not.toHaveBeenCalled()
  })

  it('tapping toggle-status on inactive item still calls onOpenToggle, not onOpenDetail', () => {
    const onOpenDetail = jest.fn()
    const onOpenToggle = jest.fn()

    const { getByTestId } = render(
      <StockCard
        item={makeItem({ activo: false })}
        onOpenDetail={onOpenDetail}
        onOpenAjuste={jest.fn()}
        onOpenToggle={onOpenToggle}
      />
    )

    fireEvent.press(getByTestId('toggle-status-btn'))

    expect(onOpenToggle).toHaveBeenCalledTimes(1)
    expect(onOpenDetail).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Alert state rendering
// ─────────────────────────────────────────────────────────────────────────────

describe('StockCard — alert state rendering', () => {
  it('renders alert label text when enAlerta=true', () => {
    const { getByText } = render(
      <StockCard
        item={makeItem({ enAlerta: true, cantidadDisponible: 3, stockMinimo: 10 })}
        onOpenDetail={jest.fn()}
        onOpenAjuste={jest.fn()}
        onOpenToggle={jest.fn()}
      />
    )
    // Should show "Stock bajo" (not agotado since disponible=3 > 0)
    expect(getByText('Stock bajo')).toBeTruthy()
  })

  it('renders "Agotado" text when disponible is 0 and enAlerta=true', () => {
    const { getByText } = render(
      <StockCard
        item={makeItem({ enAlerta: true, cantidadDisponible: 0 })}
        onOpenDetail={jest.fn()}
        onOpenAjuste={jest.fn()}
        onOpenToggle={jest.fn()}
      />
    )
    expect(getByText('Agotado')).toBeTruthy()
  })

  it('does NOT render alert label when enAlerta=false', () => {
    const { queryByText } = render(
      <StockCard
        item={makeItem({ enAlerta: false })}
        onOpenDetail={jest.fn()}
        onOpenAjuste={jest.fn()}
        onOpenToggle={jest.fn()}
      />
    )
    expect(queryByText('Stock bajo')).toBeNull()
    expect(queryByText('Agotado')).toBeNull()
  })

  it('renders the stock real number prominently', () => {
    const { getByText } = render(
      <StockCard
        item={makeItem({ cantidadActual: 77 })}
        onOpenDetail={jest.fn()}
        onOpenAjuste={jest.fn()}
        onOpenToggle={jest.fn()}
      />
    )
    expect(getByText('77')).toBeTruthy()
  })
})
