/**
 * VehiculoCard — Presentational card for a single vehicle in the ABM list.
 *
 * Shows: patente (prominent), modelo, capacidad (Kg).
 * Management actions: edit (opens form sheet) and deactivate (one-way in v1).
 *
 * NOTE: The backend GET /vehiculos list endpoint does NOT return `activo` —
 * vehicles are filtered server-side. All vehicles in the list are considered
 * active. The deactivate action is visually surfaced as a one-way confirmation
 * (no reactivation via this screen per v1 backend constraints).
 */

import React from 'react'
import { View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native'
import { Truck, Edit3, Trash2 } from 'lucide-react-native'
import { useColors, useIsDark } from '@/libs/theme'
import { safeHaptics } from '@/core/utils/haptics'
import type { VehiculoCrudResult } from '@/libs/api-client/logistica'

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface VehiculoCardProps {
  vehiculo: VehiculoCrudResult
  onEdit: (vehiculo: VehiculoCrudResult) => void
  onDeactivate: (vehiculo: VehiculoCrudResult) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const VehiculoCard = React.memo(function VehiculoCard({
  vehiculo,
  onEdit,
  onDeactivate,
}: VehiculoCardProps) {
  const colors = useColors()
  const isDark = useIsDark()

  const isInactive = vehiculo.activo === false

  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : colors.surface
  const borderColor = isInactive
    ? colors.danger + '50'
    : isDark
    ? 'rgba(255,255,255,0.08)'
    : colors.border

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor,
        },
      ]}
      accessible
      accessibilityLabel={`Vehículo ${vehiculo.patente}, ${vehiculo.modelo}, ${vehiculo.capacidadCargaKg} kg`}
    >
      {/* Icon + main info */}
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primary + '18' }]}>
          <Truck size={22} color={colors.primary} strokeWidth={2} />
        </View>

        <View style={styles.info}>
          <Text
            style={[styles.patente, { color: colors.text }]}
            numberOfLines={1}
          >
            {vehiculo.patente}
          </Text>

          <Text style={[styles.modelo, { color: colors.textMuted }]} numberOfLines={1}>
            {vehiculo.modelo}
          </Text>

          <View style={styles.capacidadRow}>
            <Text style={[styles.capacidadLabel, { color: colors.textMuted }]}>
              Capacidad
            </Text>
            <Text style={[styles.capacidadValue, { color: colors.primary }]}>
              {vehiculo.capacidadCargaKg} kg
            </Text>
          </View>
        </View>

        {/* Inactive badge */}
        {isInactive && (
          <View style={[styles.inactiveBadge, { backgroundColor: colors.danger + '22' }]}>
            <Text style={[styles.inactiveBadgeText, { color: colors.danger }]}>
              INACTIVO
            </Text>
          </View>
        )}
      </View>

      {/* Actions — only available for active vehicles */}
      {!isInactive && (
        <View style={[styles.actions, { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : colors.border }]}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              safeHaptics.impact('light')
              onEdit(vehiculo)
            }}
            accessibilityLabel={`Editar vehículo ${vehiculo.patente}`}
            accessibilityRole="button"
          >
            <Edit3 size={16} color={colors.primary} strokeWidth={2} />
            <Text style={[styles.actionLabel, { color: colors.primary }]}>Editar</Text>
          </TouchableOpacity>

          <View style={[styles.actionDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border }]} />

          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
            onPress={() => {
              safeHaptics.impact('medium')
              onDeactivate(vehiculo)
            }}
            accessibilityLabel={`Desactivar vehículo ${vehiculo.patente}`}
            accessibilityRole="button"
          >
            <Trash2 size={16} color={colors.danger} strokeWidth={2} />
            <Text style={[styles.actionLabel, { color: colors.danger }]}>Desactivar</Text>
          </Pressable>
        </View>
      )}
    </View>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  patente: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  modelo: {
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
    marginTop: 1,
  },
  capacidadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  capacidadLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.3,
  },
  capacidadValue: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Outfit_700Bold',
  },
  inactiveBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  inactiveBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 1,
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  actionBtnPressed: {
    opacity: 0.6,
  },
  actionDivider: {
    width: 1,
    marginVertical: 10,
  },
  actionLabel: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
})
