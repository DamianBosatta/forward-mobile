/**
 * StockDetailSheet — Read-only bottom sheet for an inventory item.
 *
 * Opens when the user taps the card body (NOT the action buttons).
 * Shows: photo + name + ID + stock real, disponibilidad breakdown,
 * and (for cost roles only) a Rentabilidad section with band chips + costo real.
 *
 * Parity with web InventarioDetailSheet (FASE 1).
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  Platform,
  StyleSheet,
} from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { X, Edit3, Package, AlertTriangle, TrendingUp, BarChart2, History } from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { MotiView } from 'moti'
import { useColors, useIsDark } from '@/libs/theme'
import { getFullImageUrl } from '@/libs/api-client'
import type { StockItem } from '@/libs/api-client/types'
import type { CatalogoStockItem } from '@/libs/api-client/productos'
import { BandChip } from '@/features/ventas/components/BandChip'
import { canViewCost } from '@/features/ventas/lib/descuentos'
import { safeHaptics } from '@/core/utils/haptics'
import { derivarEstadoAlerta } from '../lib/alert-utils'
import { StockMovimientosSheet } from './StockMovimientosSheet'

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface StockDetailSheetProps {
  item: StockItem | null
  catalogoItem?: CatalogoStockItem | null
  userRoles: string[]
  visible: boolean
  onClose: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatMoney(value: number): string {
  return value.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function DisponibilidadRow({ label, value, color, textColor }: {
  label: string
  value: number
  color: string
  textColor: string
}) {
  return (
    <View style={styles.dispRow} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={[styles.dispDot, { backgroundColor: color }]} />
      <Text style={[styles.dispLabel, { color: textColor }]}>{label}</Text>
      <Text style={[styles.dispValue, { color }]}>{value}</Text>
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function StockDetailSheet({
  item,
  catalogoItem,
  userRoles,
  visible,
  onClose,
}: StockDetailSheetProps) {
  const colors = useColors()
  const isDark = useIsDark()
  const router = useRouter()
  const showCost = canViewCost(userRoles)
  const [isMovimientosOpen, setIsMovimientosOpen] = useState(false)

  if (!item) return null

  const { enAlerta, agotado, stockBajo } = derivarEstadoAlerta(item)

  const stockReal = item.cantidadActual ?? 0
  const disponible = item.cantidadDisponible ?? (stockReal - (item.cantidadReservada ?? 0))
  const reservado = item.cantidadReservada ?? 0
  const porEntrar = item.cantidadVirtual ?? 0   // "Por entrar" — NEVER "Virtual"
  const enTransito = item.cantidadTransito ?? null

  // When the item is in alert, never fall back to success (green).
  // If derivarEstadoAlerta marks enAlerta true without agotado/stockBajo,
  // treat it as warning-level (orange) rather than success (green).
  const alertColor = agotado ? colors.danger : stockBajo ? colors.warning : enAlerta ? colors.warning : colors.success
  const alertLabel = agotado ? 'AGOTADO' : stockBajo ? 'STOCK BAJO' : 'EN ALERTA'

  const sheetBg = colors.surface
  const accentColor = enAlerta ? colors.danger : colors.primary

  return (
    <>
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      accessibilityViewIsModal
    >
      {/* Backdrop */}
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Cerrar detalle"
        accessibilityRole="button"
      />

      {/* Bottom Sheet */}
      <MotiView
        from={{ translateY: 600, opacity: 0 }}
        animate={{ translateY: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 26, stiffness: 200 }}
        style={[
          styles.sheet,
          {
            backgroundColor: sheetBg,
            borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
          },
        ]}
      >
        {/* Top glow */}
        <LinearGradient
          colors={[accentColor + '28', 'transparent']}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        {/* Handle */}
        <View style={styles.handleContainer}>
          <View
            style={[
              styles.handle,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)' },
            ]}
          />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ── Header ─────────────────────────────────────────────────── */}
          <View style={styles.header}>
            {/* Photo */}
            <View
              style={[
                styles.imageWrap,
                {
                  backgroundColor: isDark ? '#111' : '#f1f5f9',
                  borderColor: enAlerta ? alertColor + '60' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'),
                },
              ]}
            >
              {item.imageUrl ? (
                <Image
                  source={{ uri: getFullImageUrl(item.imageUrl) || item.imageUrl }}
                  style={StyleSheet.absoluteFillObject}
                  contentFit="cover"
                  transition={400}
                  accessibilityLabel={`Foto de ${item.producto ?? 'producto'}`}
                />
              ) : (
                <View style={styles.imageFallback}>
                  <Package size={36} color={isDark ? '#2a2a2a' : '#cbd5e1'} strokeWidth={1} />
                </View>
              )}
              {enAlerta && (
                <View style={[styles.alertBadgeImg, { backgroundColor: alertColor + 'E0' }]}>
                  <AlertTriangle size={10} color="#fff" />
                </View>
              )}
            </View>

            {/* Name / ID / Stock real */}
            <View style={styles.headerMeta}>
              <Text
                style={[styles.productName, { color: colors.text }]}
                numberOfLines={2}
                accessibilityRole="header"
              >
                {item.producto}
              </Text>
              <Text style={[styles.productId, { color: colors.textMuted }]}>
                ID: {item.productoId?.substring(0, 8) ?? '—'}
              </Text>

              {/* Stock real protagonist */}
              <View style={styles.stockRealRow}>
                <Text style={[styles.stockRealNum, { color: enAlerta ? alertColor : colors.text }]}>
                  {stockReal}
                </Text>
                <Text style={[styles.stockRealLabel, { color: colors.textMuted }]}>uds. reales</Text>
              </View>

              {/* Alert badge */}
              {enAlerta && (
                <View
                  style={[styles.alertBadge, { backgroundColor: alertColor + '18', borderColor: alertColor + '40' }]}
                  accessible
                  accessibilityLabel={`Estado: ${alertLabel}`}
                >
                  <AlertTriangle size={11} color={alertColor} />
                  <Text style={[styles.alertBadgeText, { color: alertColor }]}>{alertLabel}</Text>
                </View>
              )}
            </View>

            {/* Close button */}
            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.closeBtn,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            >
              <X size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* ── Disponibilidad ─────────────────────────────────────────── */}
          <View
            style={[
              styles.section,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
              },
            ]}
          >
            <View style={styles.sectionHeader}>
              <BarChart2 size={14} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Disponibilidad</Text>
            </View>

            <DisponibilidadRow
              label="Disponible"
              value={disponible}
              color={disponible <= 0 ? colors.danger : colors.success}
              textColor={colors.text}
            />
            <DisponibilidadRow
              label="Reservado"
              value={reservado}
              color={colors.warning}
              textColor={colors.text}
            />
            <DisponibilidadRow
              label="Por entrar"
              value={porEntrar}
              color={colors.info}
              textColor={colors.text}
            />
            {enTransito !== null && (
              <DisponibilidadRow
                label="En tránsito"
                value={enTransito}
                color={colors.secondary}
                textColor={colors.text}
              />
            )}
          </View>

          {/* ── Rentabilidad (cost roles only) ────────────────────────── */}
          {showCost && (
            <View
              testID="rentabilidad-section"
              style={[
                styles.section,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                  borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                },
              ]}
            >
              <View style={styles.sectionHeader}>
                <TrendingUp size={14} color={colors.success} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Rentabilidad</Text>
              </View>

              {/* Price bands */}
              <BandChip
                precioMinimoRentable={catalogoItem?.precioMinimoRentable ?? null}
                precioAdecuado={catalogoItem?.precioAdecuado ?? null}
                precioPremium={catalogoItem?.precioPremium ?? null}
                userRoles={userRoles}
              />

              {/* Costo real */}
              {catalogoItem?.costoRealPricing != null && (
                <View style={styles.costoRow}>
                  <Text style={[styles.costoLabel, { color: colors.textMuted }]}>Costo real</Text>
                  <Text style={[styles.costoValue, { color: colors.text }]}>
                    ${formatMoney(catalogoItem.costoRealPricing)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── Ver movimientos affordance ───────────────────────────────── */}
          <TouchableOpacity
            onPress={() => {
              safeHaptics.impact('light')
              setIsMovimientosOpen(true)
            }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Ver movimientos de ${item.producto ?? 'producto'}`}
            testID="ver-movimientos-btn"
            style={styles.movimientosBtn}
          >
            <View
              style={[
                styles.movimientosBtnInner,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                  borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                },
              ]}
            >
              <History size={16} color={colors.text} strokeWidth={2} />
              <Text style={[styles.movimientosBtnText, { color: colors.text }]}>
                VER MOVIMIENTOS
              </Text>
            </View>
          </TouchableOpacity>

          {/* ── Edit affordance ─────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={() => {
              safeHaptics.impact('medium')
              onClose()
              router.push(`/(tabs)/inventario/editar/${item.productoId}` as any)
            }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Editar ${item.producto ?? 'producto'}`}
            style={styles.editBtn}
          >
            <LinearGradient
              colors={[colors.primary + 'CC', colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.editBtnInner}
            >
              <Edit3 size={16} color="#000" strokeWidth={2.5} />
              <Text style={styles.editBtnText}>EDITAR PRODUCTO</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </MotiView>
    </Modal>

    {/* ── Movement history sheet ─────────────────────────────────── */}
    <StockMovimientosSheet
      productoId={item.productoId ?? ''}
      productoNombre={item.producto ?? ''}
      visible={isMovimientosOpen}
      onClose={() => setIsMovimientosOpen(false)}
    />
    </>
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
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 4,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  // Header
  header: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  imageWrap: {
    width: 80,
    height: 80,
    borderRadius: 18,
    overflow: 'hidden',
    flexShrink: 0,
    borderWidth: 1.5,
  },
  imageFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertBadgeImg: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMeta: {
    flex: 1,
    gap: 4,
  },
  productName: {
    fontSize: 17,
    fontFamily: 'Outfit_900Black',
    letterSpacing: -0.4,
    lineHeight: 22,
  },
  productId: {
    fontSize: 10,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.3,
  },
  stockRealRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 4,
  },
  stockRealNum: {
    fontSize: 32,
    fontFamily: 'Outfit_900Black',
    letterSpacing: -1,
    lineHeight: 36,
  },
  stockRealLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  alertBadgeText: {
    fontSize: 9,
    fontFamily: 'Outfit_900Black',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  // Sections
  section: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Outfit_900Black',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  // Disponibilidad rows
  dispRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dispDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  dispLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
  },
  dispValue: {
    fontSize: 16,
    fontFamily: 'Outfit_900Black',
    letterSpacing: -0.3,
  },
  // Costo real row
  costoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  costoLabel: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
  },
  costoValue: {
    fontSize: 16,
    fontFamily: 'Outfit_900Black',
    letterSpacing: -0.3,
  },
  // Ver movimientos button
  movimientosBtn: {
    marginTop: 4,
  },
  movimientosBtnInner: {
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  movimientosBtnText: {
    fontSize: 12,
    fontFamily: 'Outfit_900Black',
    letterSpacing: 0.5,
  },
  // Edit button
  editBtn: {
    marginTop: 4,
  },
  editBtnInner: {
    height: 50,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  editBtnText: {
    color: '#000',
    fontSize: 14,
    fontFamily: 'Outfit_900Black',
    letterSpacing: 0.5,
  },
})
