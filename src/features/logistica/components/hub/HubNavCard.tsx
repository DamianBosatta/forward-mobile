import React from 'react'
import { TouchableOpacity, View, Text } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { GlassCard } from '@/core/ui'
import { useColors, tokens } from '@/libs/theme'
import { safeHaptics } from '@/core/utils/haptics'

export interface HubNavCardProps {
  title: string
  subtitle?: string
  icon: LucideIcon
  iconColor?: string
  onPress: () => void
  /** When false the card is not rendered at all (RBAC gating). */
  visible?: boolean
}

/**
 * HubNavCard — a tappable navigation entry for the logistics hub.
 *
 * Returns null when `visible` is false so callers can pass the RBAC
 * result directly without conditional JSX on the call site.
 */
export function HubNavCard({
  title,
  subtitle,
  icon: Icon,
  iconColor,
  onPress,
  visible = true,
}: HubNavCardProps) {
  const colors = useColors()

  if (!visible) return null

  const color = iconColor ?? colors.primary

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={() => {
        safeHaptics.impact('light')
        onPress()
      }}
      style={{ marginBottom: tokens.spacing.sm }}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <GlassCard style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: color + '20',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={22} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '900', color: colors.text }}>{title}</Text>
          {subtitle ? (
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>{subtitle}</Text>
          ) : null}
        </View>
        <ChevronRight size={20} color={colors.textMuted} />
      </GlassCard>
    </TouchableOpacity>
  )
}
