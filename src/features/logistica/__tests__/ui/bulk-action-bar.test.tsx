/**
 * BulkActionBar — render tests.
 *
 * Verifies the core visibility contract:
 *   - selectedCount = 0  → renders null (no actions shown)
 *   - selectedCount > 0  → renders the bar with action buttons
 *
 * Follows the project pattern: mock all native/theme hooks,
 * test the one behavioral invariant that matters.
 */

import React from 'react'
import { StyleSheet } from 'react-native'
import { render } from '@testing-library/react-native'
import { BulkActionBar } from '../../components/picking/BulkActionBar'

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('@/libs/theme', () => ({
  useColors: () => ({
    primary: '#00d1c1',
    surface: '#ffffff',
    bg: '#f5f5f5',
    border: '#e0e0e0',
    text: '#000000',
    textMuted: '#666666',
    danger: '#ef4444',
  }),
  useIsDark: () => false,
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

jest.mock('@/core/utils/haptics', () => ({
  safeHaptics: {
    impact: jest.fn(),
    notification: jest.fn(),
  },
}))

// ─────────────────────────────────────────────────────────────────────────────
// Default props factory
// ─────────────────────────────────────────────────────────────────────────────

const defaultProps = {
  selectedIds: [],
  isIniciarPending: false,
  onIniciarMasiva: jest.fn(),
  onSurtidoPdf: jest.fn(),
  onEtiquetasMasivas: jest.fn(),
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('BulkActionBar — visibility contract', () => {
  it('renders nothing when selectedCount is 0', () => {
    const { toJSON } = render(
      <BulkActionBar {...defaultProps} selectedCount={0} selectedIds={[]} />,
    )
    // Component returns null → toJSON() is null
    expect(toJSON()).toBeNull()
  })

  it('renders the bar when selectedCount is 1', () => {
    const { getByText } = render(
      <BulkActionBar
        {...defaultProps}
        selectedCount={1}
        selectedIds={['abc-123']}
      />,
    )
    expect(getByText('1 seleccionada')).toBeTruthy()
  })

  it('renders the bar when selectedCount is greater than 1', () => {
    const { getByText } = render(
      <BulkActionBar
        {...defaultProps}
        selectedCount={3}
        selectedIds={['a', 'b', 'c']}
      />,
    )
    expect(getByText('3 seleccionadas')).toBeTruthy()
  })

  it('shows all three action buttons when selectedCount > 0', () => {
    const { getByText } = render(
      <BulkActionBar
        {...defaultProps}
        selectedCount={2}
        selectedIds={['x', 'y']}
      />,
    )
    expect(getByText('Iniciar')).toBeTruthy()
    expect(getByText('Surtido')).toBeTruthy()
    expect(getByText('Etiquetas')).toBeTruthy()
  })

  it('uses plural label for 2+ selected ventas', () => {
    const { getByText } = render(
      <BulkActionBar
        {...defaultProps}
        selectedCount={5}
        selectedIds={['a', 'b', 'c', 'd', 'e']}
      />,
    )
    expect(getByText('5 seleccionadas')).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// floating variant — tablet positioning (PR5)
// ─────────────────────────────────────────────────────────────────────────────

describe('BulkActionBar — floating variant', () => {
  it('renders the bar when selectedCount > 0 with variant=floating', () => {
    const { getByText } = render(
      <BulkActionBar
        {...defaultProps}
        selectedCount={2}
        selectedIds={['a', 'b']}
        variant="floating"
      />,
    )
    expect(getByText('2 seleccionadas')).toBeTruthy()
    expect(getByText('Iniciar')).toBeTruthy()
  })

  it('returns null when selectedCount is 0 regardless of variant', () => {
    const { toJSON } = render(
      <BulkActionBar
        {...defaultProps}
        selectedCount={0}
        selectedIds={[]}
        variant="floating"
      />,
    )
    expect(toJSON()).toBeNull()
  })

  it('applies borderRadius:20 and omits left/right in floating variant', () => {
    const { toJSON } = render(
      <BulkActionBar
        {...defaultProps}
        selectedCount={1}
        selectedIds={['x']}
        variant="floating"
      />,
    )
    const root = toJSON() as any
    const flat = StyleSheet.flatten(root.props.style) as Record<string, unknown>
    // Floating card must be rounded
    expect(flat.borderRadius).toBe(20)
    // Must NOT stretch edge-to-edge (no left:0 / right:0)
    expect(flat.left).toBeUndefined()
    expect(flat.right).toBeUndefined()
  })

  it('default variant keeps left:0 and right:0 (phone behavior unchanged)', () => {
    const { toJSON } = render(
      <BulkActionBar
        {...defaultProps}
        selectedCount={1}
        selectedIds={['x']}
        variant="default"
      />,
    )
    const root = toJSON() as any
    const flat = StyleSheet.flatten(root.props.style) as Record<string, unknown>
    expect(flat.left).toBe(0)
    expect(flat.right).toBe(0)
    // No borderRadius on the default full-width bar
    expect(flat.borderRadius).toBeUndefined()
  })
})
