/**
 * StockCard — Premium inventory card (FASE 2 mobile redesign).
 *
 * Design decisions (parity with web ProductoCard):
 * - Protagonist: PHOTO + product NAME + STOCK REAL (large number).
 * - Removed 4-chip cluster (ACT/VIR/RES/DIS) — those live in the detail sheet.
 * - Alert state: red border + alert icon + pulse animation (Reanimated v4).
 * - Healthy state: subtle teal accent — quiet, not loud green on every card.
 * - Tap isolation: action buttons stop propagation; containment ref guards
 *   the card's onPress so button taps NEVER open the detail sheet.
 * - Reanimated v4 entrance + press feedback + alert pulse.
 * - Respects useReducedMotion from react-native-reanimated.
 */

import React, { useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
} from 'react-native'
import { Image } from 'expo-image'
import { Package, Eye, EyeOff, Settings2, AlertTriangle } from 'lucide-react-native'
import { useColors, useIsDark } from '@/libs/theme'
import type { StockItem } from '@/libs/api-client/types'
import { getFullImageUrl } from '@/libs/api-client'
import { safeHaptics } from '@/core/utils/haptics'
import { usePermissions } from '@/core/auth/RequirePermission'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  FadeInRight,
  useReducedMotion,
  cancelAnimation,
} from 'react-native-reanimated'
import { derivarEstadoAlerta } from '../lib/alert-utils'

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface StockCardProps {
  item: StockItem
  onOpenAjuste: () => void
  onOpenToggle: () => void
  /** Called when the card BODY is tapped (opens detail sheet). */
  onOpenDetail: () => void
  /** Card index for staggered entrance animation. */
  index?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const StockCard = React.memo(function StockCard({
  item,
  onOpenAjuste,
  onOpenToggle,
  onOpenDetail,
  index = 0,
}: StockCardProps) {
  const colors = useColors()
  const isDark = useIsDark()
  const { canUpdate } = usePermissions()
  const canModify = canUpdate('MOD_STOCK')
  const reducedMotion = useReducedMotion()

  // ── Alert derivation ─────────────────────────────────────────────────────
  const { enAlerta, agotado, stockBajo } = derivarEstadoAlerta(item)
  const isInactive = item.activo === false
  const stockReal = item.cantidadActual ?? 0

  const alertColor = agotado ? colors.danger : colors.warning
  // Status border: inactive = red; else stock alert keeps its alert color; else active = green.
  const borderColor = isInactive
    ? colors.danger
    : enAlerta
      ? alertColor + '70'
      : colors.success

  // ── Animations ───────────────────────────────────────────────────────────
  const pulseOpacity = useSharedValue(1)
  const pressScale = useSharedValue(1)

  // Alert pulse — repeating opacity fade when enAlerta and reduced-motion off.
  // Cleanup cancels the animation on unmount (card recycled in list).
  useEffect(() => {
    if (enAlerta && !reducedMotion) {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 700 }),
          withTiming(1, { duration: 700 }),
        ),
        -1, // infinite
        false,
      )
    } else {
      pulseOpacity.value = withTiming(1, { duration: 200 })
    }
    return () => cancelAnimation(pulseOpacity)
  }, [enAlerta, reducedMotion])

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }))

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }))

  const handlePressIn = () => {
    if (!reducedMotion) {
      pressScale.value = withSpring(0.97, { damping: 20, stiffness: 300 })
    }
  }

  const handlePressOut = () => {
    if (!reducedMotion) {
      pressScale.value = withSpring(1, { damping: 18, stiffness: 280 })
    }
  }

  // ── Entrance animation ───────────────────────────────────────────────────
  const enterDelay = reducedMotion ? 0 : Math.min(index * 50, 300)

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInRight.delay(enterDelay).springify().damping(22).stiffness(180)}
      style={styles.wrapper}
    >
      <Animated.View style={pressStyle}>
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={() => {
            safeHaptics.impact('light')
            onOpenDetail()
          }}
          accessibilityRole="button"
          accessibilityLabel={`${item.producto ?? 'Producto'}, stock ${stockReal} unidades${enAlerta ? ', en alerta' : ''}`}
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#080808' : '#ffffff',
              borderColor,
              opacity: isInactive ? 0.55 : 1,
              // Alert: stronger left border accent
              borderLeftWidth: enAlerta ? 3 : 1,
              borderLeftColor: enAlerta ? alertColor : borderColor,
            },
          ]}
        >
          {/* Alert pulse ring — positioned behind content */}
          {enAlerta && !reducedMotion && (
            <Animated.View
              style={[
                StyleSheet.absoluteFillObject,
                styles.alertRing,
                { borderColor: alertColor + '30' },
                pulseStyle,
              ]}
              pointerEvents="none"
            />
          )}

          {/* ── LEFT: Image ─────────────────────────────────────────────── */}
          <View
            style={[styles.imageContainer, { backgroundColor: isDark ? '#111' : '#f1f5f9' }]}
          >
            {item.imageUrl ? (
              <Image
                source={{ uri: getFullImageUrl(item.imageUrl) || item.imageUrl }}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
                transition={600}
                accessibilityLabel={`Foto de ${item.producto ?? 'producto'}`}
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Package
                  size={32}
                  color={isDark ? '#2a2a2a' : '#cbd5e1'}
                  strokeWidth={1}
                />
              </View>
            )}

            {/* Alert icon badge on image */}
            {enAlerta && (
              <View
                style={[styles.alertIconBadge, { backgroundColor: alertColor + 'E0' }]}
                accessible
                accessibilityLabel="En alerta"
              >
                <AlertTriangle size={10} color="#fff" />
              </View>
            )}
          </View>

          {/* ── RIGHT: Content ──────────────────────────────────────────── */}
          <View style={styles.content}>
            {/* Product name */}
            <Text
              style={[styles.productName, { color: colors.text }]}
              numberOfLines={2}
            >
              {item.producto}
            </Text>

            {/* Deposito subtitle */}
            {item.deposito && (
              <Text
                style={[styles.depositoText, { color: isDark ? '#525252' : '#94a3b8' }]}
                numberOfLines={1}
              >
                {item.deposito}
              </Text>
            )}

            {/* Stock real — protagonist number */}
            <View style={styles.stockRealRow}>
              <Text
                style={[
                  styles.stockRealNum,
                  { color: enAlerta ? alertColor : colors.text },
                ]}
              >
                {stockReal}
              </Text>
              <Text style={[styles.stockRealUnit, { color: colors.textMuted }]}>uds.</Text>
            </View>

            {/* Alert label text (icon alone is not enough for a11y) */}
            {enAlerta && (
              <View style={styles.alertLabelRow}>
                <AlertTriangle size={10} color={alertColor} />
                <Text style={[styles.alertLabelText, { color: alertColor }]}>
                  {agotado ? 'Agotado' : 'Stock bajo'}
                </Text>
              </View>
            )}

            {/* ── Actions (tap-isolated) ───────────────────────────────── */}
            {canModify && (
              <View
                style={styles.actionRow}
                onStartShouldSetResponder={() => true}
              >
                {/* Toggle Activo/Inactivo */}
                <TouchableOpacity
                  onPress={() => {
                    safeHaptics.impact('medium')
                    onOpenToggle()
                  }}
                  style={[
                    styles.iconBtn,
                    {
                      backgroundColor: isDark ? '#111' : '#f1f5f9',
                      borderColor: isInactive
                        ? colors.danger + '50'
                        : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'),
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={isInactive ? 'Activar producto' : 'Desactivar producto'}
                  testID="toggle-status-btn"
                >
                  {isInactive
                    ? <EyeOff size={15} color={colors.danger} />
                    : <Eye size={15} color={isDark ? '#555' : '#94a3b8'} />
                  }
                </TouchableOpacity>

                {/* Ajustar stock */}
                <TouchableOpacity
                  onPress={() => {
                    safeHaptics.impact('heavy')
                    onOpenAjuste()
                  }}
                  activeOpacity={0.8}
                  style={{ flex: 1 }}
                  accessibilityRole="button"
                  accessibilityLabel="Ajustar stock"
                  testID="ajustar-stock-btn"
                >
                  <LinearGradient
                    colors={[colors.primary, '#007a6d']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.ajustarBtn}
                  >
                    <Settings2 size={13} color="#000" strokeWidth={2.5} />
                    <Text style={styles.ajustarText}>AJUSTAR STOCK</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 12,
    marginVertical: 5,
  },
  card: {
    flexDirection: 'row',
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 12,
    gap: 12,
  },
  alertRing: {
    borderRadius: 22,
    borderWidth: 2,
  },
  // Image
  imageContainer: {
    width: 88,
    height: 88,
    borderRadius: 16,
    overflow: 'hidden',
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertIconBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Content
  content: {
    flex: 1,
    gap: 5,
    justifyContent: 'flex-start',
  },
  productName: {
    fontSize: 14,
    fontFamily: 'Outfit_900Black',
    letterSpacing: -0.3,
    lineHeight: 18,
  },
  depositoText: {
    fontSize: 9,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  // Stock real protagonist
  stockRealRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    marginTop: 2,
  },
  stockRealNum: {
    fontSize: 28,
    fontFamily: 'Outfit_900Black',
    letterSpacing: -1,
    lineHeight: 32,
  },
  stockRealUnit: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
  },
  // Alert label
  alertLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  alertLabelText: {
    fontSize: 10,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 0.3,
  },
  // Actions
  actionRow: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 4,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  ajustarBtn: {
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  ajustarText: {
    color: '#000',
    fontSize: 11,
    fontFamily: 'Outfit_900Black',
    letterSpacing: 0.5,
  },
})
