/**
 * ResponsiveRow — unit tests.
 *
 * Mocks @/libs/useResponsive to drive isSmall / isMedium / isLarge per test,
 * then inspects the rendered container's flexDirection. Theme is not imported
 * by ResponsiveRow (it uses a literal gap default) so no theme mock needed.
 */

import React from 'react'
import { View } from 'react-native'
import { render } from '@testing-library/react-native'
import { ResponsiveRow } from '../ResponsiveRow'

// ── Mocks ─────────────────────────────────────────────────────────────────────

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

/** Returns the container style object from the rendered tree root. */
function containerStyle(tree: any): Record<string, unknown> {
  return tree.props.style as Record<string, unknown>
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ResponsiveRow', () => {
  it('isSmall (width 320) — stacks to column', () => {
    mockUseResponsive.mockReturnValue(band(320))
    const { toJSON } = render(
      <ResponsiveRow>
        <View />
        <View />
      </ResponsiveRow>,
    )
    expect(containerStyle(toJSON()).flexDirection).toBe('column')
  })

  it('isMedium (width 400) — renders as row', () => {
    mockUseResponsive.mockReturnValue(band(400))
    const { toJSON } = render(
      <ResponsiveRow>
        <View />
        <View />
      </ResponsiveRow>,
    )
    expect(containerStyle(toJSON()).flexDirection).toBe('row')
  })

  it('isLarge (width 700) — renders as row', () => {
    mockUseResponsive.mockReturnValue(band(700))
    const { toJSON } = render(
      <ResponsiveRow>
        <View />
        <View />
      </ResponsiveRow>,
    )
    expect(containerStyle(toJSON()).flexDirection).toBe('row')
  })

  it('stackOn="smallMedium" at isMedium (width 400) — stacks to column', () => {
    mockUseResponsive.mockReturnValue(band(400))
    const { toJSON } = render(
      <ResponsiveRow stackOn="smallMedium">
        <View />
        <View />
      </ResponsiveRow>,
    )
    expect(containerStyle(toJSON()).flexDirection).toBe('column')
  })
})
