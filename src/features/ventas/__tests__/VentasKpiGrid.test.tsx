/**
 * VentasKpiGrid — responsive reflow unit tests (PR3).
 *
 * Structural regression guard for the highest-risk component in the sales screen.
 *
 * Covered behaviours:
 *   isSmall (width < 360): single-column stack — big card full-width, side cards
 *   each get minHeight:88, NO fixed height:180 on the wrapper.
 *
 *   medium (width 360-599): asymmetric row layout preserved — flexDirection:'row',
 *   minHeight:180 floor (not fixed height), big card keeps flex:1.4.
 *
 * Mocks:
 *   @/libs/useResponsive — controlled per test (avoids useWindowDimensions dep)
 *   moti (MotiView)       — jest.fn() stub configured in beforeAll. Factory body
 *                           intentionally omits require('react-native') to prevent
 *                           NativeWind's babel transform from injecting
 *                           _ReactNativeCSSInterop as a free variable inside a
 *                           hoisted jest.mock() factory body.
 *   expo-linear-gradient  — same pattern as moti
 *   @/core/ui (GlassCard) — same pattern as moti
 *   @/libs/theme          — minimal colour tokens (no react-native in factory)
 *   lucide-react-native   — null icon stubs
 */

import React from 'react'
import { StyleSheet } from 'react-native'
import { render } from '@testing-library/react-native'
import { VentasKpiGrid } from '../components/VentasKpiGrid'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUseResponsive = jest.fn()
jest.mock('@/libs/useResponsive', () => ({
  useResponsive: () => mockUseResponsive(),
}))

// Stub factories use jest.fn() with "mock"-prefixed variables so they are
// allowed inside hoisted bodies. require('react-native') is deferred to
// beforeAll where it runs in normal execution order — after all imports are
// resolved and after NativeWind's module-level bindings are in scope.
const mockMotiView = jest.fn()
jest.mock('moti', () => ({
  MotiView: (...args: any[]) => mockMotiView(...args),
}))

const mockLinearGradient = jest.fn()
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: (...args: any[]) => mockLinearGradient(...args),
}))

jest.mock('@/libs/theme', () => ({
  useColors: () => ({
    primary: '#00796b',
    text: '#000000',
    textMuted: '#737373',
    border: 'rgba(255,255,255,0.05)',
  }),
}))

jest.mock('lucide-react-native', () => ({
  TrendingUp: () => null,
}))

// ── Component stub implementations ─────────────────────────────────────────────
// Runs in normal order (after imports). require('react-native') is safe here
// because jest.mock() hoisting has already completed.

beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const _React = require('react') as typeof React
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { View } = require('react-native') as typeof import('react-native')

  mockMotiView.mockImplementation(
    ({ children, style, testID }: { children?: React.ReactNode; style?: any; testID?: string }) =>
      _React.createElement(View, { style, testID }, children),
  )
  mockLinearGradient.mockImplementation(
    ({ children, style }: { children?: React.ReactNode; style?: any }) =>
      _React.createElement(View, { style }, children),
  )
  // Safe default so a future test that forgets its own beforeEach renders
  // cleanly instead of crashing on `destructure of undefined`.
  mockUseResponsive.mockReturnValue(band(375))
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const band = (width: number) => ({
  width,
  height: 800,
  isSmall: width < 360,
  isMedium: width >= 360 && width < 600,
  isLarge: width >= 600,
  scale: (n: number) => n,
})

const defaultProps = {
  ordersCount: 137,
  currentMonth: 'JUN',
}

/** Merge a style prop (array or object) into a single flat object. */
function flatStyle(style: unknown): Record<string, unknown> {
  return (StyleSheet.flatten(style as any) ?? {}) as Record<string, unknown>
}

// ── Tests — small band (width 320, isSmall=true) ──────────────────────────────

describe('VentasKpiGrid — small band (width 320)', () => {
  beforeEach(() => {
    mockUseResponsive.mockReturnValue(band(320))
  })

  it('(a) renders without crashing', () => {
    const { getByTestId } = render(<VentasKpiGrid {...defaultProps} />)
    expect(getByTestId('kpi-grid-wrapper')).toBeTruthy()
  })

  it('(b) gridWrapper uses flexDirection:column and has no fixed height:180', () => {
    const { getByTestId } = render(<VentasKpiGrid {...defaultProps} />)
    const style = flatStyle(getByTestId('kpi-grid-wrapper').props.style)
    expect(style.flexDirection).toBe('column')
    // must NOT have a fixed height of 180 (was the pre-PR3 bug on sub-360 devices)
    expect(style.height).toBeUndefined()
  })

  it('(c) big card wrapper is full-width (width:100%)', () => {
    const { getByTestId } = render(<VentasKpiGrid {...defaultProps} />)
    const style = flatStyle(getByTestId('kpi-main-wrapper').props.style)
    expect(style.width).toBe('100%')
  })

  it('(d) muestra el total del servidor y ningún importe', () => {
    const { getByText, queryByText } = render(<VentasKpiGrid {...defaultProps} />)
    expect(getByText('137')).toBeTruthy()
    expect(queryByText(/\$/)).toBeNull()
  })

  it('(d2) sin total del servidor muestra un guion, no un cero', () => {
    const { getByText } = render(<VentasKpiGrid {...defaultProps} ordersCount={undefined} />)
    expect(getByText('—')).toBeTruthy()
  })
})

// ── Tests — medium band (width 390, isMedium=true) ────────────────────────────

describe('VentasKpiGrid — medium band (width 390)', () => {
  beforeEach(() => {
    mockUseResponsive.mockReturnValue(band(390))
  })

  it('(e) renders without crashing', () => {
    const { getByTestId } = render(<VentasKpiGrid {...defaultProps} />)
    expect(getByTestId('kpi-grid-wrapper')).toBeTruthy()
  })

  it('(f) gridWrapper has row layout with minHeight:180 and no fixed height', () => {
    const { getByTestId } = render(<VentasKpiGrid {...defaultProps} />)
    const style = flatStyle(getByTestId('kpi-grid-wrapper').props.style)
    expect(style.flexDirection).toBe('row')
    expect(style.minHeight).toBe(180)
    expect(style.height).toBeUndefined()
  })

  it('(g) big card wrapper preserves asymmetric flex:1.4', () => {
    const { getByTestId } = render(<VentasKpiGrid {...defaultProps} />)
    const style = flatStyle(getByTestId('kpi-main-wrapper').props.style)
    expect(style.flex).toBe(1.4)
  })

  it('(h) maxFontSizeMultiplier={1.3} is preserved on all 3 Text elements', () => {
    const { UNSAFE_getAllByProps } = render(<VentasKpiGrid {...defaultProps} />)
    const texts = UNSAFE_getAllByProps({ maxFontSizeMultiplier: 1.3 })
    // 3 Text source props (mainLabel, mainValue, footerText). UNSAFE_getAllByProps
    // double-counts composite+host nodes, so the runtime length is 6.
    expect(texts.length).toBe(6)
  })
})
