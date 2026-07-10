import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native'
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router'
import { DrawerActions } from '@react-navigation/native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { MotiView } from 'moti'
import * as Haptics from 'expo-haptics'
import { safeHaptics } from '@/core/utils/haptics'
import {
  ArrowLeft,
  ArrowRightLeft,
  Image as ImageIcon,
  List as ListIcon,
  ShoppingCart,
  ArrowDownToLine,
  Landmark,
  Search,
  Archive,
  RotateCcw,
  Eye,
  EyeOff,
  X
} from 'lucide-react-native'
import { FlashList } from '@shopify/flash-list'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { AuroraGlow, GlassCard, ForwardLogo } from '@/core/ui'
import { useColors, useIsDark } from '@/libs/theme'
import { useFinanzasStore } from '../../../libs/store/useFinanzasStore'
import { CargarChequeModal } from '@/features/cuentas/components/CargarChequeModal'
import { MovimientoDetailModal } from '@/features/cuentas/components/MovimientoDetailModal'
import { ArchiveCuentaModal } from '@/features/cuentas/components/ArchiveCuentaModal'
import { RegistrarPagoModal } from '@/features/cuentas/components/RegistrarPagoModal'
import { useCuentaDetalle } from '@/features/cuentas/hooks/useCuentaDetalle'

