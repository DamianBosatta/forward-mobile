import { View, Text, Platform } from 'react-native'
import { useColors } from '@/libs/theme'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CarritoSemaforoProps {
  /** Effective per-unit price after discounts (server-aligned, not recomputed). */
  precioFinal: number
  /**
   * Server-computed profitability floor for this product.
   * Null when the floor is unknown — renders a neutral indicator (no false signal).
   */
  precioMinimoRentable: number | null
}

type SemaforoState = 'rentable' | 'autorizacion' | 'neutral'

// ─────────────────────────────────────────────────────────────────────────────
// Pure state derivation — compares only the two server-supplied numbers.
// NO client-side cost math.
// ─────────────────────────────────────────────────────────────────────────────

function deriveState(precioFinal: number, precioMinimoRentable: number | null): SemaforoState {
  // Unknown floor → neutral, never a false amber signal.
  if (precioMinimoRentable == null) return 'neutral'
  // Inclusive at the floor (mirrors server VERDE-at-floor).
  return precioFinal >= precioMinimoRentable ? 'rentable' : 'autorizacion'
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-line cart traffic-light (PR-2e-a).
 *
 * Compares the effective per-unit price against the server profitability floor:
 *   - precioFinal >= floor → green / "Rentable" (inclusive at the floor)
 *   - precioFinal <  floor → amber / "Requiere autorización" (routes to PendienteAutorizacion)
 *   - floor null           → neutral / grey (no false signal)
 *
 * State is conveyed by text + aria-label, not color alone (a11y).
 * 100% visual — no cost math is performed client-side.
 */
export function CarritoSemaforo({ precioFinal, precioMinimoRentable }: CarritoSemaforoProps) {
  const colors = useColors()
  const state = deriveState(precioFinal, precioMinimoRentable)

  const stateConfig = {
    rentable: {
      label: 'Rentable',
      dotColor: colors.success,
      textColor: colors.success,
    },
    autorizacion: {
      label: 'Requiere autorización',
      dotColor: colors.warning,
      textColor: colors.warning,
    },
    neutral: {
      label: 'Sin referencia de piso',
      dotColor: `${colors.textMuted}66`,
      textColor: colors.textMuted,
    },
  } as const

  const { label, dotColor, textColor } = stateConfig[state]

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
    >
      {/* Traffic-light dot */}
      <View
        accessible={false}
        style={{
          width: 7,
          height: 7,
          borderRadius: 4,
          backgroundColor: dotColor,
          flexShrink: 0,
        }}
      />
      <Text
        style={{
          color: textColor,
          fontSize: 11,
          fontWeight: '600',
          fontFamily: Platform.OS === 'ios' ? 'Outfit' : 'sans-serif',
        }}
      >
        {label}
      </Text>
    </View>
  )
}
