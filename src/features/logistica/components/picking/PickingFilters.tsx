/**
 * PickingFilters — Filter chip bar for the picking board.
 *
 * Provides filter chips for the three estados (A Preparar / En Preparación / Empacados).
 * All filters are stateless — the parent screen owns the filter state and passes it down.
 */

import React from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import { useColors, useIsDark } from '@/libs/theme'
import { ESTADO } from '@/src/features/logistica/lib/picking-board-logic'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** null = show all estados */
export type EstadoFilter = typeof ESTADO[keyof typeof ESTADO] | null

export interface PickingFiltersProps {
  /** Currently active estado filter (null = all) */
  estadoFilter: EstadoFilter
  onEstadoFilterChange: (filter: EstadoFilter) => void
  /**
   * When true, hides all estado filter chips.
   * Used on tablet (isLarge) where columns already segregate by estado.
   * Default false — phone behavior unchanged.
   */
  hideEstado?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ESTADO_CHIPS: { label: string; value: EstadoFilter }[] = [
  { label: 'Todos', value: null },
  { label: 'A Preparar', value: ESTADO.A_PREPARAR },
  { label: 'En Preparación', value: ESTADO.EN_PREPARACION },
  { label: 'Empacados', value: ESTADO.EMPACADOS },
]

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function PickingFilters({
  estadoFilter,
  onEstadoFilterChange,
  hideEstado = false,
}: PickingFiltersProps) {
  const colors = useColors()
  const isDark = useIsDark()

  // On tablet the board columns already segregate by estado — hide the chip bar.
  if (hideEstado) return null

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {ESTADO_CHIPS.map((chip) => {
          const isActive = chip.value === estadoFilter
          return (
            <TouchableOpacity
              key={chip.label}
              onPress={() => onEstadoFilterChange(chip.value)}
              style={[
                styles.chip,
                {
                  backgroundColor: isActive
                    ? colors.primary
                    : isDark
                    ? 'rgba(255,255,255,0.06)'
                    : colors.bg,
                  borderColor: isActive
                    ? colors.primary
                    : isDark
                    ? 'rgba(255,255,255,0.10)'
                    : colors.border,
                },
              ]}
              accessibilityLabel={`Filtrar por ${chip.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color: isActive ? '#000' : colors.textMuted,
                  },
                ]}
              >
                {chip.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
})
