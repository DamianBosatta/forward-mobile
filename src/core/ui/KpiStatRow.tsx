import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { MotiView } from 'moti'
import { useColors, useIsDark } from '@/libs/theme'
import { ResponsiveGrid, ResponsiveGridProps } from './ResponsiveGrid'

// ── KpiStat shape ─────────────────────────────────────────────────────────────

export interface KpiStat {
  /** Stable React key. */
  key: string
  /** Short uppercase label displayed below the value. */
  label: string
  /** Formatted value string (already formatted by the caller). */
  value: string
  /** Optional sub-label rendered below the main label. */
  sub?: string
  /** Lucide-compatible icon component. */
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
  /** Accent colour used for icon tint and value text. */
  color: string
  /** When true the card gets a danger-tinted background. */
  alert?: boolean
}

export interface KpiStatRowProps {
  stats: KpiStat[]
  /**
   * Column count per band. Defaults to `{ small:1, medium:3, large:4 }` which
   * matches the design ADR-4 specification: stack on small phones, 3-col on the
   * existing phone fleet, 4-col on tablets / foldables.
   */
  columns?: ResponsiveGridProps['columns']
}

const DEFAULT_COLUMNS: NonNullable<KpiStatRowProps['columns']> = {
  small: 1,
  medium: 3,
  large: 4,
}

// ── KpiStatRow ────────────────────────────────────────────────────────────────

export function KpiStatRow({ stats, columns = DEFAULT_COLUMNS }: KpiStatRowProps) {
  const colors = useColors()
  const isDark = useIsDark()

  return (
    <ResponsiveGrid columns={columns} gap={8}>
      {stats.map((stat, index) => {
        const Icon = stat.icon
        return (
          <MotiView
            key={stat.key}
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 18, delay: index * 80 }}
          >
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDark ? '#0d0d0d' : '#ffffff',
                  borderColor: isDark
                    ? 'rgba(255,255,255,0.05)'
                    : 'rgba(0,0,0,0.06)',
                },
                stat.alert && {
                  backgroundColor: isDark
                    ? colors.danger + '08'
                    : colors.danger + '06',
                  borderColor: colors.danger + '25',
                },
              ]}
            >
              <View
                style={[
                  styles.iconWrap,
                  {
                    backgroundColor: stat.color + '18',
                    borderColor: stat.color + '30',
                  },
                ]}
              >
                <Icon size={14} color={stat.color} strokeWidth={2.5} />
              </View>
              <Text style={[styles.value, { color: stat.color }]}>
                {stat.value}
              </Text>
              <Text style={styles.label}>{stat.label}</Text>
              {stat.sub != null ? (
                <Text style={styles.sub}>{stat.sub}</Text>
              ) : null}
            </View>
          </MotiView>
        )
      })}
    </ResponsiveGrid>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  value: {
    fontSize: 22,
    fontFamily: 'Outfit_900Black',
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  label: {
    fontSize: 7,
    color: '#525252',
    fontFamily: 'Outfit_900Black',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  sub: {
    fontSize: 7,
    color: '#737373',
    fontFamily: 'Outfit_600SemiBold',
    textAlign: 'center',
  },
})
