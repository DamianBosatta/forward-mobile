/**
 * picking.tsx — Picking Board screen.
 *
 * Gated by RequirePermission(MOD_VIAJES:read) — any holder (not management-only).
 *
 * Data flow:
 *   useVentasParaPreparacion → partitionByEstado → three sections in DataList
 *
 * Multi-select: uses logistica.store selectedConfirmadas (A Preparar bucket).
 * Per-card actions: Iniciar / Marcar preparado + Revertir / Etiquetas + Revertir.
 * BulkActionBar: visible when selectedCount > 0.
 *
 * Slice 2 (PR2) — depends on PR0 foundation.
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SectionList,
  RefreshControl,
} from 'react-native'
import { Package, AlertTriangle, RotateCcw, ScanLine } from 'lucide-react-native'
import { useColors, useIsDark } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { RequirePermission, ConfirmModal, Skeleton, useToast, TopHeaderActions } from '@/core/ui'
import { safeHaptics } from '@/core/utils/haptics'
import { LogisticaHeader } from '@/src/features/logistica/components/LogisticaHeader'
import {
  useVentasParaPreparacion,
  useIniciarPreparacion,
  useRevertirAConfirmada,
  useRevertirAPreparacion,
  getEtiquetasMasivasUrl,
  getSurtidoPdfUrl,
  type VentaPreparacion,
  type VentasPreparacionParams,
} from '@/libs/api-client/logistica'
import { getEtiquetasUrl } from '@/libs/api-client/ventas'
import { sharePdf } from '@/src/features/pedidos/lib/sharePdf'
import { partitionByEstado } from '@/src/features/logistica/lib/picking-board-logic'
import { useLogisticaStore } from '@/src/features/logistica/store/logistica.store'
import { PickingCard } from '@/src/features/logistica/components/picking/PickingCard'
import { MarcarPreparadoSheet } from '@/src/features/logistica/components/picking/MarcarPreparadoSheet'
import { BulkActionBar } from '@/src/features/logistica/components/picking/BulkActionBar'
import { PickingFilters, type EstadoFilter } from '@/src/features/logistica/components/picking/PickingFilters'
import { PickingBoardTablet } from '@/src/features/logistica/components/picking/PickingBoardTablet'
import { PickingDateFilter } from '@/src/features/logistica/components/picking/PickingDateFilter'
import { ScannerModal } from '@/src/features/logistica/components/picking/ScannerModal'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Format a Date as YYYY-MM-DD in local time for the VentasPreparacionParams API. */
function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function PickingScreen() {
  const colors = useColors()
  const isDark = useIsDark()
  const { isLarge } = useResponsive()
  const { show: showToast } = useToast()

  // ── Filter state ─────────────────────────────────────────────────────────
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>(null)
  // Date filter state — kept as Date | null so PickingDateFilter can drive the pickers
  // directly. Converted to ISO strings in the memoized queryParams below.
  const [fechaDesde, setFechaDesde] = useState<Date | null>(null)
  const [fechaHasta, setFechaHasta] = useState<Date | null>(null)

  // Derived query params — re-memoized only when dates change. When both are null
  // (initial state) this is {}, identical to the previous fixed value.
  const queryParams = useMemo<VentasPreparacionParams>(
    () => ({
      ...(fechaDesde ? { fechaDesde: toISODate(fechaDesde) } : {}),
      ...(fechaHasta ? { fechaHasta: toISODate(fechaHasta) } : {}),
    }),
    [fechaDesde, fechaHasta],
  )

  // Clear phone estado filter when entering tablet mode — the board shows all
  // 3 columns so the filter is irrelevant, and it must not silently re-apply
  // when the user returns to phone layout.
  useEffect(() => {
    if (isLarge) setEstadoFilter(null)
  }, [isLarge])

  // ── Data ─────────────────────────────────────────────────────────────────
  const {
    data: ventas,
    isLoading,
    isRefetching,
    isError,
    refetch,
  } = useVentasParaPreparacion(queryParams)

  // ── Mutations ────────────────────────────────────────────────────────────
  const { mutateAsync: iniciarPreparacion, isPending: isIniciarPending } =
    useIniciarPreparacion()
  const { mutateAsync: revertirAConfirmada } = useRevertirAConfirmada()
  const { mutateAsync: revertirAPreparacion } = useRevertirAPreparacion()

  // ── Store ─────────────────────────────────────────────────────────────────
  const {
    selectedConfirmadas,
    toggleConfirmada,
    removeConfirmada,
    selectAllConfirmadas,
    clearConfirmadas,
  } = useLogisticaStore()

  // ── Scanner state ─────────────────────────────────────────────────────────
  const [scannerVisible, setScannerVisible] = useState(false)
  const [scannedVentaId, setScannedVentaId] = useState<string | null>(null)
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear highlight timer on unmount
  useEffect(() => {
    return () => {
      if (highlightTimerRef.current !== null) clearTimeout(highlightTimerRef.current)
    }
  }, [])

  // ── MarcarPreparado sheet state ──────────────────────────────────────────
  const [marcarPreparadoVenta, setMarcarPreparadoVenta] =
    useState<VentaPreparacion | null>(null)

  // ── Feedback modal state ─────────────────────────────────────────────────
  const [feedback, setFeedback] = useState<{
    visible: boolean
    variant: 'success' | 'danger'
    title: string
    message: string
  }>({ visible: false, variant: 'success', title: '', message: '' })

  // ── Derived data ─────────────────────────────────────────────────────────
  const allVentas = ventas ?? []
  const { aPreparar, enPreparacion, empacados } = useMemo(
    () => partitionByEstado(allVentas),
    [allVentas],
  )

  const selectedIds = Object.keys(selectedConfirmadas)
  const selectedCount = selectedIds.length

  // Apply estado filter for section list
  const sections = useMemo(() => {
    const all = [
      { title: 'A Preparar', data: aPreparar, key: 'aPreparar' },
      { title: 'En Preparación', data: enPreparacion, key: 'enPreparacion' },
      { title: 'Empacados', data: empacados, key: 'empacados' },
    ]

    if (estadoFilter === null) return all.filter((s) => s.data.length > 0)

    // Map estadoFilter integer to section key
    const filterKey =
      estadoFilter === 2
        ? 'aPreparar'
        : estadoFilter === 3
        ? 'enPreparacion'
        : 'empacados'

    return all.filter((s) => s.key === filterKey && s.data.length > 0)
  }, [aPreparar, enPreparacion, empacados, estadoFilter])

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleToggleSelect = useCallback(
    (id: string) => {
      toggleConfirmada(id)
    },
    [toggleConfirmada],
  )

  const handleIniciarSingle = useCallback(
    async (id: string) => {
      try {
        await iniciarPreparacion([id])
        // Drop this id from the A-Preparar selection so it does not leak into a
        // later bulk action (it has already advanced to EnPreparacion).
        removeConfirmada(id)
        safeHaptics.notification('success')
      } catch {
        setFeedback({
          visible: true,
          variant: 'danger',
          title: 'Error',
          message: 'No se pudo iniciar la preparación. Intente nuevamente.',
        })
      }
    },
    [iniciarPreparacion, removeConfirmada],
  )

  const handleIniciarMasiva = useCallback(
    async (ids: string[]) => {
      try {
        await iniciarPreparacion(ids)
        clearConfirmadas()
        safeHaptics.notification('success')
      } catch {
        setFeedback({
          visible: true,
          variant: 'danger',
          title: 'Error',
          message: 'No se pudo iniciar la preparación. Intente nuevamente.',
        })
      }
    },
    [iniciarPreparacion, clearConfirmadas],
  )

  const handleRevertirAConfirmada = useCallback(
    async (id: string) => {
      try {
        await revertirAConfirmada(id)
        safeHaptics.notification('success')
      } catch {
        setFeedback({
          visible: true,
          variant: 'danger',
          title: 'Error',
          message: 'No se pudo revertir la venta. Intente nuevamente.',
        })
      }
    },
    [revertirAConfirmada],
  )

  const handleRevertirAPreparacion = useCallback(
    async (id: string) => {
      try {
        await revertirAPreparacion(id)
        safeHaptics.notification('success')
      } catch {
        setFeedback({
          visible: true,
          variant: 'danger',
          title: 'Error',
          message: 'No se pudo revertir la venta. Intente nuevamente.',
        })
      }
    },
    [revertirAPreparacion],
  )

  const handleEtiquetasSingle = useCallback(async (id: string) => {
    const result = await sharePdf(
      getEtiquetasUrl(id),
      `etiquetas-${id.slice(0, 8)}.pdf`,
    )
    if (!result.ok) {
      setFeedback({
        visible: true,
        variant: 'danger',
        title: 'Error',
        message: result.message,
      })
    }
  }, [])

  const handleSurtidoPdf = useCallback(async (ids: string[]) => {
    const result = await sharePdf(
      getSurtidoPdfUrl(),
      `surtido-${Date.now()}.pdf`,
      { method: 'POST', body: { ventaIds: ids } },
    )
    if (!result.ok) {
      setFeedback({
        visible: true,
        variant: 'danger',
        title: 'Error al compartir',
        message: result.message,
      })
    }
  }, [])

  const handleEtiquetasMasivas = useCallback(async (ids: string[]) => {
    const result = await sharePdf(
      getEtiquetasMasivasUrl(ids),
      `etiquetas-masivas-${Date.now()}.pdf`,
    )
    if (!result.ok) {
      setFeedback({
        visible: true,
        variant: 'danger',
        title: 'Error al compartir',
        message: result.message,
      })
    }
  }, [])

  const handleScanResult = useCallback(
    (value: string) => {
      setScannerVisible(false)
      // Match by id (only human-readable identifier available in VentaPreparacion)
      const found = allVentas.find((v) => v.id === value)
      if (!found) {
        showToast(`Venta no encontrada: ${value}`, 'error')
        return
      }
      // Highlight the matched card for 3s
      if (highlightTimerRef.current !== null) clearTimeout(highlightTimerRef.current)
      setScannedVentaId(found.id)
      highlightTimerRef.current = setTimeout(() => {
        setScannedVentaId(null)
        highlightTimerRef.current = null
      }, 3000)
    },
    [allVentas, showToast],
  )

  const handleMarcarPreparadoSuccess = useCallback(() => {
    setMarcarPreparadoVenta(null)
    showToast('La venta fue marcada como empacada', 'success')
  }, [showToast])

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: VentaPreparacion }) => (
      <PickingCard
        venta={item}
        isSelected={!!selectedConfirmadas[item.id]}
        highlighted={scannedVentaId === item.id}
        onToggleSelect={handleToggleSelect}
        onIniciar={handleIniciarSingle}
        onMarcarPreparado={setMarcarPreparadoVenta}
        onRevertirAConfirmada={handleRevertirAConfirmada}
        onEtiquetas={handleEtiquetasSingle}
        onRevertirAPreparacion={handleRevertirAPreparacion}
      />
    ),
    [
      selectedConfirmadas,
      scannedVentaId,
      handleToggleSelect,
      handleIniciarSingle,
      handleRevertirAConfirmada,
      handleEtiquetasSingle,
      handleRevertirAPreparacion,
    ],
  )

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string; data: VentaPreparacion[] } }) => {
      // When a single-estado chip filter is active there is only one section and
      // the active chip already labels it — suppress the redundant header.
      if (estadoFilter !== null) return null
      return (
        <View
          style={[
            styles.sectionHeader,
            { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : colors.bg + 'EE' },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            {section.title}
          </Text>
          <View style={[styles.sectionBadge, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.sectionCount, { color: colors.primary }]}>
              {section.data.length}
            </Text>
          </View>
        </View>
      )
    },
    [isDark, colors, estadoFilter],
  )

  const isEmpty = sections.length === 0 && !isLoading && !isError

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <RequirePermission module="MOD_VIAJES" action="read" mode="screen">
      <View style={{ flex: 1, backgroundColor: colors.bg }}>

        {/* Header */}
        <LogisticaHeader
          title="PICKING"
          statusText={`${allVentas.length} VENTAS`}
          paddingBottom={8}
          right={
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={[
                  styles.scanBtn,
                  { backgroundColor: isDark ? '#111' : colors.surface },
                ]}
                onPress={() => setScannerVisible(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Escanear código de barras"
                hitSlop={8}
              >
                <ScanLine size={20} color={colors.primary} strokeWidth={2} />
              </TouchableOpacity>
              <TopHeaderActions />
            </View>
          }
        >
          {/* Phone: estado chip filter (hidden on tablet — columns segregate by estado) */}
          <PickingFilters
            estadoFilter={estadoFilter}
            onEstadoFilterChange={setEstadoFilter}
            hideEstado={isLarge}
          />

          {/* Date range filter — phone and tablet */}
          <PickingDateFilter
            fechaDesde={fechaDesde}
            fechaHasta={fechaHasta}
            onFechaDesdeChange={setFechaDesde}
            onFechaHastaChange={setFechaHasta}
          />
        </LogisticaHeader>

        {/* Content */}
        {isLoading ? (
          // Skeleton placeholder — 5 rows shaped like PickingCard (phone layout only)
          <View style={styles.skeletonContainer}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={[
                  styles.skeletonCard,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.surface,
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border,
                  },
                ]}
              >
                <View style={styles.skeletonMainRow}>
                  <Skeleton width={38} height={38} borderRadius={12} />
                  <View style={styles.skeletonInfo}>
                    <Skeleton width="70%" height={16} borderRadius={6} />
                    <Skeleton width="50%" height={12} borderRadius={4} style={{ marginTop: 4 }} />
                    <View style={styles.skeletonMeta}>
                      <Skeleton width={60} height={12} borderRadius={4} />
                      <Skeleton width={40} height={12} borderRadius={4} />
                    </View>
                  </View>
                </View>
                <View
                  style={[
                    styles.skeletonActions,
                    { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : colors.border },
                  ]}
                >
                  <Skeleton width={80} height={12} borderRadius={4} />
                </View>
              </View>
            ))}
          </View>
        ) : isError ? (
          <View style={styles.centered}>
            <View
              style={[
                styles.emptyIconWrap,
                { backgroundColor: colors.danger + '18' },
              ]}
            >
              <AlertTriangle size={40} color={colors.danger} strokeWidth={1.5} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No se pudieron cargar las ventas
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              Verificá tu conexión e intentá nuevamente.
            </Text>
            <TouchableOpacity
              onPress={() => {
                safeHaptics.impact('light')
                refetch()
              }}
              style={[styles.retryBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
              accessibilityLabel="Reintentar"
              accessibilityRole="button"
            >
              <RotateCcw size={16} color="#000" strokeWidth={2.5} />
              <Text style={styles.retryLabel}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : isLarge ? (
          // Tablet (≥600dp): 3-column kanban board. Each column scrolls independently.
          // BulkActionBar, MarcarPreparadoSheet, and ConfirmModal remain mounted here
          // (outside PickingBoardTablet) so they are shared with the phone layout and
          // avoid being unmounted on breakpoint changes.
          <PickingBoardTablet
            aPreparar={aPreparar}
            enPreparacion={enPreparacion}
            empacados={empacados}
            selectedConfirmadas={selectedConfirmadas}
            onToggleSelect={handleToggleSelect}
            onIniciar={handleIniciarSingle}
            onMarcarPreparado={setMarcarPreparadoVenta}
            onRevertirAConfirmada={handleRevertirAConfirmada}
            onEtiquetas={handleEtiquetasSingle}
            onRevertirAPreparacion={handleRevertirAPreparacion}
            isRefetching={isRefetching}
            refetch={refetch}
          />
        ) : isEmpty ? (
          // Phone: global empty state when all sections are empty
          <View style={styles.centered}>
            <View
              style={[
                styles.emptyIconWrap,
                { backgroundColor: colors.primary + '18' },
              ]}
            >
              <Package size={40} color={colors.primary} strokeWidth={1.5} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Sin ventas para preparar
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              No hay ventas que coincidan con el filtro seleccionado.
            </Text>
          </View>
        ) : (
          // Phone: SectionList with 3 sticky sections — behavior byte-identical to pre-PR5.
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            stickySectionHeadersEnabled
            contentContainerStyle={{
              paddingTop: 4,
              paddingBottom: selectedCount > 0 ? 140 : 24,
            }}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={colors.primary}
              />
            }
          />
        )}

        {/* Bulk action bar (visible when selections > 0).
            variant='floating' on tablet — centered card that does not overlay all 3 columns. */}
        <BulkActionBar
          selectedCount={selectedCount}
          selectedIds={selectedIds}
          isIniciarPending={isIniciarPending}
          onIniciarMasiva={handleIniciarMasiva}
          onSurtidoPdf={handleSurtidoPdf}
          onEtiquetasMasivas={handleEtiquetasMasivas}
          variant={isLarge ? 'floating' : 'default'}
        />

        {/* Marcar preparado sheet */}
        <MarcarPreparadoSheet
          visible={marcarPreparadoVenta !== null}
          venta={marcarPreparadoVenta}
          onClose={() => setMarcarPreparadoVenta(null)}
          onSuccess={handleMarcarPreparadoSuccess}
          onError={(message) =>
            setFeedback({ visible: true, variant: 'danger', title: 'Error', message })
          }
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

        {/* Barcode scanner modal */}
        <ScannerModal
          visible={scannerVisible}
          onClose={() => setScannerVisible(false)}
          onScanned={handleScanResult}
        />
      </View>
    </RequirePermission>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.15)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionBadge: {
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  sectionCount: {
    fontSize: 11,
    fontFamily: 'Outfit_800ExtraBold',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
  },
  skeletonContainer: {
    paddingTop: 4,
    paddingBottom: 24,
  },
  skeletonCard: {
    marginHorizontal: 16,
    marginVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  skeletonMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 10,
  },
  skeletonInfo: {
    flex: 1,
    gap: 4,
  },
  skeletonMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  skeletonActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryLabel: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'Outfit_800ExtraBold',
    color: '#000',
  },
})
