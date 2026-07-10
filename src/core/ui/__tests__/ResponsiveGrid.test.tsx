/**
 * ResponsiveGrid — unit tests.
 *
 * Mocks @/libs/useResponsive to drive isSmall / isMedium / isLarge per test,
 * then inspects the rendered JSON tree to assert resolved column count and cell
 * width string. Theme tokens are mocked to avoid native module side-effects.
 */

import React from 'react'
import { View } from 'react-native'
import { render } from '@testing-library/react-native'
import { ResponsiveGrid } from '../ResponsiveGrid'

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@/libs/theme', () => ({
  tokens: {
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48 },
  },
}))

const mockUseResponsive = jest.fn()
jest.mock('@/libs/useResponsive', () => ({
  useResponsive: () => mockUseResponsive(),
}))

const band = (width: number) => ({
  width,
  height: 800,
  isSmall: width < 360,
  isMedium: width >= 360 && width < 600,
  isLarge: width >= 600,
  scale: (n: number) => n,
})

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the style object of the first cell wrapper child in the tree. */
function firstCellStyle(tree: any): Record<string, unknown> {
  return tree.children[0].props.style as Record<string, unknown>
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ResponsiveGrid', () => {
  it('(a) isSmall (width 320) — defaults to 1 column, width 100%', () => {
    mockUseResponsive.mockReturnValue(band(320))
    const { toJSON } = render(
      <ResponsiveGrid>
        <View />
        <View />
        <View />
      </ResponsiveGrid>,
    )
    expect(firstCellStyle(toJSON()).width).toBe('100%')
  })

  it('(b) isMedium (width 400) — defaults to 2 columns, width 50%', () => {
    mockUseResponsive.mockReturnValue(band(400))
    const { toJSON } = render(
      <ResponsiveGrid>
        <View />
        <View />
      </ResponsiveGrid>,
    )
    expect(firstCellStyle(toJSON()).width).toBe('50%')
  })

  it('(c) isLarge (width 700) — defaults to 3 columns', () => {
    mockUseResponsive.mockReturnValue(band(700))
    const { toJSON } = render(
      <ResponsiveGrid>
        <View />
        <View />
        <View />
      </ResponsiveGrid>,
    )
    expect(firstCellStyle(toJSON()).width).toBe(`${100 / 3}%`)
  })

  it('(d) custom columns={small:1,medium:3,large:4} at isMedium → 3 cols', () => {
    mockUseResponsive.mockReturnValue(band(400))
    const { toJSON } = render(
      <ResponsiveGrid columns={{ small: 1, medium: 3, large: 4 }}>
        <View />
        <View />
        <View />
      </ResponsiveGrid>,
    )
    expect(firstCellStyle(toJSON()).width).toBe(`${100 / 3}%`)
  })

  it('(e) cell width is a percentage string matching `${100/cols}%` (1 col at small)', () => {
    mockUseResponsive.mockReturnValue(band(320))
    const { toJSON } = render(
      <ResponsiveGrid>
        <View />
      </ResponsiveGrid>,
    )
    // Confirms the value is the string '100%' (not the number 100 or a pixel value)
    expect(firstCellStyle(toJSON()).width).toBe(`${100 / 1}%`)
  })
})
