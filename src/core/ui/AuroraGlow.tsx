import React from 'react'

interface AuroraGlowProps {
  color?: string
  opacity?: number
  size?: number
  style?: any
}

/**
 * AuroraGlow — DISABLED.
 *
 * Previously rendered two infinite looping MotiView animations (a pulsing core +
 * an ambient flow) as a decorative background glow. Removed by owner request: the
 * app should be simple, functional and fast — the continuous loops were a constant
 * render/animation cost on every screen that used it (~28 call sites). Kept as a
 * no-op so existing usages keep compiling without touching each screen.
 */
export function AuroraGlow(_props: AuroraGlowProps) {
  return null
}