function formatMoney(amount: number, currency: string = 'ARS') {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatDate(iso: string) {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) {
    return `Hoy, ${date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return `Ayer`
  }
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function getIconForReference(ref: string, color: string) {
  const lref = ref.toLowerCase()
  if (lref.includes('supermercado')) return <ShoppingCart size={20} color={color} />
  if (lref.includes('transferencia') || lref.includes('recibida')) return <ArrowDownToLine size={20} color={color} />
  return <Landmark size={20} color={color} />
}

export default function CuentaDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const navigation = useNavigation()
  const colors = useColors()
  const isDark = useIsDark()
  const insets = useSafeAreaInsets()

  // ── Helper: color de saldo según tipo de cuenta ────────────────────────────────
  // Cuentas propias: saldo positivo = GREEN (tenemos fondos)
  // Cuentas cliente: saldo positivo = RED (nos deben), negativo = GREEN (les debemos)
  // Cuentas proveedor: saldo positivo = RED (les debemos), negativo = GREEN (overpago)
  const getSaldoColor = (saldo: number, tipoSocio?: string): string => {
    if (saldo === 0) return colors.text
    if (!tipoSocio) {
      // cuenta propia
      return saldo > 0 ? colors.success : colors.danger
    }
    const isCliente = tipoSocio.toLowerCase().includes('cliente')
    if (isCliente) {
      return saldo > 0 ? colors.danger : colors.success
    } else {
      return saldo < 0 ? colors.danger : colors.success
    }
  }

  const { state, actions } = useCuentaDetalle(id ?? '')
  const {
    movimientos,
    info,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    isRefetching,
    isArchiveModalVisible,
    showFullNumber,
  } = state

  // Lógica dinámica de cartel e indicador menos (-)
  const balanceInfo = useMemo(() => {
    const tipoSocio = info?.tipoSocio
    let hasMinus = false
    let displayValue = formatMoney(Math.abs(info?.saldoActual || 0))
    let label = 'DISPONIBLE'

    if (tipoSocio) {
      const isCliente = tipoSocio === 'Cliente'
      if (isCliente) {
        if ((info?.saldoActual || 0) > 0) {
          hasMinus = true
          label = 'NOS DEBE'
        } else {
          label = 'DISPONIBLE'
        }
      } else { // Proveedor
        if ((info?.saldoActual || 0) < 0) {
          hasMinus = true
          label = 'NOS DEBE'
        } else {
          label = 'DISPONIBLE'
        }
      }
    } else {
      label = 'DISPONIBLE'
      if ((info?.saldoActual || 0) < 0) {
        hasMinus = true
      }
    }
    return { hasMinus, displayValue, label }
  }, [info?.saldoActual, info?.tipoSocio])

  const {
    setChequeModalVisible,
    setSelectedMovimiento,
    setMovimientoDetailModalVisible
  } = useFinanzasStore()

  const [pagoVisible, setPagoVisible] = useState(false)
  const openPago = () => {
    Haptics.selectionAsync()
    if (!info.socioComercialId) {
      Alert.alert('No aplica', 'Las cuentas propias no registran cobros/pagos de socios.')
      return
    }
    setPagoVisible(true)
  }

  const handleDesactivar = () => {
    Haptics.selectionAsync()
    actions.setIsArchiveModalVisible(true)
  }

  const s = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      overflow: 'hidden',
    },
    headerBlur: {
      paddingTop: insets.top + 10,
      paddingBottom: 16,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    backBtn: {
      padding: 4,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    // Top Card
    heroCard: {
      borderRadius: 28,
      padding: 24,
      marginHorizontal: 20,
      marginBottom: 32,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    cardType: {
      color: isDark ? 'rgba(255, 255, 255, 0.8)' : colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    cardNumber: {
      color: isDark ? '#FFFFFF' : colors.text,
      fontSize: 13,
      marginTop: 4,
    },
    bankIconWrapper: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.05)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    saldoLabelWrapper: {
      marginTop: 32,
    },
    saldoLabel: {
      color: isDark ? 'rgba(255, 255, 255, 0.8)' : colors.textMuted,
      fontSize: 13,
      fontWeight: '500',
    },
    saldoAmountWrapper: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginTop: 4,
    },
    saldoAmount: {
      color: isDark ? '#FFFFFF' : colors.text,
      fontSize: 36,
      fontWeight: '700',
      letterSpacing: -1,
    },
    saldoCurrency: {
      color: isDark ? 'rgba(255, 255, 255, 0.9)' : colors.text,
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 20,
    },
    usdEquivalent: {
      color: isDark ? '#FFFFFF' : colors.text,
      fontSize: 18,
      fontWeight: '600',
    },
    usdCurrency: {
      color: isDark ? 'rgba(255, 255, 255, 0.8)' : colors.textMuted,
      fontSize: 13,
    },
    buyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? colors.primary : colors.success,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      gap: 6,
    },
    buyBtnText: {
      color: isDark ? '#000000' : '#FFFFFF',
      fontSize: 13,
      fontWeight: '600',
    },
    // Quick Actions
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginHorizontal: 20,
      marginBottom: 32,
      gap: 12,
    },
    actionBtn: {
      flex: 1,
      borderRadius: 20,
      overflow: 'hidden',
    },
    actionInner: {
      paddingVertical: 20,
      alignItems: 'center',
      gap: 8,
    },
    actionIconWrapper: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
      fontFamily: 'Outfit_600SemiBold',
    },
    // List
    listHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    listTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    searchBtn: {
      padding: 4,
    },
    movRow: {
      paddingHorizontal: 20,
      paddingVertical: 4,
    },
    movCard: {
      flexDirection: 'row',
      padding: 16,
      alignItems: 'center',
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    movIconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    movInfo: {
      flex: 1,
      marginRight: 10,
    },
    movRef: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    movDate: {
      fontSize: 13,
      color: colors.textMuted,
    },
    movAmounts: {
      alignItems: 'flex-end',
    },
    movAmountValue: {
      fontSize: 15,
      fontWeight: '700',
    },
    seeAllWrapper: {
      paddingVertical: 24,
      alignItems: 'center',
    },
    seeAllText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
      fontFamily: 'Outfit_700Bold',
    },
  }), [colors, isDark])

  return (
    <View style={[s.container]}>
      {/* Premium Header */}
      <View style={s.header}>
        <BlurView intensity={isDark ? 80 : 60} tint={isDark ? 'dark' : 'light'} style={s.headerBlur}>
          <AuroraGlow size={100} color={colors.primary} opacity={0.15} />
          <View style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <ForwardLogo size={24} showText={false} onPress={() => { safeHaptics.impact('light'); navigation.dispatch(DrawerActions.openDrawer()); }} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text, letterSpacing: -0.5, fontFamily: 'Outfit_900Black' }}>
              ESTADO CUENTA
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary }} />
              <Text style={{ fontSize: 9, fontWeight: '800', color: colors.primary, letterSpacing: 1.5, fontFamily: 'Outfit_700Bold' }}>
                REF: {(id ?? '').slice(0, 12).toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={handleDesactivar} style={{ padding: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderRadius: 12 }}>
              {info.esActiva ? (
                <Archive size={20} color={colors.danger} />
              ) : (
                <RotateCcw size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.replace('/(tabs)/cuentas')} style={{ padding: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderRadius: 12 }}>
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>

      {isLoading && !isRefetching ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <>
          <FlashList
          data={movimientos}
          keyExtractor={(item) => item.id ?? ''}
          onEndReached={actions.handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={actions.refetch} tintColor={colors.primary} />
          }
          ListHeaderComponent={
            <>
              {/* Hero Card */}
                <MotiView
                  from={{ opacity: 0, scale: 0.95, translateY: 20 }}
                  animate={{ opacity: 1, scale: 1, translateY: 0 }}
                  transition={{ type: 'spring', damping: 15, delay: 100 }}
                  style={{ marginTop: insets.top + 80 }}
                >
                  <LinearGradient
                    colors={isDark ? [colors.primary, colors.primary + '80', '#000000'] : [colors.primary + '20', colors.surface, colors.surface]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.heroCard}
                  >
                    <BlurView intensity={isDark ? 20 : 10} style={StyleSheet.absoluteFill} />
                    <View style={s.cardHeader}>
                      <View>
                        <Text style={[s.cardType, { fontSize: 8, letterSpacing: 2, fontFamily: 'Outfit_700Bold' }]}>TITULAR DE CUENTA</Text>
                        <Text style={{ color: isDark ? '#ffffff' : colors.text, fontSize: 22, fontWeight: '900', textTransform: 'uppercase', marginTop: 4, fontFamily: 'Outfit_900Black' }}>{info.tipoSocio ? `${info.razonSocial}` : info.nombre}</Text>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => {
                            safeHaptics.impact('light')
                            actions.setShowFullNumber(!showFullNumber)
                          }}
                          style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}
                        >
                          <Text style={[s.cardNumber, { fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: isDark ? 'rgba(255, 255, 255, 0.7)' : colors.textMuted }]}>
                            {showFullNumber ? `0820 4421 9901 ${(id as string).slice(-4)}` : `•••• •••• •••• ${(id as string).slice(-4)}`}
                          </Text>
                          <View style={{ marginLeft: 8, opacity: 0.6 }}>
                            {showFullNumber ? <EyeOff size={14} color={isDark ? '#FFFFFF' : colors.text} /> : <Eye size={14} color={isDark ? '#FFFFFF' : colors.text} />}
                          </View>
                        </TouchableOpacity>
                      </View>
                      <View style={s.bankIconWrapper}>
                        <Landmark size={22} color={isDark ? '#FFFFFF' : colors.text} />
                      </View>
                    </View>

                    {!info.esActiva && (
                      <View style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.2)',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 12,
                        alignSelf: 'flex-start',
                        marginTop: 12,
                        borderWidth: 1,
                        borderColor: 'rgba(239, 68, 68, 0.4)'
                      }}>
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', fontFamily: 'Outfit_700Bold' }}>Archivada</Text>
                      </View>
                    )}

                    <View style={s.saldoLabelWrapper}>
                      <Text style={[s.saldoLabel, { fontSize: 10, fontFamily: 'Outfit_900Black', letterSpacing: 2, textTransform: 'uppercase' }]}>
                        {balanceInfo.label}
                      </Text>
                      <View style={s.saldoAmountWrapper}>
                        <Text style={[
                          s.saldoAmount,
                          { fontFamily: 'Outfit_900Black', fontSize: 42 },
                          { color: getSaldoColor(info.saldoActual ?? 0, info.tipoSocio ?? undefined) }
                        ]}>
                          {balanceInfo.hasMinus ? '-' : ''}{balanceInfo.displayValue}
                        </Text>
                      </View>
                      {info.tipoSocio && (
                        <Text style={{ fontSize: 10, fontFamily: 'Outfit_500Medium', color: isDark ? 'rgba(255,255,255,0.6)' : colors.textMuted, marginTop: 4 }}>
                          {info.saldoActual > 0
                            ? info.tipoSocio === 'Cliente' ? '\u26a0 Deuda pendiente del cliente' : '\u26a0 Le debemos al proveedor'
                            : info.saldoActual < 0 ? '\u2714 Sin deuda pendiente' : '\u2014 Cuenta saldada'}
                        </Text>
                      )}
                    </View>

                    <View style={s.cardFooter}>
                      <View style={{ opacity: 0.9 }}>
                        <Text style={[s.saldoLabel, { fontSize: 11, fontFamily: 'Outfit_600SemiBold' }]}>EQ. APROXIMADO</Text>
                        <Text style={[s.usdEquivalent, { fontFamily: 'Outfit_700Bold', fontSize: 18 }]}>
                          {((info.saldoActual || 0) / 1000).toFixed(2)} <Text style={[s.usdCurrency, { fontWeight: '900' }]}>USD</Text>
                        </Text>
                      </View>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={openPago}
                        style={[
                          s.buyBtn,
                          {
                            borderRadius: 16,
                            backgroundColor: isDark ? colors.primary : colors.success,
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderWidth: 1,
                            borderColor: isDark ? `${colors.primary}40` : `${colors.success}40`,
                            shadowColor: isDark ? colors.primary : colors.success,
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 4
                          }
                        ]}
                      >
                        <ArrowRightLeft size={14} color={isDark ? '#000000' : '#ffffff'} strokeWidth={3} />
                        <Text style={[
                          s.buyBtnText,
                          {
                            fontSize: 11,
                            letterSpacing: 1.5,
                            textTransform: 'uppercase',
                            fontFamily: 'Outfit_700Bold',
                            color: isDark ? '#000000' : '#ffffff'
                          }
                        ]}>
                          {info.tipoSocio === 'Cliente' ? 'COBRAR' : 'PAGAR'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </LinearGradient>
                </MotiView>

              {/* Quick Actions */}
              <View style={s.actionsRow}>
                <TouchableOpacity style={s.actionBtn} activeOpacity={0.8} onPress={() => { Haptics.selectionAsync(); setChequeModalVisible(true); }}>
                  <GlassCard intensity={8} style={s.actionInner}>
                    <View style={s.actionIconWrapper}>
                      <ImageIcon size={22} color={colors.primary} />
                    </View>
                    <Text style={s.actionText}>Cargar{'\n'}Cheque</Text>
                  </GlassCard>
                </TouchableOpacity>
                <TouchableOpacity style={s.actionBtn} activeOpacity={0.8} onPress={openPago}>
                  <GlassCard intensity={8} style={s.actionInner}>
                    <View style={s.actionIconWrapper}>
                      <ArrowRightLeft size={22} color={colors.primary} />
                    </View>
                    <Text style={s.actionText}>{info.tipoSocio === 'Cliente' ? 'Cobrar' : info.tipoSocio ? 'Pagar' : 'Transferir'}</Text>
                  </GlassCard>
                </TouchableOpacity>
                <TouchableOpacity style={s.actionBtn} activeOpacity={0.8} onPress={() => { Haptics.selectionAsync(); alert('Vista de Movimientos Detallados en desarrollo'); }}>
                  <GlassCard intensity={8} style={s.actionInner}>
                    <View style={s.actionIconWrapper}>
                      <ListIcon size={22} color={colors.primary} />
                    </View>
                    <Text style={s.actionText}>Ver{'\n'}Libro</Text>
                  </GlassCard>
                </TouchableOpacity>
              </View>

              {/* List Header */}
              <View style={[s.listHeaderRow, { marginTop: 8 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 14, height: 2, backgroundColor: colors.primary, borderRadius: 1 }} />
                  <Text style={[s.listTitle, { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, color: colors.textMuted, fontFamily: 'Outfit_700Bold' }]}>LIBRO DIARIO</Text>
                </View>
                <TouchableOpacity style={{ padding: 10, backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)', borderRadius: 12 }}>
                  <Search size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </>
          }
          renderItem={({ item, index }) => {
            // ── Lógica Contable Correcta ──
            // Para cuentas de CLIENTES:
            //   Debe > 0 = facturamos al cliente (nos debe) → ROJO
            //   Haber > 0 = el cliente pagó → VERDE
            // Para cuentas de PROVEEDORES:
            //   Debe > 0 = el proveedor nos factura (les debemos) → ROJO
            //   Haber > 0 = pagamos al proveedor → VERDE
            // Para cuentas PROPIAS:
            //   Debe > 0 = ingreso/depósito → VERDE
            //   Haber > 0 = egreso/retiro → ROJO
            const tipoSocio = info.tipoSocio
            const isDebe = (item.debe ?? 0) > 0
            const amount = isDebe ? (item.debe ?? 0) : (item.haber ?? 0)

            let textColor: string
            let prefix: string
            let iconColor: string

            if (!tipoSocio) {
              // Cuenta propia: Debe = ingreso (verde), Haber = egreso (rojo)
              textColor = isDebe ? colors.success : colors.danger
              prefix = isDebe ? '+$' : '-$'
              iconColor = isDebe ? colors.success : colors.danger
            } else {
              // Cuenta socio: Debe = deuda (rojo), Haber = pago (verde)
              textColor = isDebe ? colors.danger : colors.success
              prefix = isDebe ? '-$' : '+$'
              iconColor = isDebe ? colors.danger : colors.success
            }

            return (
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ delay: (index % 10) * 50, type: 'timing', duration: 250 }}
              >
                <View style={s.movRow}>
                  <TouchableOpacity
                    style={s.movCard}
                    activeOpacity={0.7}
                    onPress={() => {
                      Haptics.selectionAsync()
                      setSelectedMovimiento(item)
                      setMovimientoDetailModalVisible(true)
                    }}
                  >
                    <View style={[s.movIconCircle, { backgroundColor: `${iconColor}18` }]}>
                      {getIconForReference(item.referencia ?? '', iconColor)}
                    </View>
                    <View style={s.movInfo}>
                      <Text style={[s.movRef, { textTransform: 'uppercase', fontFamily: 'Outfit_700Bold' }]} numberOfLines={1}>
                        {item.referencia}
                      </Text>
                      <Text style={[s.movDate, { fontFamily: 'Outfit_500Medium' }]}>{formatDate(item.fecha ?? '')}</Text>
                    </View>
                    <View style={s.movAmounts}>
                      <Text style={[s.movAmountValue, { color: textColor, fontFamily: 'Outfit_700Bold', fontSize: 16 }]}>
                        {prefix}{amount.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                      </Text>
                      {item.saldoHistorico !== undefined && (
                        <Text style={{ fontSize: 10, color: colors.textDisabled, fontFamily: 'Outfit_400Regular' }}>
                          saldo: {formatMoney(item.saldoHistorico)}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              </MotiView>
            )
          }}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={{ paddingVertical: 20 }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : hasNextPage ? (
              <TouchableOpacity style={s.seeAllWrapper} onPress={actions.handleLoadMore}>
                <Text style={s.seeAllText}>Ver todos los movimientos</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ height: 100 }} />
            )
          }
        />
        </>
      )}

      {/* Botón Flotante Interactivo */}
      <CargarChequeModal />
      <MovimientoDetailModal />
      <RegistrarPagoModal
        visible={pagoVisible}
        onClose={() => setPagoVisible(false)}
        socioComercialId={info.socioComercialId}
        tipoSocio={info.tipoSocio}
        razonSocial={info.razonSocial}
      />
      <ArchiveCuentaModal
        visible={isArchiveModalVisible}
        cuentaId={id as string}
        isActive={info.esActiva}
        onClose={() => actions.setIsArchiveModalVisible(false)}
      />
    </View>
  )
}
