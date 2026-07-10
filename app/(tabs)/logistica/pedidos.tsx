import React, { useState, useMemo, useCallback } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { useNavigation } from 'expo-router'
import { Package, FileText, Loader, AlertCircle, ChevronLeft, Download } from 'lucide-react-native'
import { GlassCard, RequirePermission, DataList, ConfirmModal } from '@/core/ui'
import { useColors, BRAND, tokens } from '@/libs/theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MotiView } from 'moti'
import { useInfiniteVentas } from '@/libs/api-client/ventas'
import { getEtiquetasUrl, getNotaEntregaUrl } from '@/libs/api-client/ventas'
import { getVentaStatusConfig } from '@/core/constants/status'
import { canDownloadEtiquetas, canDownloadNotaEntrega } from '@/src/features/pedidos/lib/pedido-pdf-gating'
import { sharePdf } from '@/src/features/pedidos/lib/sharePdf'
import { safeHaptics } from '@/core/utils/haptics'
import type { Venta } from '@/libs/api-client'

// ── PedidoCard ────────────────────────────────────────────────────────────────

interface PdfActionState {
  loading: 'etiquetas' | 'nota' | null
  error: { title: string; message: string } | null
}

function PedidoCard({ item }: { item: Venta }) {
  const colors = useColors()
  const [pdfState, setPdfState] = useState<PdfActionState>({ loading: null, error: null })

  const statusConfig = getVentaStatusConfig(item.estado, colors)
  const code = `PED-${item.id?.substring(0, 8).toUpperCase() ?? '--------'}`
  const total = item.totalAmount
    ? `$ ${item.totalAmount.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : '—'

  const showEtiquetas = canDownloadEtiquetas(String(item.estado ?? ''))
  const showNota = canDownloadNotaEntrega(String(item.estado ?? ''))

  const handlePdf = useCallback(
    async (type: 'etiquetas' | 'nota') => {
      if (!item.id) return
      safeHaptics.impact('light')
      setPdfState({ loading: type, error: null })

      const url =
        type === 'etiquetas'
          ? getEtiquetasUrl(item.id)
          : getNotaEntregaUrl(item.id)

      const fileName =
        type === 'etiquetas'
          ? `etiquetas-${item.id.slice(0, 8)}.pdf`
          : `nota-entrega-${item.id.slice(0, 8)}.pdf`

      const result = await sharePdf(url, fileName)

      if (!result.ok) {
        const titles: Record<string, string> = {
          auth: 'Sesión expirada',
          network: 'Error de conexión',
          unavailable: 'No disponible',
          unknown: 'Error inesperado',
        }
        setPdfState({
          loading: null,
          error: { title: titles[result.reason] ?? 'Error', message: result.message },
        })
      } else {
        setPdfState({ loading: null, error: null })
      }
    },
    [item.id],
  )

  return (
    <View style={{ marginBottom: 12 }}>
      <GlassCard style={{ padding: 16 }}>
        {/* Header: code + estado badge */}
        <View style={styles.cardHeader}>
          <Text style={[styles.cardCode, { color: colors.text }]}>{code}</Text>
          <View style={[styles.estadoBadge, { backgroundColor: (statusConfig.bg as string) }]}>
            <Text style={[styles.estadoLabel, { color: statusConfig.color as string }]}>
              {statusConfig.label.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Client name */}
        <Text style={[styles.clientName, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.razonSocialCliente ?? 'Cliente no especificado'}
        </Text>

        {/* Total */}
        <Text style={[styles.total, { color: colors.text }]}>{total}</Text>

        {/* PDF actions — estado-gated */}
        {(showEtiquetas || showNota) && (
          <View style={styles.pdfActions}>
            {showEtiquetas && (
              <TouchableOpacity
                style={[styles.pdfBtn, { borderColor: BRAND.violet, backgroundColor: BRAND.violet + '15' }]}
                onPress={() => handlePdf('etiquetas')}
                disabled={pdfState.loading !== null}
                activeOpacity={0.7}
              >
                {pdfState.loading === 'etiquetas' ? (
                  <ActivityIndicator size="small" color={BRAND.violet} />
                ) : (
                  <Package size={14} color={BRAND.violet} />
                )}
                <Text style={[styles.pdfBtnLabel, { color: BRAND.violet }]}>Etiquetas</Text>
              </TouchableOpacity>
            )}

            {showNota && (
              <TouchableOpacity
                style={[styles.pdfBtn, { borderColor: colors.primary, backgroundColor: colors.primary + '15' }]}
                onPress={() => handlePdf('nota')}
                disabled={pdfState.loading !== null}
                activeOpacity={0.7}
              >
                {pdfState.loading === 'nota' ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <FileText size={14} color={colors.primary} />
                )}
                <Text style={[styles.pdfBtnLabel, { color: colors.primary }]}>Nota de venta</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </GlassCard>

      {/* Error modal */}
      {pdfState.error && (
        <ConfirmModal
          visible={!!pdfState.error}
          title={pdfState.error.title}
          message={pdfState.error.message}
          variant="warning"
          confirmLabel="Cerrar"
          cancelLabel=""
          onConfirm={() => setPdfState({ loading: null, error: null })}
          onCancel={() => setPdfState({ loading: null, error: null })}
          hideButtons={false}
        />
      )}
    </View>
  )
}

// ── PedidoCardSkeleton ────────────────────────────────────────────────────────

function PedidoCardSkeleton() {
  const colors = useColors()
  return (
    <GlassCard style={{ padding: 16, marginBottom: 12 }}>
      <View style={[styles.skeletonLine, { width: '40%', backgroundColor: colors.surface2 }]} />
      <View style={[styles.skeletonLine, { width: '70%', marginTop: 8, backgroundColor: colors.surface2 }]} />
      <View style={[styles.skeletonLine, { width: '30%', marginTop: 8, backgroundColor: colors.surface2 }]} />
    </GlassCard>
  )
}

// ── PedidosScreen ─────────────────────────────────────────────────────────────

export default function PedidosScreen() {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()

  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteVentas({ pageSize: 20, tipoOperacion: 2 })

  const ventas = useMemo(() => {
    return (
      data?.pages.flatMap((page) => {
        return ((page as any)?.data?.items ?? (page as any)?.items ?? []) as Venta[]
      }) ?? []
    )
  }, [data])

  const renderItem = useCallback(({ item }: { item: Venta }) => {
    return <PedidoCard item={item} />
  }, [])

  const header = useMemo(
    () => (
      <MotiView
        from={{ opacity: 0, translateY: -16 }}
        animate={{ opacity: 1, translateY: 0 }}
        style={{ marginBottom: tokens.spacing.lg }}
      >
        {/* Back button + title */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <ChevronLeft size={22} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.screenTitle, { color: colors.text }]}>PEDIDOS</Text>
            <View style={styles.subtitleRow}>
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>ESTADO DE ÓRDENES</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
          Lista de pedidos — solo lectura
        </Text>
      </MotiView>
    ),
    [colors, navigation],
  )

  return (
    <RequirePermission module="MOD_VIAJES" action="read" mode="screen">
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <DataList
          data={ventas}
          renderItem={renderItem}
          estimatedItemSize={140}
          ListHeaderComponent={header}
          contentContainerStyle={{
            paddingTop: insets.top + tokens.spacing.md,
            paddingHorizontal: tokens.spacing.md,
            paddingBottom: 120,
          }}
          isLoading={isLoading}
          isRefetching={isRefetching}
          onRefresh={refetch}
          onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
          isFetchingNextPage={isFetchingNextPage}
          SkeletonComponent={PedidoCardSkeleton}
          skeletonCount={4}
          emptyMessage="No hay pedidos disponibles."
        />
      </View>
    </RequirePermission>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardCode: { fontFamily: 'Outfit_700Bold', fontWeight: '800', fontSize: 14 },
  estadoBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  estadoLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  clientName: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  total: { fontSize: 16, fontWeight: '900', marginBottom: 10 },
  pdfActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  pdfBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1,
  },
  pdfBtnLabel: { fontSize: 12, fontWeight: '700' },
  skeletonLine: { height: 14, borderRadius: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  screenTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -1 },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  subtitle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
})
