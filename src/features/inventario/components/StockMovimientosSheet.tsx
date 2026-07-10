/**
 * StockMovimientosSheet — Movement history bottom sheet for an inventory item.
 *
 * Opened from StockDetailSheet via "Ver movimientos" button.
 * Shows: tipo (colored badge), signed cantidad, observación, usuario.
 * Light/dark via theme tokens. Accessible. Reduced-motion respected (no entrance animation).
 *
 * Parity with web StockMovimientosPanel (FASE 3).
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  Modal,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native'
import { MotiView } from 'moti'
import { useReducedMotion } from 'react-native-reanimated'
import { X, History, TrendingUp, TrendingDown, ArrowLeftRight, Sliders, ChevronLeft, ChevronRight } from 'lucide-react-native'
import { useColors, useIsDark } from '@/libs/theme'
import { useMovimientosStock } from '@/libs/api-client/stock'
import type { MovimientoStockHistorialDto } from '@/libs/api-client/types'

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface StockMovimientosSheetProps {
  productoId: string
  productoNombre: string
  visible: boolean
  onClose: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function formatCantidad(cantidad: number): string {
  const sign = cantidad > 0 ? '+' : ''
  return `${sign}${cantidad}`
}

type BadgeColors = { bg: string; text: string }

function getTipoBadgeColors(tipoLabel: string, cantidad: number, isDark: boolean): BadgeColors {
  if (tipoLabel === 'Venta') {
    return {
      bg: isDark ? 'rgba(239,68,68,0.20)' : 'rgba(239,68,68,0.12)',
      text: isDark ? '#f87171' : '#dc2626',
    }
  }
  if (tipoLabel === 'Compra') {
    return {
      bg: isDark ? 'rgba(34,197,94,0.20)' : 'rgba(34,197,94,0.12)',
      text: isDark ? '#4ade80' : '#16a34a',
    }
  }
  if (tipoLabel === 'Ajuste') {
    return cantidad >= 0
      ? {
          bg: isDark ? 'rgba(34,197,94,0.20)' : 'rgba(34,197,94,0.12)',
          text: isDark ? '#4ade80' : '#16a34a',
        }
      : {
          bg: isDark ? 'rgba(249,115,22,0.20)' : 'rgba(249,115,22,0.12)',
          text: isDark ? '#fb923c' : '#ea580c',
        }
  }
  // Transferencia / unknown
  return {
    bg: isDark ? 'rgba(99,102,241,0.20)' : 'rgba(99,102,241,0.12)',
    text: isDark ? '#a5b4fc' : '#4f46e5',
  }
}

function TipoIcon({ tipoLabel, color }: { tipoLabel: string; color: string }) {
  const props = { size: 10, color, strokeWidth: 2.5 }
  if (tipoLabel === 'Venta') return <TrendingDown {...props} />
  if (tipoLabel === 'Compra') return <TrendingUp {...props} />
  if (tipoLabel === 'Ajuste') return <Sliders {...props} />
  return <ArrowLeftRight {...props} />
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function MovimientoRow({ mov }: { mov: MovimientoStockHistorialDto }) {
  const colors = useColors()
  const isDark = useIsDark()

  const { bg, text: badgeText } = getTipoBadgeColors(mov.tipoLabel, mov.cantidad, isDark)

  const cantidadColor =
    mov.cantidad > 0
      ? colors.success
      : mov.cantidad < 0
        ? colors.danger
        : colors.textMuted

  return (
    <View
      style={[
        styles.row,
        {
          borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        },
      ]}
      accessible
      accessibilityLabel={`${mov.tipoLabel}: ${formatCantidad(mov.cantidad)} unidades. ${mov.observacion ?? ''}. ${mov.usuarioNombre}`}
    >
      {/* Top row: badge + date + cantidad */}
      <View style={styles.rowTop}>
        <View style={styles.rowTopLeft}>
          {/* Tipo badge */}
          <View style={[styles.badge, { backgroundColor: bg }]}>
            <TipoIcon tipoLabel={mov.tipoLabel} color={badgeText} />
            <Text style={[styles.badgeText, { color: badgeText }]}>{mov.tipoLabel}</Text>
          </View>
          <Text style={[styles.dateText, { color: colors.textMuted }]}>
            {formatDate(mov.fecha)}
          </Text>
        </View>
        {/* Signed cantidad */}
        <Text style={[styles.cantidad, { color: cantidadColor }]}>
          {formatCantidad(mov.cantidad)}
        </Text>
      </View>

      {/* Observacion */}
      {mov.observacion ? (
        <Text style={[styles.observacion, { color: colors.textMuted }]} numberOfLines={2}>
          {mov.observacion}
        </Text>
      ) : null}

      {/* Usuario */}
      <Text style={[styles.usuario, { color: colors.textMuted }]}>{mov.usuarioNombre}</Text>
    </View>
  )
}

