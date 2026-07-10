import React from 'react'
import { View, Text, Pressable, Alert, StyleSheet, TouchableOpacity } from 'react-native'
import {
  User, Building2, Mail, Phone, MapPin, CreditCard, Power, ChevronRight,
} from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { safeHaptics } from '@/core/utils/haptics'
import Animated, { FadeInUp } from 'react-native-reanimated'
import { useColors, useIsDark } from '@/libs/theme'
import type { SocioComercial, SocioDetailDto } from '@/libs/api-client/types'
import { GlassCard, RequirePermission } from '@/core/ui'
import { usePermissions } from '@/core/auth/RequirePermission'

interface SocioCardProps {
  item: SocioComercial | SocioDetailDto
  onEdit?: () => void
  onToggleStatus?: () => void
  delay?: number
}

export function SocioCard({ item, onEdit, onToggleStatus, delay = 0 }: SocioCardProps) {
  const colors = useColors()
  const isDark = useIsDark()
  const router = useRouter()

  const isCliente = item.tipo === 'Cliente' || item.tipo == null
  const isInactive = !item.activo

  const { canRead, canUpdate } = usePermissions()
  const showSaldo = canRead('MOD_CC')
  const showActions = canUpdate('MOD_CLIENTES') || canUpdate('MOD_PROVEEDORES')
  const showFooter = showSaldo || showActions

  const isZeroCuit = !item.cuit || item.cuit === '' || /^0+[-0]+$/.test(item.cuit.replace(/\D/g, ''))
  const cuitDisplay = isZeroCuit ? null : item.cuit

  const formatCurrency = (val: number, moneda: string) =>
    val?.toLocaleString('es-AR', {
      style: 'currency',
      currency: moneda || 'ARS',
      minimumFractionDigits: 2,
    }) ?? '$ 0,00'

  const saldo = item.saldoAmount ?? 0
  let saldoLabel = 'CUENTA CORRIENTE'
  let saldoColor = colors.text
  let saldoIconColor = colors.textMuted
  let saldoPrefix = ''

  if (saldo !== 0) {
    if (!isCliente) {
      if (saldo > 0) {
        saldoLabel = 'DEUDA PENDIENTE'
        saldoColor = colors.danger
        saldoIconColor = colors.danger
        saldoPrefix = '- '
      } else {
        saldoLabel = 'SALDO A FAVOR'
        saldoColor = colors.success
        saldoIconColor = colors.success
        saldoPrefix = '+ '
      }
    } else {
      if (saldo > 0) {
        saldoLabel = 'A COBRAR'
        saldoColor = colors.primary
        saldoIconColor = colors.primary
      } else {
        saldoLabel = 'CRÉDITO CLIENTE'
        saldoColor = colors.danger
        saldoIconColor = colors.danger
        saldoPrefix = '- '
      }
    }
  } else {
    saldoLabel = 'AL DÍA'
  }

  return (
    <Animated.View
      entering={FadeInUp.delay(Math.min(delay, 500)).duration(400)}
    >
      <Pressable 
        onPress={() => {
          safeHaptics.impact('medium')
          onEdit?.()
        }}
        style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
      >
        <GlassCard
          intensity={isDark ? 15 : 30}
          style={styles.card}
          borderColor={[colors.border, colors.border]}
        >
          {/* ── Header: Nombre + Badges ── */}
          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <Text style={[styles.razonSocial, { color: colors.text }]} numberOfLines={1}>
                {(item.razonSocial ?? '').toUpperCase()}
              </Text>
              <View style={styles.statusRow}>
                <View style={[styles.statusBadge, { backgroundColor: isInactive ? colors.danger + '15' : colors.success + '15' }]}>
                  <View style={[styles.statusDot, { backgroundColor: isInactive ? colors.danger : colors.success }]} />
                  <Text style={[styles.statusText, { color: isInactive ? colors.danger : colors.success }]}>
                    {isInactive ? 'INACTIVO' : 'ACTIVO'}
                  </Text>
                </View>
                {cuitDisplay
                  ? <Text style={[styles.cuitText, { color: colors.textDisabled }]}>CUIT: {cuitDisplay}</Text>
                  : <Text style={[styles.cuitText, { color: colors.textMuted }]}>Sin CUIT</Text>
                }
              </View>
            </View>

            {/* Tipo Badge */}
            <View style={[styles.typeBadge, { backgroundColor: colors.surface2 }]}>
              {isCliente ? <User size={12} color={colors.primary} /> : <Building2 size={12} color={colors.secondary} />}
              <Text style={[styles.typeText, { color: isCliente ? colors.primary : colors.secondary }]}>
                {(item.tipo ?? '').toUpperCase()}
              </Text>
            </View>
          </View>

          {/* ── Info Grid ── */}
          <View style={[styles.infoGrid, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', overflow: 'hidden' }]}>
            <View style={styles.infoRow}>
              <Mail size={14} color={colors.textMuted} />
              <Text style={[styles.infoText, { color: colors.textMuted, flex: 1, paddingRight: 4 }]} numberOfLines={1}>{item.email || 'SIN REGISTRO'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Phone size={14} color={colors.textMuted} />
              <Text style={[styles.infoText, { color: colors.textMuted, flex: 1, paddingRight: 4 }]}>{item.telefono || 'SIN REGISTRO'}</Text>
            </View>
            <View style={styles.infoRow}>
              <MapPin size={14} color={colors.textMuted} />
              <Text style={[styles.infoText, { color: colors.textMuted, flex: 1, paddingRight: 4 }]} numberOfLines={1}>{item.direccion || 'SIN REGISTRO'}</Text>
            </View>
          </View>

          {/* ── Financial Footer ── */}
          {showFooter && (
            <View style={[styles.footer, { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
              <RequirePermission module="MOD_CC" action="read" mode="hide">
                <Pressable
                  onPress={() => {
                    if (item.cuentaId) {
                      safeHaptics.impact('medium')
                      router.push(`/(tabs)/cuentas/${item.cuentaId}`)
                    } else {
                      safeHaptics.notification('error')
                      Alert.alert('Error de Enlace', 'Este socio no posee una terminal financiera vinculada.')
                    }
                  }}
                  style={styles.financialModule}
                >
                  <Text style={[styles.financialLabel, { color: saldo !== 0 ? saldoColor : colors.textMuted }]}>
                    {saldoLabel}
                  </Text>
                  <View style={styles.amountContainer}>
                    <CreditCard size={14} color={saldoIconColor} />
                    <Text style={[styles.amountText, { color: saldoColor }]}>
                      {saldoPrefix}{formatCurrency(Math.abs(saldo), item.saldoCurrency ?? 'ARS')}
                    </Text>
                    <ChevronRight size={14} color={colors.textMuted} />
                  </View>
                </Pressable>
              </RequirePermission>

              {/* Acciones */}
              <View style={styles.actions}>
                <RequirePermission module={isCliente ? 'MOD_CLIENTES' : 'MOD_PROVEEDORES'} action="update">
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation()
                      onToggleStatus?.()
                    }}
                    style={[
                      styles.actionButton,
                      { backgroundColor: isInactive ? colors.success + '15' : colors.danger + '15' }
                    ]}
                  >
                    <Power size={18} color={isInactive ? colors.success : colors.danger} />
                  </TouchableOpacity>
                </RequirePermission>
              </View>
            </View>
          )}
        </GlassCard>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    borderRadius: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerInfo: {
    flex: 1,
    marginRight: 12,
  },
  razonSocial: {
    fontSize: 16,
    fontFamily: 'Outfit_900Black',
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  statusText: {
    fontSize: 8,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 1,
  },
  cuitText: {
    fontSize: 9,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 1,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  typeText: {
    fontSize: 9,
    fontFamily: 'Outfit_900Black',
    letterSpacing: 1,
  },
  infoGrid: {
    gap: 8,
    padding: 12,
    borderRadius: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
  },
  financialModule: {
    flex: 1,
  },
  financialLabel: {
    fontSize: 8,
    fontFamily: 'Outfit_900Black',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  amountText: {
    fontSize: 20,
    fontFamily: 'Outfit_900Black',
    letterSpacing: -0.5,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  }
})
