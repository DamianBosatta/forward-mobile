/**
 * PickingBoardTablet — 3-column kanban board for isLarge (≥600dp) screens.
 *
 * Renders one FlashList per column (A Preparar / En Preparación / Empacados),
 * fed by the same partitionByEstado outputs as the phone SectionList.
 * Each column scrolls independently. Column movements are driven exclusively
 * by action buttons (same as the web source of truth — no drag-and-drop).
 *
 * Business logic lives entirely in picking.tsx:
 *   - mutations (iniciarPreparacion, revertirAConfirmada, revertirAPreparacion)
 *   - MarcarPreparadoSheet (mounted once, shared with phone layout)
 *   - BulkActionBar (mounted once, shared — rendered with variant='floating')
 *   - ConfirmModal feedback
 *
 * PickingBoardTablet is a pure layout component — it receives data and callbacks,
 * renders PickingCard as-is, and adds no business logic of its own.
 */

import React, { useCallback } from 'react'
import { View, Text, StyleSheet, RefreshControl } from 'react-native'
import { FlashList } from '@shopify/flash-list'

// FlashList v2.0.2 removed estimatedItemSize from its public types; cast to any
// to pass the hint for performance (same pattern as RouteSelector.tsx).
const FlashListAny = FlashList as any
import { Package } from 'lucide-react-native'
import { useColors, useIsDark } from '@/libs/theme'
import { PickingCard } from './PickingCard'
import type { VentaPreparacion } from '@/libs/api-client/logistica'

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface PickingBoardTabletProps {
  /** A Preparar partition (estado=2) from partitionByEstado */
  aPreparar: VentaPreparacion[]
  /** En Preparación partition (estado=3) from partitionByEstado */
  enPreparacion: VentaPreparacion[]
  /** Empacados partition (estado=4) from partitionByEstado */
  empacados: VentaPreparacion[]
  /** Currently selected confirmadas (A Preparar multi-select) */
  selectedConfirmadas: Record<string, boolean>
  /** Callbacks — same signatures as the phone SectionList handlers */
  onToggleSelect: (id: string) => void
  onIniciar: (id: string) => void
  onMarcarPreparado: (venta: VentaPreparacion) => void
  onRevertirAConfirmada: (id: string) => void
  onEtiquetas: (id: string) => void
  onRevertirAPreparacion: (id: string) => void
  isRefetching: boolean
  refetch: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal types
// ─────────────────────────────────────────────────────────────────────────────

interface ColumnDescriptor {
  title: string
  data: VentaPreparacion[]
  testID: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function PickingBoardTablet({
  aPreparar,
  enPreparacion,
  empacados,
  selectedConfirmadas,
  onToggleSelect,
  onIniciar,
  onMarcarPreparado,
  onRevertirAConfirmada,
  onEtiquetas,
  onRevertirAPreparacion,
  isRefetching,
  refetch,
}: PickingBoardTabletProps) {
  const colors = useColors()
  const isDark = useIsDark()

  // Single renderItem reused across all 3 columns.
  // PickingCard checks venta.estado internally to render the correct actions.
  const renderCard = useCallback(
    ({ item }: { item: VentaPreparacion }) => (
      <PickingCard
        venta={item}
        isSelected={!!selectedConfirmadas[item.id]}
        onToggleSelect={onToggleSelect}
        onIniciar={onIniciar}
        onMarcarPreparado={onMarcarPreparado}
        onRevertirAConfirmada={onRevertirAConfirmada}
        onEtiquetas={onEtiquetas}
        onRevertirAPreparacion={onRevertirAPreparacion}
      />
    ),
    [
      selectedConfirmadas,
      onToggleSelect,
      onIniciar,
      onMarcarPreparado,
      onRevertirAConfirmada,
      onEtiquetas,
      onRevertirAPreparacion,
    ],
  )

  const columns: ColumnDescriptor[] = [
    { title: 'A Preparar', data: aPreparar, testID: 'col-a-preparar' },
    { title: 'En Preparación', data: enPreparacion, testID: 'col-en-preparacion' },
    { title: 'Empacados', data: empacados, testID: 'col-empacados' },
  ]

  const colBorderColor = isDark ? 'rgba(255,255,255,0.06)' : colors.border

  return (
    <View style={styles.board}>
      {columns.map((col, idx) => (
        <View
          key={col.testID}
          style={[
            styles.column,
            { borderRightColor: colBorderColor },
            idx === columns.length - 1 && styles.columnLast,
          ]}
          testID={col.testID}
        >
          {/* Column header: title + count badge */}
          <View
            style={[styles.colHeader, { borderBottomColor: colBorderColor }]}
          >
            <Text style={[styles.colTitle, { color: colors.textMuted }]}>
              {col.title}
            </Text>
            <View style={[styles.colBadge, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.colCount, { color: colors.primary }]}>
                {col.data.length}
              </Text>
            </View>
          </View>

          {/* Column content: list or per-column empty state */}
          {col.data.length === 0 ? (
            <View style={styles.emptyCol} testID={`${col.testID}-empty`}>
              <Package size={28} color={colors.textMuted} strokeWidth={1.5} />
              <Text style={[styles.emptyColText, { color: colors.textMuted }]}>
                Sin ventas
              </Text>
            </View>
          ) : (
            <FlashListAny
              data={col.data}
              keyExtractor={(item: VentaPreparacion) => item.id}
              renderItem={renderCard}
              estimatedItemSize={120}
              contentContainerStyle={styles.listContent}
              refreshControl={
                idx === 0 ? (
                  <RefreshControl
                    refreshing={isRefetching}
                    onRefresh={refetch}
                    tintColor={colors.primary}
                  />
                ) : undefined
              }
            />
          )}
        </View>
      ))}
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  board: {
    flex: 1,
    flexDirection: 'row',
  },
  column: {
    flex: 1,
    borderRightWidth: 1,
  },
  // Last column has no right border
  columnLast: {
    borderRightWidth: 0,
  },
  colHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
  },
  colTitle: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  colBadge: {
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  colCount: {
    fontSize: 11,
    fontFamily: 'Outfit_800ExtraBold',
  },
  emptyCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  emptyColText: {
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
    textAlign: 'center',
  },
  listContent: {
    paddingTop: 4,
    // Bottom padding reserves room for the floating BulkActionBar (~88dp + safe area)
    paddingBottom: 120,
  },
})
