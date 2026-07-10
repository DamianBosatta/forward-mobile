/**
 * StepConfirm.tsx — Step 4 of the Planificar Viaje wizard.
 *
 * Validates trip readiness via validateTripReadiness before allowing submission.
 * On "Iniciar viaje":
 *   1. POST /hojas-ruta/{id}/iniciar via useIniciarHojaRuta
 *   2. Share Manifiesto PDF via sharePdf(getManifiestoUrl(id))
 *   3. resetViajeDraft + navigate to Hub
 *
 * The "Iniciar" button is BLOCKED when validateTripReadiness returns an error string.
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { MapPin, User, Truck, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react-native'
import { useColors, tokens } from '@/libs/theme'
import { GlassCard } from '@/core/ui'
import { safeHaptics } from '@/core/utils/haptics'
import {
  useIniciarHojaRuta,
  getManifiestoUrl,
  useChoferes,
  useVehiculos,
} from '@/libs/api-client/logistica'
import { sharePdf } from '@/src/features/pedidos/lib/sharePdf'
import { validateTripReadiness } from '@/src/features/logistica/lib/viajes-logic'
import { useLogisticaStore } from '@/src/features/logistica/store/logistica.store'

export interface StepConfirmProps {
  onBack: () => void
  onComplete: () => void
}

export function StepConfirm({ onBack, onComplete }: StepConfirmProps) {
  const colors = useColors()

  const { viajeDraft, resetViajeDraft } = useLogisticaStore()
  const { mutateAsync: iniciarHojaRuta, isPending } = useIniciarHojaRuta()

  // Resolve chofer/vehículo names from their ids (C2 — no raw ID slices in the UI).
  const { data: choferes = [] } = useChoferes()
  const { data: vehiculos = [] } = useVehiculos()

  const [apiError, setApiError] = useState<string | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)
  // True once iniciar succeeded. Prevents re-firing iniciar if the manifiesto
  // share failed and the user is left on this screen to read the message.
  const [tripStarted, setTripStarted] = useState(false)

  const { choferId, vehiculoId, orderedStops, hojaRutaId } = viajeDraft

  const chofer = (choferes as { id?: string; nombreCompleto?: string | null }[]).find(
    (c) => c.id === choferId,
  )
  const vehiculo = (vehiculos as { id?: string; patente?: string | null; modelo?: string | null }[]).find(
    (v) => v.id === vehiculoId,
  )

  const choferLabel = chofer?.nombreCompleto || (choferId ? 'Chofer asignado' : 'No asignado')
  const vehiculoLabel = vehiculo
    ? [vehiculo.patente, vehiculo.modelo].filter(Boolean).join(' · ') || 'Vehículo asignado'
    : vehiculoId
    ? 'Vehículo asignado'
    : 'No asignado'

  // Validate readiness — blocks the "Iniciar" button when errors are present
  const validationError = validateTripReadiness(choferId, vehiculoId, orderedStops)
  const canStart = !validationError && Boolean(hojaRutaId) && !isPending

  const finish = () => {
    resetViajeDraft()
    onComplete()
  }

  const handleStart = async () => {
    if (!canStart || !hojaRutaId) return
    setApiError(null)
    setShareError(null)

    try {
      safeHaptics.impact('medium')
      await iniciarHojaRuta(hojaRutaId)
      setTripStarted(true)
      safeHaptics.notification('success')

      // Share PDF — surface failures to the user (W5) instead of swallowing them,
      // consistent with how PR5 consola surfaces shareError.
      const pdfUrl = getManifiestoUrl(hojaRutaId)
      const shareResult = await sharePdf(pdfUrl, 'manifiesto.pdf')
      if (!shareResult.ok) {
        // Trip already started; do NOT re-iniciar. Show the failure and let the
        // user continue to the hub (they can re-share from the consola later).
        setShareError(
          `El viaje se inició, pero no se pudo compartir el Manifiesto PDF: ${shareResult.message}`,
        )
        return
      }

      finish()
    } catch {
      safeHaptics.notification('error')
      setApiError('No se pudo iniciar el viaje. Reintentá en un momento.')
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Resumen del viaje</Text>

        {/* Assignment summary */}
        <GlassCard style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <User size={16} color={colors.textMuted} />
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Chofer</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]} numberOfLines={1}>
              {choferLabel}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryRow}>
            <Truck size={16} color={colors.textMuted} />
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Vehículo</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]} numberOfLines={1}>
              {vehiculoLabel}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryRow}>
            <MapPin size={16} color={colors.textMuted} />
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Paradas</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {orderedStops.length} parada{orderedStops.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </GlassCard>

        {/* Stop list preview */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: tokens.spacing.md }]}>
          Orden de entrega
        </Text>
        {orderedStops.map((stop) => (
          <GlassCard key={stop.ventaId} style={styles.stopRow}>
            <View style={[styles.stopBadge, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.stopNumber, { color: colors.primary }]}>{stop.orden}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.stopName, { color: colors.text }]} numberOfLines={1}>
                {stop.clienteNombre || 'Sin nombre'}
              </Text>
              <Text style={[styles.stopAddress, { color: colors.textMuted }]} numberOfLines={1}>
                {stop.direccion || 'Sin dirección'}
              </Text>
            </View>
          </GlassCard>
        ))}

        {/* Validation error (blocks submission) */}
        {validationError && (
          <GlassCard style={[styles.errorCard, { borderColor: colors.danger }]}>
            <AlertTriangle size={18} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger }]}>{validationError}</Text>
          </GlassCard>
        )}

        {/* PDF info notice */}
        {!validationError && (
          <GlassCard style={[styles.pdfNotice, { borderColor: colors.primary + '40' }]}>
            <FileText size={16} color={colors.primary} />
            <Text style={[styles.pdfNoticeText, { color: colors.textMuted }]}>
              Al iniciar el viaje se compartirá el Manifiesto PDF automáticamente.
            </Text>
          </GlassCard>
        )}

        {/* API error */}
        {apiError && (
          <GlassCard style={[styles.errorCard, { borderColor: colors.danger }]}>
            <AlertTriangle size={18} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger }]}>{apiError}</Text>
          </GlassCard>
        )}

        {/* Share error — trip started but manifiesto share failed (W5) */}
        {shareError && (
          <GlassCard style={[styles.errorCard, { borderColor: colors.warning }]}>
            <AlertTriangle size={18} color={colors.warning} />
            <Text style={[styles.errorText, { color: colors.warning }]}>
              {shareError}
            </Text>
          </GlassCard>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        {tripStarted ? (
          // Trip already started but share failed — only path forward is to finish.
          <TouchableOpacity
            style={[styles.startBtn, { flex: 1, backgroundColor: colors.primary }]}
            onPress={() => {
              safeHaptics.impact('medium')
              finish()
            }}
            accessibilityRole="button"
            accessibilityLabel="Continuar al inicio"
          >
            <CheckCircle2 size={18} color="#000" strokeWidth={2.5} />
            <Text style={[styles.startLabel, { color: '#000' }]}>Continuar</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.backBtn, { borderColor: colors.border }]}
              onPress={() => {
                safeHaptics.impact('light')
                onBack()
              }}
              disabled={isPending}
              accessibilityRole="button"
            >
              <Text style={[styles.backLabel, { color: colors.text }]}>Atrás</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.startBtn,
                {
                  backgroundColor: canStart ? colors.primary : colors.border,
                  opacity: canStart ? 1 : 0.6,
                },
              ]}
              onPress={handleStart}
              disabled={!canStart}
              accessibilityRole="button"
              accessibilityLabel="Iniciar viaje"
            >
              {isPending ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <CheckCircle2 size={18} color={canStart ? '#000' : colors.textMuted} strokeWidth={2.5} />
                  <Text style={[styles.startLabel, { color: canStart ? '#000' : colors.textMuted }]}>
                    Iniciar viaje
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports for tests
// ─────────────────────────────────────────────────────────────────────────────

/** Re-export so tests can call it directly without importing viajes-logic */
export { validateTripReadiness as validateTripReadinessForTest }

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
    paddingBottom: tokens.spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryCard: {
    padding: tokens.spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    width: 72,
  },
  summaryValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    marginVertical: 2,
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
  stopAddress: {
    fontSize: 12,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
    borderWidth: 1.5,
    marginTop: tokens.spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  pdfNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
    borderWidth: 1,
    marginTop: tokens.spacing.sm,
  },
  pdfNoticeText: {
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
  startBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
})