function EmptyState({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.centered}>
      <History size={40} color={colors.textMuted} strokeWidth={1} />
      <Text style={[styles.stateText, { color: colors.textMuted }]}>
        No hay movimientos registrados.
      </Text>
    </View>
  )
}

function LoadingState({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={[styles.stateText, { color: colors.textMuted }]}>
        Cargando historial…
      </Text>
    </View>
  )
}

function ErrorState({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.centered}>
      <Text style={[styles.stateText, { color: colors.danger }]}>
        No se pudo cargar el historial.
      </Text>
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

export function StockMovimientosSheet({
  productoId,
  productoNombre,
  visible,
  onClose,
}: StockMovimientosSheetProps) {
  const colors = useColors()
  const isDark = useIsDark()
  const reducedMotion = useReducedMotion()
  const [page, setPage] = useState(1)

  const { data, isLoading, isError } = useMovimientosStock({
    productoId,
    pageNumber: page,
    pageSize: PAGE_SIZE,
  })

  const movimientos = data?.items ?? []
  const totalPages = data?.totalPages ?? 1
  const hasNext = data?.hasNextPage ?? false
  const hasPrev = page > 1

  const sheetBg = colors.surface
  const borderColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'

  // Reset to page 1 when closing
  const handleClose = () => {
    setPage(1)
    onClose()
  }

  const sheetAnimation = reducedMotion
    ? { from: {}, animate: {} }
    : { from: { translateY: 600, opacity: 0 }, animate: { translateY: 0, opacity: 1 } }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
      accessibilityViewIsModal
    >
      {/* Backdrop */}
      <Pressable
        style={styles.backdrop}
        onPress={handleClose}
        accessibilityLabel="Cerrar historial"
        accessibilityRole="button"
      />

      {/* Bottom Sheet */}
      <MotiView
        from={sheetAnimation.from}
        animate={sheetAnimation.animate}
        transition={{ type: 'spring', damping: 26, stiffness: 200 }}
        style={[
          styles.sheet,
          { backgroundColor: sheetBg, borderColor },
        ]}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            },
          ]}
        >
          <History size={16} color={colors.textMuted} />
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Historial de movimientos
            </Text>
            <Text style={[styles.headerSub, { color: colors.textMuted }]} numberOfLines={1}>
              {productoNombre}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleClose}
            style={[
              styles.closeBtn,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Cerrar historial"
          >
            <X size={16} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Body */}
        {isLoading && <LoadingState colors={colors} />}
        {isError && <ErrorState colors={colors} />}
        {!isLoading && !isError && movimientos.length === 0 && (
          <EmptyState colors={colors} />
        )}
        {!isLoading && !isError && movimientos.length > 0 && (
          <FlatList
            data={movimientos}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <MovimientoRow mov={item} />}
            showsVerticalScrollIndicator={false}
            style={styles.list}
            testID="movimientos-list"
          />
        )}

        {/* Pagination footer */}
        {!isLoading && !isError && totalPages > 1 && (
          <View
            style={[
              styles.pagination,
              {
                borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!hasPrev}
              accessibilityRole="button"
              accessibilityLabel="Página anterior"
              style={[styles.pageBtn, !hasPrev && styles.pageBtnDisabled]}
            >
              <ChevronLeft size={14} color={hasPrev ? colors.text : colors.textMuted} />
              <Text style={[styles.pageBtnText, { color: hasPrev ? colors.text : colors.textMuted }]}>
                Anterior
              </Text>
            </TouchableOpacity>

            <Text style={[styles.pageInfo, { color: colors.textMuted }]}>
              {page} / {totalPages}
            </Text>

            <TouchableOpacity
              onPress={() => setPage((p) => p + 1)}
              disabled={!hasNext}
              accessibilityRole="button"
              accessibilityLabel="Página siguiente"
              style={[styles.pageBtn, !hasNext && styles.pageBtnDisabled]}
            >
              <Text style={[styles.pageBtnText, { color: hasNext ? colors.text : colors.textMuted }]}>
                Siguiente
              </Text>
              <ChevronRight size={14} color={hasNext ? colors.text : colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}
      </MotiView>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontSize: 14,
    fontFamily: 'Outfit_900Black',
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  // List
  list: {
    flex: 1,
  },
  row: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: 'Outfit_900Black',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dateText: {
    fontSize: 10,
    fontFamily: 'Outfit_600SemiBold',
    flex: 1,
  },
  cantidad: {
    fontSize: 16,
    fontFamily: 'Outfit_900Black',
    letterSpacing: -0.3,
    tabularNums: true,
  } as any,
  observacion: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    lineHeight: 16,
  },
  usuario: {
    fontSize: 10,
    fontFamily: 'Outfit_600SemiBold',
  },
  // States
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  stateText: {
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
    textAlign: 'center',
  },
  // Pagination
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  pageBtnDisabled: {
    opacity: 0.35,
  },
  pageBtnText: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
  },
  pageInfo: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
  },
})
