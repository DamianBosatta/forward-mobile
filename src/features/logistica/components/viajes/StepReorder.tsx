/**
 * StepReorder.tsx — Step 3 of the Planificar Viaje wizard (READ-ONLY review).
 *
 * Displays the route order in a read-only list. The backend
 * (CrearHojaRutaCommandHandler) re-optimizes the route server-side via a TSP
 * heuristic (IRouteOptimizationService) and persists paradas strictly in its own
 * OrdenSugerido order. The CrearHojaRuta payload (ParadaRequest) carries NO order
 * field — there is no way for the client to express a desired order, and any
 * client reorder would be discarded. Therefore this step does NOT offer a manual
 * reorder control (that would be a fake control). It honestly presents the order
 * as automatically optimized.
 *
 * HARD CONSTRAINTS:
 *  - NO drag-and-drop library
 *  - NO map of any kind
 */

import React from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import { Route, Info, MapPin } from 'lucide-react-native'
import { useColors, tokens } from '@/libs/theme'
import { GlassCard } from '@/core/ui'
import { safeHaptics } from '@/core/utils/haptics'
import { useLogisticaStore } from '@/src/features/logistica/store/logistica.store'

export interface StepReorderProps {
  onNext: () => void
  onBack: () => void
}

export function StepReorder({ onNext, onBack }: StepReorderProps) {
  const colors = useColors()
  const { viajeDraft } = useLogisticaStore()
  const { orderedStops } = viajeDraft

  return (
    <View style={styles.container}>
      {/* Header info — honest about server-side optimization */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Route size={18} color={colors.primary} />
        <Text style={[styles.headerText, { color: colors.textMuted }]}>
          Orden optimizado automáticamente por el servidor
        </Text>
      </View>

      {/* Optimization notice */}
      <View style={styles.noticeWrap}>
        <GlassCard style={[styles.notice, { borderColor: colors.primary + '40' }]}>
          <Info size={16} color={colors.primary} />
          <Text style={[styles.noticeText, { color: colors.textMuted }]}>
            El recorrido se ordena automáticamente para minimizar la distancia. El
            orden mostrado es el que se aplicará al viaje.
          </Text>
        </GlassCard>
      </View>

      {/* Read-only stop list */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {orderedStops.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No hay paradas para mostrar.
            </Text>
          </View>
        ) : (
          orderedStops.map((stop) => (
            <GlassCard key={stop.ventaId} style={styles.stopRow}>
              <View style={[styles.stopBadge, { backgroundColor: colors.primary + '20' }]}>
                <Text style={[styles.stopNumber, { color: colors.primary }]}>{stop.orden}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.stopName, { color: colors.text }]} numberOfLines={1}>
                  {stop.clienteNombre || 'Sin nombre'}
                </Text>
                <View style={styles.addressRow}>
                  <MapPin size={11} color={colors.textMuted} />
                  <Text style={[styles.stopAddress, { color: colors.textMuted }]} numberOfLines={1}>
                    {stop.direccion || 'Sin dirección'}
                  </Text>
                </View>
              </View>
            </GlassCard>
          ))
        )}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { borderColor: colors.border }]}
          onPress={() => {
            safeHaptics.impact('light')
            onBack()
          }}
          accessibilityRole="button"
        >
          <Text style={[styles.backLabel, { color: colors.text }]}>Atrás</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            safeHaptics.impact('medium')
            onNext()
          }}
          accessibilityRole="button"
          accessibilityLabel="Continuar"
        >
          <Text style={styles.nextLabel}>Continuar</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
    borderBottomWidth: 1,
  },
  headerText: {
    fontSize: 12,
    flex: 1,
  },
  noticeWrap: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
    borderWidth: 1,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
    paddingBottom: tokens.spacing.lg,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: tokens.spacing.sm,
    gap: tokens.spacing.sm,
  },
  stopBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stopNumber: {
    fontSize: 14,
    fontWeight: '800',
  },
  stopName: {
    fontSize: 13,
    fontWeight: '700',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  stopAddress: {
    flex: 1,
    fontSize: 12,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  backBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  backLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  nextBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000',
  },
})
