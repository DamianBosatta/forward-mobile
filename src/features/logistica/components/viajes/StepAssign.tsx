/**
 * StepAssign.tsx — Step 2 of the Planificar Viaje wizard.
 *
 * Picker for chofer, vehículo, and depósito (optional). On submit:
 *  1. Stores the assignment in viajeDraft via setAssignment.
 *  2. Builds the CrearHojaRuta payload from the selected ventas.
 *  3. POSTs to /hojas-ruta via useCrearHojaRuta.
 *  4. On success → sets orderedStops from the server response + advances to step 3.
 *  5. On 5xx → stays on this step, shows error, preserves all selections for retry.
 *
 * NOTE: The route optimization is SERVER-SIDE and authoritative. The backend
 * (CrearHojaRutaCommandHandler) re-orders paradas via a TSP heuristic and the
 * CrearHojaRuta payload carries no order field. Step 3 is therefore a read-only
 * review of the optimized order — there is no client-side reorder.
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native'
import { User, Truck, Warehouse, Calendar, AlertCircle, ChevronUp, ChevronDown } from 'lucide-react-native'
import { useColors, tokens } from '@/libs/theme'
import { GlassCard } from '@/core/ui'
import { safeHaptics } from '@/core/utils/haptics'
import { useChoferes, useVehiculos, useCrearHojaRuta } from '@/libs/api-client/logistica'
import { useDepositos } from '@/libs/api-client/depositos'
import { useLogisticaStore } from '@/src/features/logistica/store/logistica.store'
import { useVentasEmpacadas } from '@/libs/api-client/logistica'
import { buildCrearHojaRutaPayload, ventasToOrderedStops, assignOrderNumbers } from '@/src/features/logistica/lib/viajes-logic'
import type { VentaEmpacada } from '@/libs/api-client/types'
import type { OrderedStop } from '@/src/features/logistica/lib/viajes-logic'

export interface StepAssignProps {
  onNext: () => void
  onBack: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Simple inline picker row
// ─────────────────────────────────────────────────────────────────────────────

interface PickerRowProps {
  label: string
  icon: React.ReactNode
  options: { id: string; label: string }[]
  selectedId: string | null
  onSelect: (id: string) => void
  colors: ReturnType<typeof useColors>
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
}

function PickerRow({
  label,
  icon,
  options,
  selectedId,
  onSelect,
  colors,
  isLoading,
  isError,
  onRetry,
}: PickerRowProps) {
  const [expanded, setExpanded] = useState(false)
  const selected = options.find((o) => o.id === selectedId)

  return (
    <View style={pickerStyles.wrapper}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setExpanded(!expanded)}
        accessibilityRole="button"
        accessibilityLabel={`Seleccionar ${label}`}
      >
        <GlassCard style={[pickerStyles.row, { borderColor: selectedId ? colors.primary : colors.border }]}>
          <View style={[pickerStyles.iconWrap, { backgroundColor: colors.primary + '20' }]}>
            {icon}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[pickerStyles.label, { color: colors.textMuted }]}>{label}</Text>
            <Text style={[pickerStyles.value, { color: selectedId ? colors.text : colors.textMuted }]}>
              {isLoading
                ? 'Cargando...'
                : isError
                ? 'Error al cargar'
                : selected?.label ?? `Seleccionar ${label.toLowerCase()}...`}
            </Text>
          </View>
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : expanded ? (
            <ChevronUp size={16} color={colors.textMuted} />
          ) : (
            <ChevronDown size={16} color={colors.textMuted} />
          )}
        </GlassCard>
      </TouchableOpacity>

      {expanded && (
        <GlassCard style={[pickerStyles.dropdown, { borderColor: colors.border }]}>
          {isLoading ? (
            <View style={pickerStyles.stateRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[pickerStyles.optionText, { color: colors.textMuted }]}>
                Cargando opciones...
              </Text>
            </View>
          ) : isError ? (
            <View style={pickerStyles.stateRow}>
              <Text style={[pickerStyles.optionText, { color: colors.danger, flex: 1 }]}>
                No se pudieron cargar las opciones.
              </Text>
              {onRetry && (
                <TouchableOpacity
                  onPress={() => {
                    safeHaptics.impact('light')
                    onRetry()
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Reintentar"
                >
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>Reintentar</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    pickerStyles.option,
                    opt.id === selectedId && { backgroundColor: colors.primary + '18' },
                  ]}
                  onPress={() => {
                    safeHaptics.impact('light')
                    onSelect(opt.id)
                    setExpanded(false)
                  }}
                  accessibilityRole="menuitem"
                >
                  <Text style={[pickerStyles.optionText, { color: colors.text }]}>
                    {opt.label}
                  </Text>
                  {opt.id === selectedId && (
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
              {options.length === 0 && (
                <Text style={[pickerStyles.optionText, { color: colors.textMuted, padding: 12 }]}>
                  Sin opciones disponibles
                </Text>
              )}
            </>
          )}
        </GlassCard>
      )}
    </View>
  )
}

const pickerStyles = StyleSheet.create({
  wrapper: {
    marginBottom: tokens.spacing.sm,
  },
  row: {
    padding: tokens.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    borderWidth: 1.5,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },
  chevron: {
    fontSize: 12,
  },
  dropdown: {
    marginTop: 4,
    borderWidth: 1,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function StepAssign({ onNext, onBack }: StepAssignProps) {
  const colors = useColors()

  const { viajeDraft, setAssignment, setOrderedStops } = useLogisticaStore()

  const {
    data: choferes = [],
    isLoading: choferesLoading,
    isError: choferesError,
    refetch: refetchChoferes,
  } = useChoferes()
  const {
    data: vehiculos = [],
    isLoading: vehiculosLoading,
    isError: vehiculosError,
    refetch: refetchVehiculos,
  } = useVehiculos()
  const {
    data: depositos = [],
    isLoading: depositosLoading,
    isError: depositosError,
    refetch: refetchDepositos,
  } = useDepositos()
  const { data: ventasEmpacadas = [] } = useVentasEmpacadas()
  const { mutateAsync: crearHojaRuta, isPending } = useCrearHojaRuta()

  const [choferId, setChoferId] = useState<string | null>(viajeDraft.choferId)
  const [vehiculoId, setVehiculoId] = useState<string | null>(viajeDraft.vehiculoId)
  const [depositoId, setDepositoId] = useState<string | null>(viajeDraft.depositoId)
  const [apiError, setApiError] = useState<string | null>(null)

  const canSubmit = Boolean(choferId && vehiculoId) && !isPending

  // Get the ventas selected in step 1
  const selectedVentas = (ventasEmpacadas as VentaEmpacada[]).filter(
    (v) => v.id && viajeDraft.selectedEmpacadaIds[v.id],
  )

  const handleSubmit = async () => {
    if (!choferId || !vehiculoId) return
    setApiError(null)

    // Store the assignment in the draft (needed for step 3+ display)
    const fechaSalida = new Date().toISOString()
    setAssignment({ choferId, vehiculoId, depositoId, fechaSalida })

    const payload = buildCrearHojaRutaPayload(
      selectedVentas,
      choferId,
      vehiculoId,
      new Date(fechaSalida),
      depositoId,
    )

    try {
      safeHaptics.impact('medium')
      const hojaRutaId = await crearHojaRuta(payload)

      // Build the ordered stops for the read-only review (step 3). The POST
      // response returns only the hojaRutaId; the server-optimized order is not
      // echoed back, so the review uses selection order as a stable display.
      const baseStops: OrderedStop[] = assignOrderNumbers(ventasToOrderedStops(selectedVentas))
      setOrderedStops(baseStops, String(hojaRutaId))

      safeHaptics.notification('success')
      onNext()
    } catch (err: unknown) {
      safeHaptics.notification('error')
      // Stay on this step — preserve all selections
      const is5xx =
        err instanceof Error &&
        (err.message.includes('500') ||
          err.message.includes('502') ||
          err.message.includes('503') ||
          err.message.includes('504'))

      setApiError(
        is5xx
          ? 'Error en el servidor. Revisá tu conexión y reintentá.'
          : 'No se pudo crear la hoja de ruta. Reintentá en un momento.',
      )
    }
  }

  // ── Picker options ───────────────────────────────────────────────────────────

  const choferOptions = (choferes as { id?: string; nombreCompleto?: string | null }[]).map((c) => ({
    id: c.id ?? '',
    label: c.nombreCompleto ?? 'Sin nombre',
  }))

  const vehiculoOptions = (vehiculos as { id?: string; patente?: string | null; modelo?: string | null }[]).map((v) => ({
    id: v.id ?? '',
    label: [v.patente, v.modelo].filter(Boolean).join(' · ') || 'Sin datos',
  }))

  const depositoOptions = (depositos as { id?: string; nombre?: string | null }[]).map((d) => ({
    id: d.id ?? '',
    label: d.nombre ?? 'Sin nombre',
  }))

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Asigná chofer, vehículo y depósito de salida
        </Text>

        <PickerRow
          label="Chofer"
          icon={<User size={18} color={colors.primary} />}
          options={choferOptions}
          selectedId={choferId}
          onSelect={setChoferId}
          colors={colors}
          isLoading={choferesLoading}
          isError={choferesError}
          onRetry={refetchChoferes}
        />

        <PickerRow
          label="Vehículo"
          icon={<Truck size={18} color={colors.primary} />}
          options={vehiculoOptions}
          selectedId={vehiculoId}
          onSelect={setVehiculoId}
          colors={colors}
          isLoading={vehiculosLoading}
          isError={vehiculosError}
          onRetry={refetchVehiculos}
        />

        <PickerRow
          label="Depósito (opcional)"
          icon={<Warehouse size={18} color={colors.primary} />}
          options={depositoOptions}
          selectedId={depositoId}
          onSelect={setDepositoId}
          colors={colors}
          isLoading={depositosLoading}
          isError={depositosError}
          onRetry={refetchDepositos}
        />

        {/* Summary */}
        <GlassCard style={[styles.summaryCard, { borderColor: colors.border }]}>
          <Calendar size={16} color={colors.textMuted} />
          <Text style={[styles.summaryText, { color: colors.textMuted }]}>
            {viajeDraft.selectedEmpacadaIds
              ? `${Object.keys(viajeDraft.selectedEmpacadaIds).length} pedido${Object.keys(viajeDraft.selectedEmpacadaIds).length !== 1 ? 's' : ''} seleccionado${Object.keys(viajeDraft.selectedEmpacadaIds).length !== 1 ? 's' : ''}`
              : 'Sin pedidos'}
          </Text>
        </GlassCard>

        {/* API error banner */}
        {apiError && (
          <GlassCard style={[styles.errorBanner, { borderColor: colors.danger }]}>
            <AlertCircle size={18} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger }]}>{apiError}</Text>
          </GlassCard>
        )}
      </ScrollView>

      {/* Footer actions */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
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
            styles.nextBtn,
            {
              backgroundColor: canSubmit ? colors.primary : colors.border,
              opacity: canSubmit ? 1 : 0.6,
            },
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel="Crear hoja de ruta"
        >
          {isPending ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={[styles.nextLabel, { color: canSubmit ? '#000' : colors.textMuted }]}>
              Crear hoja de ruta
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.xs,
    paddingBottom: tokens.spacing.lg,
  },
  hint: {
    fontSize: 13,
    marginBottom: tokens.spacing.sm,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
    marginTop: tokens.spacing.sm,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '500',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
    marginTop: tokens.spacing.sm,
    borderWidth: 1.5,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
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
  },
})
