import { View, Text, Platform } from 'react-native'
import { useColors } from '@/libs/theme'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface BandChipProps {
  /**
   * Server-computed profitability floor (lowest sellable price).
   * Null when the floor is unknown — the chip is omitted.
   */
  precioMinimoRentable: number | null
  /**
   * "Adequate" band price. Visible to cost roles only; null/absent for others.
   */
  precioAdecuado?: number | null
  /**
   * "Premium" band price. Visible to cost roles only; null/absent for others.
   */
  precioPremium?: number | null
  /**
   * CAP_VER_COSTOS del usuario (useAuthStore canSeeCosts / canViewCost(permissions)).
   * Sin ella no se dibuja ninguna banda.
   */
  puedeVerCostos: boolean
}

interface Tier {
  label: string
  value: number | null | undefined
  /** Semantic color key for this tier. */
  colorKey: 'danger' | 'warning' | 'success'
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatMoney(value: number): string {
  return value.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Presentational price-band chips for a catalog product row (PR-2e-a).
 *
 * Users with CAP_VER_COSTOS see three tiers:
 *   - Precio mínimo    → danger (red)
 *   - Precio adecuado  → warning (amber)
 *   - Precio premium   → success (green)
 * Without the capability nothing is rendered.
 *
 * A chip is omitted when its value is null. The component is 100% visual — no
 * client-side cost math; it renders the server-supplied band numbers.
 */
export function BandChip({
  precioMinimoRentable,
  precioAdecuado,
  precioPremium,
  puedeVerCostos,
}: BandChipProps) {
  const colors = useColors()

  const tiers: Tier[] = puedeVerCostos
    ? [
        { label: 'Precio mínimo', value: precioMinimoRentable, colorKey: 'danger' },
        { label: 'Precio adecuado', value: precioAdecuado, colorKey: 'warning' },
        { label: 'Precio premium', value: precioPremium, colorKey: 'success' },
      ]
    : []

  const visible = tiers.filter((t) => t.value != null)

  if (visible.length === 0) return null

  return (
    <View
      style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}
      accessible={false}
    >
      {visible.map((tier) => {
        const tintColor = colors[tier.colorKey]
        return (
          <View
            key={tier.label}
            accessible
            accessibilityLabel={`${tier.label}: $${formatMoney(tier.value as number)}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 3,
              paddingHorizontal: 7,
              paddingVertical: 3,
              borderRadius: 20,
              backgroundColor: `${tintColor}1a`,
            }}
          >
            <Text
              style={{
                color: tintColor,
                fontSize: 9,
                fontWeight: '600',
                fontFamily: Platform.OS === 'ios' ? 'Outfit' : 'sans-serif',
              }}
            >
              {tier.label}
            </Text>
            <Text
              style={{
                color: `${tintColor}99`,
                fontSize: 9,
                fontFamily: Platform.OS === 'ios' ? 'Outfit' : 'sans-serif',
              }}
            >
              $
            </Text>
            <Text
              style={{
                color: tintColor,
                fontSize: 9,
                fontWeight: '700',
                fontFamily: Platform.OS === 'ios' ? 'Outfit' : 'sans-serif',
              }}
            >
              {formatMoney(tier.value as number)}
            </Text>
          </View>
        )
      })}
    </View>
  )
}
