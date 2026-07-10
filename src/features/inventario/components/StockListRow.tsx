/**
 * StockListRow — compact list-view alternative to StockCard (Slice 6, mobile).
 *
 * Design decisions:
 * - Denser than StockCard: small 36x36 thumbnail instead of the 88x88 hero image,
 *   single-line name, no inline action buttons (Ajustar/Toggle) — tapping the row
 *   opens the SAME detail sheet as StockCard, where those actions already live.
 * - No Reanimated entrance/pulse animation — kept intentionally simple, this is the
 *   "information density" view, not the "premium visual" view (that's StockCard's job).
 * - Same tap target (onOpenDetail) and alert-derivation logic as StockCard, so both
 *   views agree on what counts as "in alert".
 */

import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { Package, AlertTriangle } from 'lucide-react-native'
import { useColors, useIsDark } from '@/libs/theme'
import type { StockItem } from '@/libs/api-client/types'
import { getFullImageUrl } from '@/libs/api-client'
import { safeHaptics } from '@/core/utils/haptics'
import { derivarEstadoAlerta } from '../lib/alert-utils'

interface StockListRowProps {
  item: StockItem
  onOpenDetail: () => void
}

export const StockListRow = React.memo(function StockListRow({ item, onOpenDetail }: StockListRowProps) {
  const colors = useColors()
  const isDark = useIsDark()

  const { enAlerta } = derivarEstadoAlerta(item)
  const isInactive = item.activo === false
  const stockReal = item.cantidadActual ?? 0
  const stockMinimo = item.stockMinimo ?? 0
  const precio = (item as any).precioVenta ?? 0

  const accentColor = isInactive ? colors.danger : enAlerta ? colors.warning : colors.success

  return (
    <Pressable
      onPress={() => {
        safeHaptics.impact('light')
        onOpenDetail()
      }}
      accessibilityRole="button"
      accessibilityLabel={`${item.producto ?? 'Producto'}, stock ${stockReal} unidades${enAlerta ? ', en alerta' : ''}`}
      style={[
        styles.row,
        {
          backgroundColor: isDark ? '#080808' : '#ffffff',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
          borderLeftColor: accentColor,
          opacity: isInactive ? 0.55 : 1,
        },
      ]}
    >
      {/* Thumbnail */}
      <View style={[styles.thumb, { backgroundColor: isDark ? '#111' : '#f1f5f9' }]}>
        {item.imageUrl ? (
          <Image
            source={{ uri: getFullImageUrl(item.imageUrl) || item.imageUrl }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
          />
        ) : (
          <Package size={16} color={isDark ? '#2a2a2a' : '#cbd5e1'} strokeWidth={1} />
        )}
      </View>

      {/* Name + código/depósito */}
      <View style={styles.mainCol}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {item.producto ?? 'Sin nombre'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
          {item.codigoPropio ? `#${item.codigoPropio}` : ''}
          {item.codigoPropio && item.deposito ? ' · ' : ''}
          {item.deposito ?? ''}
        </Text>
      </View>

      {/* Stock real + mínimo */}
      <View style={styles.stockCol}>
        <View style={styles.stockRealRow}>
          {enAlerta && <AlertTriangle size={11} color={accentColor} />}
          <Text style={[styles.stockReal, { color: enAlerta ? accentColor : colors.text }]}>{stockReal}</Text>
        </View>
        <Text style={[styles.stockMinimo, { color: colors.textMuted }]}>mín. {stockMinimo}</Text>
      </View>

      {/* Precio */}
      <Text style={[styles.precio, { color: colors.textMuted }]} numberOfLines={1}>
        ${precio.toLocaleString('es-AR')}
      </Text>
    </Pressable>
  )
})

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginVertical: 3,
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 3,
    gap: 10,
  },
  thumb: {
    width: 36,
    height: 36,
    borderRadius: 9,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  mainCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  name: {
    fontSize: 13,
    fontFamily: 'Outfit_800ExtraBold',
  },
  subtitle: {
    fontSize: 10,
    fontFamily: 'Outfit_600SemiBold',
  },
  stockCol: {
    alignItems: 'flex-end',
    flexShrink: 0,
    minWidth: 52,
  },
  stockRealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  stockReal: {
    fontSize: 15,
    fontFamily: 'Outfit_900Black',
  },
  stockMinimo: {
    fontSize: 9,
    fontFamily: 'Outfit_600SemiBold',
  },
  precio: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    flexShrink: 0,
    minWidth: 56,
    textAlign: 'right',
  },
})
