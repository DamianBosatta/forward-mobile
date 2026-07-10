import { useMemo } from 'react'
import { useWindowDimensions } from 'react-native'

// ── Responsive Foundation ──────────────────────────────────────────────────
// Single source of truth for breakpoints and capped scaling.
// Backed by useWindowDimensions() so it reacts to rotation, split-screen and
// font-driven relayout (replaces the stale module-scope Dimensions.get class).

export interface ResponsiveInfo {
  width: number
  height: number
  isSmall: boolean // width < 360 — iPhone SE / sub-360dp Android (the clippers)
  isMedium: boolean // 360 <= width < 600 — Galaxy A field fleet / standard phones
  isLarge: boolean // width >= 600 — tablets / foldables unfolded
  scale: (size: number) => number
}

// Capped moderate scale. The ratio is bounded to roughly -7.5%..+7.5% BEFORE
// rounding, so phone design stays intact and tablets/large screens don't blow
// spacing up. Note: Math.round quantization can shift small inputs further than
// that nominal band (e.g. scale(4) is effectively a no-op, scale(8) can move
// ±12.5%) — meaningful mostly for sizes >= 16. Intended for SPACING and fixed
// dimensions (gutters, icon boxes, FAB offsets) — NOT for font sizes.
const GUIDELINE_BASE_WIDTH = 375
const SCALE_FACTOR = 0.5
const MIN_RATIO = 0.85
const MAX_RATIO = 1.15

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function makeScale(width: number): (size: number) => number {
  const ratio = clamp(width / GUIDELINE_BASE_WIDTH, MIN_RATIO, MAX_RATIO)
  return (size: number) => Math.round(size + (size * ratio - size) * SCALE_FACTOR)
}

export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions()

  return useMemo(
    () => ({
      width,
      height,
      isSmall: width < 360,
      isMedium: width >= 360 && width < 600,
      isLarge: width >= 600,
      scale: makeScale(width),
    }),
    [width, height],
  )
}
