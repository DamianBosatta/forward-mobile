/**
 * PickingDateFilter — unit tests (PR6).
 *
 * Verifies:
 *   1. Renders "Desde" / "Hasta" placeholders when no dates are set.
 *   2. Renders the formatted date when fechaDesde is provided.
 *   3. Clear button is absent when no dates are set.
 *   4. Clear button is present when a date is set; pressing it fires both null callbacks.
 *   5. Pressing "Fecha desde" opens the picker; DTP onChange fires onFechaDesdeChange.
 *   6. Pressing "Fecha hasta" opens the picker; DTP onChange fires onFechaHastaChange.
 *
 * Platform.OS is forced to 'android' so the DateTimePicker renders inline
 * (gated by `activePicker !== null`) rather than inside a Modal — this keeps
 * tests simple without needing to deal with Modal visibility semantics.
 *
 * Factory bodies use jest.fn() stubs (no require('react-native') inside jest.mock()).
 * require('react-native') is deferred to beforeAll() to avoid the NativeWind hoisting
 * issue: "The module factory of jest.mock() is not allowed to reference out-of-scope variables."
 */

import React from 'react'
import { Platform } from 'react-native'
import { render, fireEvent } from '@testing-library/react-native'
import { PickingDateFilter } from '../../components/picking/PickingDateFilter'

// ── Mock factories ────────────────────────────────────────────────────────────

const mockDTP = jest.fn()
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: (...args: any[]) => mockDTP(...args),
}))

jest.mock('@/libs/theme', () => ({
  useColors: () => ({
    primary: '#00d1c1',
    surface: '#1a1a1a',
    text: '#ffffff',
    textMuted: '#888888',
    border: '#333333',
    danger: '#ef4444',
  }),
}))

jest.mock('lucide-react-native', () => ({
  Calendar: () => null,
  X: () => null,
}))

// ── Stubs (beforeAll) ─────────────────────────────────────────────────────────
// Deferred require to avoid NativeWind/jest hoisting conflict.

const TEST_DATE = new Date(2024, 0, 15) // 15 Jan 2024 — used in DTP onChange stub

beforeAll(() => {
  // Force Android path for all tests in this file: inline picker, no Modal.
  ;(Platform as any).OS = 'android'

  const _React = require('react') as typeof React
  const { Pressable } = require('react-native') as typeof import('react-native')

  // DTP stub: renders a Pressable that immediately fires onChange with TEST_DATE when pressed.
  // This simulates the user picking a date on Android.
  mockDTP.mockImplementation(({ onChange }: { onChange: (e: unknown, d?: Date) => void }) =>
    _React.createElement(Pressable, {
      testID: 'mock-dtp',
      onPress: () => onChange({}, TEST_DATE),
    }),
  )
})

// ── Fixtures ──────────────────────────────────────────────────────────────────

const noop = jest.fn()

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PickingDateFilter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders "Desde" and "Hasta" placeholders when no dates are set', () => {
    const { getByText } = render(
      <PickingDateFilter
        fechaDesde={null}
        fechaHasta={null}
        onFechaDesdeChange={noop}
        onFechaHastaChange={noop}
      />,
    )
    expect(getByText('Desde')).toBeTruthy()
    expect(getByText('Hasta')).toBeTruthy()
  })

  it('renders the formatted date text when fechaDesde is provided', () => {
    const date = new Date(2024, 2, 5) // 5 Mar 2024
    const formatted = date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    const { getByText, queryByText } = render(
      <PickingDateFilter
        fechaDesde={date}
        fechaHasta={null}
        onFechaDesdeChange={noop}
        onFechaHastaChange={noop}
      />,
    )
    expect(getByText(formatted)).toBeTruthy()
    expect(queryByText('Desde')).toBeNull()
  })

  it('does not render the clear button when no dates are set', () => {
    const { queryByTestId } = render(
      <PickingDateFilter
        fechaDesde={null}
        fechaHasta={null}
        onFechaDesdeChange={noop}
        onFechaHastaChange={noop}
      />,
    )
    expect(queryByTestId('date-filter-clear')).toBeNull()
  })

  it('renders the clear button when a date is set; pressing it calls both onChange(null)', () => {
    const onDesde = jest.fn()
    const onHasta = jest.fn()
    const { getByTestId } = render(
      <PickingDateFilter
        fechaDesde={new Date(2024, 0, 1)}
        fechaHasta={null}
        onFechaDesdeChange={onDesde}
        onFechaHastaChange={onHasta}
      />,
    )
    const clearBtn = getByTestId('date-filter-clear')
    expect(clearBtn).toBeTruthy()
    fireEvent.press(clearBtn)
    expect(onDesde).toHaveBeenCalledTimes(1)
    expect(onDesde).toHaveBeenCalledWith(null)
    expect(onHasta).toHaveBeenCalledTimes(1)
    expect(onHasta).toHaveBeenCalledWith(null)
  })

  it('pressing "Fecha desde" opens the picker; DTP onChange fires onFechaDesdeChange', () => {
    const onDesde = jest.fn()
    const { getByLabelText, getByTestId, queryByTestId } = render(
      <PickingDateFilter
        fechaDesde={null}
        fechaHasta={null}
        onFechaDesdeChange={onDesde}
        onFechaHastaChange={noop}
      />,
    )
    // DTP not yet visible (activePicker === null)
    expect(queryByTestId('mock-dtp')).toBeNull()

    // Open picker
    fireEvent.press(getByLabelText('Fecha desde'))

    // DTP now renders inline (Android path)
    const dtp = getByTestId('mock-dtp')
    expect(dtp).toBeTruthy()

    // Simulate user selecting TEST_DATE
    fireEvent.press(dtp)
    expect(onDesde).toHaveBeenCalledTimes(1)
    expect(onDesde).toHaveBeenCalledWith(TEST_DATE)
  })

  it('pressing "Fecha hasta" opens the picker; DTP onChange fires onFechaHastaChange', () => {
    const onHasta = jest.fn()
    const { getByLabelText, getByTestId } = render(
      <PickingDateFilter
        fechaDesde={null}
        fechaHasta={null}
        onFechaDesdeChange={noop}
        onFechaHastaChange={onHasta}
      />,
    )
    fireEvent.press(getByLabelText('Fecha hasta'))
    fireEvent.press(getByTestId('mock-dtp'))
    expect(onHasta).toHaveBeenCalledTimes(1)
    expect(onHasta).toHaveBeenCalledWith(TEST_DATE)
  })
})
