/**
 * vehiculos.tsx — ABM Vehículos screen.
 *
 * Management-only: gated by isMgmtRole + RequirePermission(MOD_VIAJES:read).
 * Lists active vehicles via useVehiculos (FlashList), FAB → create sheet,
 * per-card edit + deactivate actions with confirmation modal.
 *
 * Backend constraints (v1):
 * - GET /vehiculos does NOT return `activo`; server only returns active vehicles.
 * - No reactivation endpoint — deactivation is a one-way action (DELETE).
 *
 * Slice 1 (PR1) — depends on PR0 foundation hooks + RBAC helper.
 */

import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import { Plus, Truck } from 'lucide-react-native'
import { MotiView } from 'moti'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '@/libs/theme'
import { RequirePermission, ConfirmModal, DataList } from '@/core/ui'
import { usePermissions } from '@/src/core/auth/RequirePermission'
import { safeHaptics } from '@/core/utils/haptics'
import { LogisticaHeader } from '@/src/features/logistica/components/LogisticaHeader'
import { useVehiculos } from '@/libs/api-client/logistica'
import type { VehiculoCrudResult } from '@/libs/api-client/logistica'
import { isMgmtRole } from '@/src/features/logistica/lib/rbac'
import { VehiculoCard } from '@/src/features/logistica/components/vehiculos/VehiculoCard'
import { VehiculoFormSheet } from '@/src/features/logistica/components/vehiculos/VehiculoFormSheet'
import { useDeactivateVehiculo } from '@/libs/api-client/logistica'

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function VehiculosScreen() {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const { roles } = usePermissions()

  // ── Data ─────────────────────────────────────────────────────────────────
  const { data: vehiculos, isLoading, isRefetching, refetch } = useVehiculos()
  const { mutateAsync: deactivate, isPending: isDeactivating } = useDeactivateVehiculo()

  // ── Sheet / modal state ──────────────────────────────────────────────────
  const [sheetVisible, setSheetVisible] = useState(false)
  const [editingVehiculo, setEditingVehiculo] = useState<VehiculoCrudResult | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<VehiculoCrudResult | null>(null)

  const [feedback, setFeedback] = useState<{
    visible: boolean
    variant: 'success' | 'danger'
    title: string
    message: string
  }>({ visible: false, variant: 'success', title: '', message: '' })

  // ── RBAC gate ────────────────────────────────────────────────────────────
  if (!isMgmtRole(roles)) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <Text style={[styles.accessTitle, { color: colors.text }]}>Sin permisos</Text>
        <Text style={[styles.accessSubtitle, { color: colors.textMuted }]}>
          Esta sección es solo para administradores.
        </Text>
      </View>
    )
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleOpenCreate = useCallback(() => {
    safeHaptics.impact('medium')
    setEditingVehiculo(null)
    setSheetVisible(true)
  }, [])

  const handleEdit = useCallback((v: VehiculoCrudResult) => {
    setEditingVehiculo(v)
    setSheetVisible(true)
  }, [])

  const handleDeactivateRequest = useCallback((v: VehiculoCrudResult) => {
    setDeactivateTarget(v)
  }, [])

  const handleDeactivateConfirm = async () => {
    if (!deactivateTarget) return
    try {
      await deactivate(deactivateTarget.id)
      setFeedback({
        visible: true,
        variant: 'success',
        title: 'Vehículo desactivado',
        message: `${deactivateTarget.patente} fue desactivado correctamente.`,
      })
    } catch {
      setFeedback({
        visible: true,
        variant: 'danger',
        title: 'Error',
        message: 'No se pudo desactivar el vehículo. Intente nuevamente.',
      })
    } finally {
      setDeactivateTarget(null)
    }
  }

  // ── Render item ──────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: VehiculoCrudResult }) => (
      <VehiculoCard
        vehiculo={item}
        onEdit={handleEdit}
        onDeactivate={handleDeactivateRequest}
      />
    ),
    [handleEdit, handleDeactivateRequest],
  )

  // ── List data ──────────────────────────────────────────────────────────────
  // VehiculoCrudResult now extends the generated VehiculoDto (id/patente/modelo/
  // capacidadCargaKg are required in the contract) and only adds an OPTIONAL
  // `activo` the list endpoint doesn't return, so Vehiculo[] is directly
  // assignable — no cast needed.
  const list: VehiculoCrudResult[] = vehiculos ?? []

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <RequirePermission module="MOD_VIAJES" action="read" mode="screen">
      <View style={{ flex: 1, backgroundColor: colors.bg }}>

        {/* Header */}
        <LogisticaHeader title="VEHÍCULOS" statusText="FLOTA ACTIVA" paddingBottom={14} />

        {/* List */}
        <DataList
          data={list}
          renderItem={renderItem}
          estimatedItemSize={140}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 140 }}
          isLoading={isLoading}
          isRefetching={isRefetching}
          onRefresh={refetch}
          emptyMessage="Sin vehículos registrados. Tocá el botón + para agregar el primero."
        />

        {/* FAB */}
        <MotiView
          from={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 15 }}
          style={{ position: 'absolute', bottom: insets.bottom + 20, right: 20 }}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleOpenCreate}
            style={[styles.fab, { backgroundColor: colors.primary }]}
            accessibilityLabel="Agregar vehículo"
            accessibilityRole="button"
          >
            <Plus size={32} color="#000" strokeWidth={3} />
          </TouchableOpacity>
        </MotiView>

        {/* Create / Edit sheet */}
        <VehiculoFormSheet
          visible={sheetVisible}
          vehiculo={editingVehiculo}
          onClose={() => {
            setSheetVisible(false)
            setEditingVehiculo(null)
          }}
          onSuccess={(message) =>
            setFeedback({ visible: true, variant: 'success', title: 'Éxito', message })
          }
          onError={(message) =>
            setFeedback({ visible: true, variant: 'danger', title: 'Error', message })
          }
        />

        {/* Deactivate confirmation */}
        <ConfirmModal
          visible={deactivateTarget !== null}
          title="Desactivar vehículo"
          message={`¿Desactivar ${deactivateTarget?.patente ?? ''}? Esta acción no se puede deshacer desde la app (v1).`}
          variant="danger"
          confirmLabel={isDeactivating ? 'Desactivando...' : 'Desactivar'}
          onConfirm={handleDeactivateConfirm}
          onCancel={() => setDeactivateTarget(null)}
        />

        {/* Feedback modal */}
        <ConfirmModal
          visible={feedback.visible}
          title={feedback.title}
          message={feedback.message}
          variant={feedback.variant}
          confirmLabel="Aceptar"
          onConfirm={() => setFeedback((f) => ({ ...f, visible: false }))}
          onCancel={() => setFeedback((f) => ({ ...f, visible: false }))}
        />
      </View>
    </RequirePermission>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  accessTitle: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Outfit_700Bold',
    marginBottom: 8,
  },
  accessSubtitle: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Outfit_700Bold',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
    textAlign: 'center',
    lineHeight: 20,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00d1c1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
  },
})
