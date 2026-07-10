/**
 * BentoGrid / BentoItem — unit tests.
 *
 * Mocks @/libs/useResponsive to drive isSmall / isMedium / isLarge per test,
 * then inspects the rendered JSON tree to assert the resolved width string.
 * span=2 and BentoGrid container behavior are covered as regression guards.
 */

import React from 'react'
import { View } from 'react-native'
import { render } from '@testing-library/react-native'
import { BentoGrid, BentoItem } from '../BentoGrid'

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

/** Returns the flattened style array/object from a BentoItem root View. */
function itemWidth(tree: any): string {
  // BentoItem renders a single View; style is an array: [{width, marginBottom}, extraStyle?]
  const styles: Array<Record<string, unknown>> = Array.isArray(tree.props.style)
    ? tree.props.style
    : [tree.props.style]
  // First element always contains width
  return styles[0].width as string
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BentoItem — span=1 band-aware width', () => {
  it('(a) small band (width 320) → 100%', () => {
    mockUseResponsive.mockReturnValue(band(320))
    const { toJSON } = render(<BentoItem><View /></BentoItem>)
    expect(itemWidth(toJSON())).toBe('100%')
  })

  it('(b) medium band (width 400) → 48.5%', () => {
    mockUseResponsive.mockReturnValue(band(400))
    const { toJSON } = render(<BentoItem><View /></BentoItem>)
    expect(itemWidth(toJSON())).toBe('48.5%')
  })

  it('(c) large band (width 700) → 31.5%', () => {
    mockUseResponsive.mockReturnValue(band(700))
    const { toJSON } = render(<BentoItem><View /></BentoItem>)
    expect(itemWidth(toJSON())).toBe('31.5%')
  })
})

describe('BentoItem — span=2 is always 100% (all bands)', () => {
  it('(d) span=2 at small → 100%', () => {
    mockUseResponsive.mockReturnValue(band(320))
    const { toJSON } = render(<BentoItem span={2}><View /></BentoItem>)
    expect(itemWidth(toJSON())).toBe('100%')
  })

  it('(e) span=2 at medium → 100%', () => {
    mockUseResponsive.mockReturnValue(band(400))
    const { toJSON } = render(<BentoItem span={2}><View /></BentoItem>)
    expect(itemWidth(toJSON())).toBe('100%')
  })

  it('(f) span=2 at large → 100%', () => {
    mockUseResponsive.mockReturnValue(band(700))
    const { toJSON } = render(<BentoItem span={2}><View /></BentoItem>)
    expect(itemWidth(toJSON())).toBe('100%')
  })
})

describe('BentoGrid container — wrap/gap/direction untouched', () => {
  it('(g) renders children without crashing; container has flexWrap row at medium', () => {
    mockUseResponsive.mockReturnValue(band(400))
    const { toJSON } = render(
      <BentoGrid>
        <BentoItem><View /></BentoItem>
        <BentoItem><View /></BentoItem>
      </BentoGrid>,
    )
    const containerStyle = toJSON()!.props.style as Record<string, unknown>[]
    const flat = Array.isArray(containerStyle) ? Object.assign({}, ...containerStyle) : containerStyle
    expect(flat.flexDirection).toBe('row')
    expect(flat.flexWrap).toBe('wrap')
    expect(flat.justifyContent).toBe('space-between')
  })
})
