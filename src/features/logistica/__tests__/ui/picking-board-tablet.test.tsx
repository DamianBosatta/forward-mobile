/**
 * PickingBoardTablet — render tests (PR5).
 *
 * Verifies:
 *   1. All three board columns render with their testIDs.
 *   2. Cards from each partition appear in the board (identified via mock testIDs).
 *   3. An empty column shows its per-column empty state; a non-empty column does not.
 *   4. All three columns show their empty states when every partition is empty.
 *
 * Mocks:
 *   @shopify/flash-list — renders all data items inline so assertions work without RN native
 *   PickingCard         — stub that renders a View with testID=card-{id} + clienteNombre Text
 *   @/libs/theme        — minimal color tokens, no native deps
 *   lucide-react-native — null stubs
 *
 * Factory bodies use jest.fn() stubs (no require('react-native') inside jest.mock()).
 * require('react-native') is deferred to beforeAll() to avoid the NativeWind hoisting issue:
 *   "The module factory of jest.mock() is not allowed to reference any out-of-scope variables."
 */

import React from 'react'
import { render } from '@testing-library/react-native'
import { PickingBoardTablet } from '../../components/picking/PickingBoardTablet'
import type { VentaPreparacion } from '@/libs/api-client/logistica'

// ── Mock factories ────────────────────────────────────────────────────────────
// jest.fn() stubs with "mock"-prefixed vars — allowed in hoisted factory bodies.

const mockFlashList = jest.fn()
jest.mock('@shopify/flash-list', () => ({
  FlashList: (...args: any[]) => mockFlashList(...args),
}))

const mockPickingCard = jest.fn()
jest.mock('@/src/features/logistica/components/picking/PickingCard', () => ({
  PickingCard: (...args: any[]) => mockPickingCard(...args),
}))

jest.mock('@/libs/theme', () => ({
  useColors: () => ({
    primary: '#00d1c1',
    textMuted: '#666666',
    border: '#e0e0e0',
  }),
  useIsDark: () => false,
}))

jest.mock('lucide-react-native', () => ({
  Package: () => null,
}))

// ── Implementation stubs (beforeAll — safe to require react-native here) ──────

beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const _React = require('react') as typeof React
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { View, Text } = require('react-native') as typeof import('react-native')

  // FlashList stub: renders all data items directly so RTL queries work.
  mockFlashList.mockImplementation(({ data, renderItem }: any) =>
    _React.createElement(
      View,
      {},
      ...(data ?? []).map((item: any, i: number) => renderItem({ item, index: i })),
    ),
  )

  // PickingCard stub: renders a View with a per-item testID + client name Text.
  mockPickingCard.mockImplementation(({ venta }: any) =>
    _React.createElement(
      View,
      { testID: `card-${venta.id}` },
      _React.createElement(Text, {}, venta.clienteNombre),
    ),
  )
})

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeVenta(id: string, estado: number, nombre: string): VentaPreparacion {
  return {
    id,
    clienteNombre: nombre,
    direccion: 'Av. Test 123',
    fechaEntrega: null,
    estado,
    metodoEntrega: 1,
    itemsCount: 2,
    version: 1,
  }
}

const defaultProps = {
  selectedConfirmadas: {},
  onToggleSelect: jest.fn(),
  onIniciar: jest.fn(),
  onMarcarPreparado: jest.fn(),
  onRevertirAConfirmada: jest.fn(),
  onEtiquetas: jest.fn(),
  onRevertirAPreparacion: jest.fn(),
  isRefetching: false,
  refetch: jest.fn(),
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PickingBoardTablet — three-column layout', () => {
  it('renders all three column containers by testID', () => {
    const { getByTestId } = render(
      <PickingBoardTablet
        {...defaultProps}
        aPreparar={[makeVenta('v1', 2, 'Cliente A')]}
        enPreparacion={[makeVenta('v2', 3, 'Cliente B')]}
        empacados={[makeVenta('v3', 4, 'Cliente C')]}
      />,
    )
    expect(getByTestId('col-a-preparar')).toBeTruthy()
    expect(getByTestId('col-en-preparacion')).toBeTruthy()
    expect(getByTestId('col-empacados')).toBeTruthy()
  })

  it('renders a card for each item in every partition', () => {
    const { getByTestId } = render(
      <PickingBoardTablet
        {...defaultProps}
        aPreparar={[makeVenta('v1', 2, 'A1'), makeVenta('v2', 2, 'A2')]}
        enPreparacion={[makeVenta('v3', 3, 'B1')]}
        empacados={[makeVenta('v4', 4, 'C1')]}
      />,
    )
    expect(getByTestId('card-v1')).toBeTruthy()
    expect(getByTestId('card-v2')).toBeTruthy()
    expect(getByTestId('card-v3')).toBeTruthy()
    expect(getByTestId('card-v4')).toBeTruthy()
  })

  it('shows per-column empty state for empty columns and not for non-empty ones', () => {
    const { getByTestId, queryByTestId } = render(
      <PickingBoardTablet
        {...defaultProps}
        aPreparar={[makeVenta('v1', 2, 'Cliente A')]}
        enPreparacion={[]}
        empacados={[]}
      />,
    )
    // Non-empty column must NOT show empty state
    expect(queryByTestId('col-a-preparar-empty')).toBeNull()
    // Empty columns DO show their individual empty state
    expect(getByTestId('col-en-preparacion-empty')).toBeTruthy()
    expect(getByTestId('col-empacados-empty')).toBeTruthy()
  })

  it('shows empty state in all three columns when every partition is empty', () => {
    const { getByTestId } = render(
      <PickingBoardTablet
        {...defaultProps}
        aPreparar={[]}
        enPreparacion={[]}
        empacados={[]}
      />,
    )
    expect(getByTestId('col-a-preparar-empty')).toBeTruthy()
    expect(getByTestId('col-en-preparacion-empty')).toBeTruthy()
    expect(getByTestId('col-empacados-empty')).toBeTruthy()
  })
})
