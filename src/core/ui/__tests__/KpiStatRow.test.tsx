/**
 * KpiStatRow — unit tests (PR4).
 *
 * Verifies that KpiStatRow resolves the correct column count per responsive
 * band. Column count is reflected in the cell wrapper width string that
 * ResponsiveGrid assigns to each child slot.
 *
 * Band definitions (mirror useResponsive.ts):
 *   small  — width < 360  → 1 column  (width '100%')
 *   medium — 360 <= w < 600 → 3 columns (width '33.333...%')
 *   large  — width >= 600 → 4 columns (width '25%')
 *
 * Mocking strategy:
 *   @/libs/useResponsive — controlled per describe block via mockReturnValue.
 *   @/libs/theme          — minimal stub; no react-native access in factory to
 *                           avoid NativeWind hoisting conflicts.
 *   moti (MotiView)       — jest.fn() stub; implementation deferred to
 *                           beforeAll() so require('react-native') runs after
 *                           jest.mock() hoisting resolves.
 */

import React from 'react'
import { render } from '@testing-library/react-native'
import { KpiStatRow, KpiStat } from '../KpiStatRow'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUseResponsive = jest.fn()
jest.mock('@/libs/useResponsive', () => ({
  useResponsive: () => mockUseResponsive(),
}))

// Factory bodies must not reference `react-native` directly — NativeWind's
// babel plugin injects _ReactNativeCSSInterop as a free variable which jest
// hoisting rules forbid. Use jest.fn() placeholders; wire implementations
// in beforeAll() instead.

const mockMotiView = jest.fn()
jest.mock('moti', () => ({
  MotiView: (...args: any[]) => mockMotiView(...args),
}))

jest.mock('@/libs/theme', () => ({
  tokens: {
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48 },
  },
  useColors: () => ({
    surface: '#1a1a1a',
    text: '#f5f5f5',
    textDisabled: '#525252',
    danger: '#ef4444',
    primary: '#00796b',
  }),
  useIsDark: () => false,
}))

// ── Stub implementations (deferred — safe to require react-native here) ────────

beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const _React = require('react') as typeof React
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { View } = require('react-native') as typeof import('react-native')

  mockMotiView.mockImplementation(
    ({ children, style }: { children?: React.ReactNode; style?: any }) =>
      _React.createElement(View, { style }, children),
  )

  // Safe default so band-specific describe blocks don't crash on missing mock
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

/** Minimal icon component — avoids needing a lucide mock. */
const TestIcon = () => null

const THREE_STATS: KpiStat[] = [
  { key: 'a', label: 'A', value: '1', icon: TestIcon, color: '#00796b' },
  { key: 'b', label: 'B', value: '2', icon: TestIcon, color: '#0070f3' },
  { key: 'c', label: 'C', value: '3', icon: TestIcon, color: '#ef4444' },
]

/**
 * Returns the style of the first cell wrapper that ResponsiveGrid renders.
 * tree → outer container View → children[0] → cell View.
 */
function firstCellStyle(tree: any): Record<string, unknown> {
  return tree.children[0].props.style as Record<string, unknown>
}

// ── Tests — small band (width 320, isSmall=true) ──────────────────────────────

describe('KpiStatRow — small band (width 320)', () => {
  beforeEach(() => {
    mockUseResponsive.mockReturnValue(band(320))
  })

  it('(a) resolves 1 column — cell width is "100%"', () => {
    const { toJSON } = render(<KpiStatRow stats={THREE_STATS} />)
    expect(firstCellStyle(toJSON()).width).toBe('100%')
  })
})

// ── Tests — medium band (width 400, isMedium=true) ────────────────────────────

describe('KpiStatRow — medium band (width 400)', () => {
  beforeEach(() => {
    mockUseResponsive.mockReturnValue(band(400))
  })

  it('(b) resolves 3 columns — cell width is 33.33...%', () => {
    const { toJSON } = render(<KpiStatRow stats={THREE_STATS} />)
    expect(firstCellStyle(toJSON()).width).toBe(`${100 / 3}%`)
  })

  it('(c) renders one cell per stat (3 stats → 3 cells)', () => {
    const { toJSON } = render(<KpiStatRow stats={THREE_STATS} />)
    expect((toJSON() as any).children).toHaveLength(3)
  })
})

// ── Tests — large band (width 700, isLarge=true) ──────────────────────────────

describe('KpiStatRow — large band (width 700)', () => {
  beforeEach(() => {
    mockUseResponsive.mockReturnValue(band(700))
  })

  it('(d) resolves 4 columns — cell width is "25%"', () => {
    const { toJSON } = render(<KpiStatRow stats={THREE_STATS} />)
    expect(firstCellStyle(toJSON()).width).toBe('25%')
  })
})

// ── Tests — custom columns override ───────────────────────────────────────────

describe('KpiStatRow — custom columns prop', () => {
  it('(e) respects caller-supplied columns at medium band', () => {
    mockUseResponsive.mockReturnValue(band(400))
    const { toJSON } = render(
      <KpiStatRow
        stats={THREE_STATS}
        columns={{ small: 1, medium: 2, large: 3 }}
      />,
    )
    // medium=2 → each cell takes 50%
    expect(firstCellStyle(toJSON()).width).toBe('50%')
  })

  it('(f) alert prop does not affect column resolution', () => {
    mockUseResponsive.mockReturnValue(band(400))
    const statsWithAlert: KpiStat[] = [
      ...THREE_STATS.slice(0, 2),
      { key: 'c', label: 'C', value: '0', icon: TestIcon, color: '#ef4444', alert: true },
    ]
    const { toJSON } = render(<KpiStatRow stats={statsWithAlert} />)
    // Still 3 columns at medium band
    expect(firstCellStyle(toJSON()).width).toBe(`${100 / 3}%`)
    expect((toJSON() as any).children).toHaveLength(3)
  })
})
