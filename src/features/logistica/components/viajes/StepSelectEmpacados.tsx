/**
 * StepSelectEmpacados.tsx — Step 1 of the Planificar Viaje wizard.
 *
 * Fetches ventas empacadas via useVentasEmpacadas and lets the manager
 * select which ones to include in the trip (multi-select).
 *
 * - Empty state shown when no ventas available
 * - "Next" disabled when no ventas are selected
 * - Selection stored in viajeDraft.selectedEmpacadaIds (ephemeral store slice)
 */

import React from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { Package, CheckCircle2, Circle } from 'lucide-react-native'
import { useColors, tokens } from '@/libs/theme'
import { GlassCard } from '@/core/ui'
import { safeHaptics } from '@/core/utils/haptics'
import { useVentasEmpacadas } from '@/libs/api-client/logistica'
import { useLogisticaStore } from '@/src/features/logistica/store/logistica.store'
import type { VentaEmpacada } from '@/libs/api-client/types'

export interface StepSelectEmpacadosProps {
  onNext: () => void
}

export function StepSelectEmpacados({ onNext }: StepSelectEmpacadosProps) {
  const colors = useColors()
  const { data: ventas, isLoading, isError, refetch } = useVentasEmpacadas()
  const { viajeDraft, toggleDraftEmpacada } = useLogisticaStore()

  const selectedIds = viajeDraft.selectedEmpacadaIds
  const selectedCount = Object.keys(selectedIds).length
  const canAdvance = selectedCount > 0

  // ── Empty / loading / error states ──────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          Cargando pedidos empacados...
        </Text>
      </View>
    )
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          Error al cargar los pedidos
        </Text>
        <TouchableOpacity
          style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          onPress={() => refetch()}
        >
          <Text style={styles.retryLabel}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!ventas || ventas.length === 0) {
    return (
      <View style={styles.centered}>
        <Package size={48} color={colors.textMuted} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          Sin pedidos empacados
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
          No hay ventas empacadas disponibles para armar un viaje.
        </Text>
      </View>
    )
  }

  // ── Render list ──────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        Seleccioná los pedidos que van en este viaje
      </Text>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {ventas.map((venta: VentaEmpacada) => {
          const id = venta.id ?? ''
          const isSelected = Boolean(selectedIds[id])

          return (
            <TouchableOpacity
              key={id}
              activeOpacity={0.8}
              onPress={() => {
                safeHaptics.impact('light')
                toggleDraftEmpacada(id)
              }}
            >
              <GlassCard
                style={[
                  styles.card,
                  isSelected && { borderColor: colors.primary, borderWidth: 2 },
                ]}
              >
                <View style={styles.cardRow}>
                  {isSelected ? (
                    <CheckCircle2 size={22} color={colors.primary} />
                  ) : (
                    <Circle size={22} color={colors.border} />
                  )}
                  <View style={styles.cardContent}>
                    <Text style={[styles.clienteNombre, { color: colors.text }]}>
                      {venta.clienteNombre ?? 'Cliente sin nombre'}
                    </Text>
                    <Text style={[styles.direccion, { color: colors.textMuted }]} numberOfLines={1}>
                      {venta.direccion ?? 'Sin dirección'}
                    </Text>
                    <Text style={[styles.bultos, { color: colors.textMuted }]}>
                      {venta.cantidadBultos ?? 0} bulto{(venta.cantidadBultos ?? 0) !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
              </GlassCard>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        {selectedCount > 0 && (
          <Text style={[styles.selectedCount, { color: colors.textMuted }]}>
            {selectedCount} seleccionado{selectedCount !== 1 ? 's' : ''}
          </Text>
        )}
        <TouchableOpacity
          style={[
            styles.nextBtn,
            {
              backgroundColor: canAdvance ? colors.primary : colors.border,
              opacity: canAdvance ? 1 : 0.6,
            },
          ]}
          onPress={() => {
            if (canAdvance) {
              safeHaptics.impact('medium')
              onNext()
            }
          }}
          disabled={!canAdvance}
          accessibilityLabel="Siguiente paso"
          accessibilityRole="button"
        >
          <Text style={[styles.nextLabel, { color: canAdvance ? '#000' : colors.textMuted }]}>
            Siguiente
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.md,
    padding: tokens.spacing.lg,
  },
  loadingText: {
    fontSize: 14,
    marginTop: tokens.spacing.sm,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: tokens.spacing.sm,
  },
  retryLabel: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },
  hint: {
    fontSize: 13,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  card: {
    padding: tokens.spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.sm,
  },
  cardContent: {
    flex: 1,
    gap: 2,
  },
  clienteNombre: {
    fontSize: 15,
    fontWeight: '700',
  },
  direccion: {
    fontSize: 13,
  },
  bultos: {
    fontSize: 12,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
  },
  selectedCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  nextBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
})
