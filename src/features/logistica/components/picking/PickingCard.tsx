/**
 * PickingCard — Presentational card for a single venta in the picking board.
 *
 * Renders estado-appropriate actions:
 *   - A Preparar (estado=2):    select checkbox + "Iniciar" single-card action
 *   - En Preparación (estado=3): "Marcar preparado" (opens bultos sheet) + "Revertir a confirmada"
 *   - Empacados (estado=4):      "Etiquetas" share + "Revertir preparación"
 *
 * Selection (estado=2 only) is managed via logistica.store toggleConfirmada.
 */

import React, { useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
} from 'react-native'
import {
  Package,
  CheckSquare,
  Square,
  Play,
  RotateCcw,
  Tag,
  ClipboardCheck,
} from 'lucide-react-native'
import { useColors, useIsDark } from '@/libs/theme'
import { safeHaptics } from '@/core/utils/haptics'
import type { VentaPreparacion } from '@/libs/api-client/logistica'
import { ESTADO } from '@/src/features/logistica/lib/picking-board-logic'

// ─────────────────────────────────────────────────────────────────────────────
// Estado labels and colors
// ─────────────────────────────────────────────────────────────────────────────

const ESTADO_LABEL: Record<number, string> = {
  [ESTADO.A_PREPARAR]: 'A Preparar',
  [ESTADO.EN_PREPARACION]: 'En Preparación',
  [ESTADO.EMPACADOS]: 'Empacado',
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface PickingCardProps {
  venta: VentaPreparacion
  /** Whether this card is selected (only applicable for A Preparar cards) */
  isSelected: boolean
  /** Temporarily highlight this card after a barcode scan match */
  highlighted?: boolean
  /** Called when the user taps the selection checkbox (A Preparar only) */
  onToggleSelect: (id: string) => void
  /** Called when the user taps "Iniciar" on a single A Preparar card */
  onIniciar: (id: string) => void
  /** Called when the user taps "Marcar preparado" (En Preparación only) */
  onMarcarPreparado: (venta: VentaPreparacion) => void
  /** Called when the user taps "Revertir a confirmada" (En Preparación only) */
  onRevertirAConfirmada: (id: string) => void
  /** Called when the user taps "Etiquetas" (Empacados only) */
  onEtiquetas: (id: string) => void
  /** Called when the user taps "Revertir preparación" (Empacados only) */
  onRevertirAPreparacion: (id: string) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const PickingCard = React.memo(function PickingCard({
  venta,
  isSelected,
  highlighted = false,
  onToggleSelect,
  onIniciar,
  onMarcarPreparado,
  onRevertirAConfirmada,
  onEtiquetas,
  onRevertirAPreparacion,
}: PickingCardProps) {
  const colors = useColors()
  const isDark = useIsDark()

  const isAPreparar = venta.estado === ESTADO.A_PREPARAR
  const isEnPreparacion = venta.estado === ESTADO.EN_PREPARACION
  const isEmpacado = venta.estado === ESTADO.EMPACADOS

  const estadoLabel = ESTADO_LABEL[venta.estado] ?? 'Desconocido'

  // Estado badge color
  const badgeColor = isAPreparar
    ? colors.warning ?? '#F59E0B'
    : isEnPreparacion
    ? colors.primary
    : colors.success

  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : colors.surface
  const borderColor = highlighted
    ? colors.success
    : isSelected
    ? colors.primary
    : isDark
    ? 'rgba(255,255,255,0.08)'
    : colors.border

  const handleToggle = useCallback(() => {
    safeHaptics.impact('light')
    onToggleSelect(venta.id)
  }, [onToggleSelect, venta.id])

  const handleIniciar = useCallback(() => {
    safeHaptics.impact('medium')
    onIniciar(venta.id)
  }, [onIniciar, venta.id])

  const handleMarcarPreparado = useCallback(() => {
    safeHaptics.impact('medium')
    onMarcarPreparado(venta)
  }, [onMarcarPreparado, venta])

  const handleRevertirAConfirmada = useCallback(() => {
    safeHaptics.impact('medium')
    onRevertirAConfirmada(venta.id)
  }, [onRevertirAConfirmada, venta.id])

  const handleEtiquetas = useCallback(() => {
    safeHaptics.impact('light')
    onEtiquetas(venta.id)
  }, [onEtiquetas, venta.id])

  const handleRevertirAPreparacion = useCallback(() => {
    safeHaptics.impact('medium')
    onRevertirAPreparacion(venta.id)
  }, [onRevertirAPreparacion, venta.id])

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor,
          borderWidth: isSelected || highlighted ? 2 : 1,
        },
      ]}
      accessible
      accessibilityLabel={`Venta ${venta.id.slice(0, 8)}, ${venta.clienteNombre}, estado ${estadoLabel}`}
    >
      {/* Main row */}
      <View style={styles.mainRow}>
        {/* Selection checkbox (A Preparar only) */}
        {isAPreparar && (
          <Pressable
            onPress={handleToggle}
            hitSlop={8}
            accessibilityLabel={isSelected ? 'Deseleccionar venta' : 'Seleccionar venta'}
            accessibilityRole="checkbox"
            style={styles.checkbox}
          >
            {isSelected ? (
              <CheckSquare size={22} color={colors.primary} strokeWidth={2.5} />
            ) : (
              <Square size={22} color={colors.textMuted} strokeWidth={2} />
            )}
          </Pressable>
        )}

        {/* Icon */}
        {!isAPreparar && (
          <View style={[styles.iconWrap, { backgroundColor: badgeColor + '18' }]}>
            <Package size={20} color={badgeColor} strokeWidth={2} />
          </View>
        )}

        {/* Info */}
        <View style={styles.info}>
          <Text style={[styles.clienteNombre, { color: colors.text }]} numberOfLines={1}>
            {venta.clienteNombre}
          </Text>

          <Text style={[styles.direccion, { color: colors.textMuted }]} numberOfLines={1}>
            {venta.direccion}
          </Text>

          <View style={styles.metaRow}>
            <View style={[styles.estadoBadge, { backgroundColor: badgeColor + '20' }]}>
              <Text style={[styles.estadoText, { color: badgeColor }]}>
                {estadoLabel}
              </Text>
            </View>

            <Text style={[styles.itemsCount, { color: colors.textMuted }]}>
              {venta.itemsCount} {venta.itemsCount === 1 ? 'ítem' : 'ítems'}
            </Text>

            {venta.fechaEntrega && (
              <Text style={[styles.fecha, { color: colors.textMuted }]}>
                {new Date(venta.fechaEntrega).toLocaleDateString('es-AR', {
                  day: '2-digit',
                  month: '2-digit',
                })}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Actions */}
      <View
        style={[
          styles.actions,
          { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : colors.border },
        ]}
      >
        {/* A Preparar actions */}
        {isAPreparar && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleIniciar}
            accessibilityLabel="Iniciar preparación"
            accessibilityRole="button"
          >
            <Play size={15} color={colors.primary} strokeWidth={2.5} />
            <Text style={[styles.actionLabel, { color: colors.primary }]}>Iniciar</Text>
          </TouchableOpacity>
        )}

        {/* En Preparación actions */}
        {isEnPreparacion && (
          <>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleMarcarPreparado}
              accessibilityLabel="Marcar como preparado"
              accessibilityRole="button"
            >
              <ClipboardCheck size={15} color={colors.primary} strokeWidth={2.5} />
              <Text style={[styles.actionLabel, { color: colors.primary }]}>Marcar preparado</Text>
            </TouchableOpacity>

            <View
              style={[
                styles.actionDivider,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border },
              ]}
            />

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleRevertirAConfirmada}
              accessibilityLabel="Revertir a confirmada"
              accessibilityRole="button"
            >
              <RotateCcw size={15} color={colors.danger} strokeWidth={2.5} />
              <Text style={[styles.actionLabel, { color: colors.danger }]}>Revertir</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Empacados actions */}
        {isEmpacado && (
          <>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleEtiquetas}
              accessibilityLabel="Compartir etiquetas"
              accessibilityRole="button"
            >
              <Tag size={15} color={colors.primary} strokeWidth={2.5} />
              <Text style={[styles.actionLabel, { color: colors.primary }]}>Etiquetas</Text>
            </TouchableOpacity>

            <View
              style={[
                styles.actionDivider,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border },
              ]}
            />

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleRevertirAPreparacion}
              accessibilityLabel="Revertir a preparación"
              accessibilityRole="button"
            >
              <RotateCcw size={15} color={colors.danger} strokeWidth={2.5} />
              <Text style={[styles.actionLabel, { color: colors.danger }]}>Revertir</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 5,
    borderRadius: 16,
    overflow: 'hidden',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 10,
  },
  checkbox: {
    paddingTop: 2,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  clienteNombre: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Outfit_700Bold',
  },
  direccion: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    marginTop: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  estadoBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  estadoText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 0.5,
  },
  itemsCount: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
  },
  fecha: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
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
    gap: 5,
    paddingVertical: 11,
  },
  actionDivider: {
    width: 1,
    marginVertical: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
  },
})
