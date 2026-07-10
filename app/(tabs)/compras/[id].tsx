import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Platform
} from 'react-native'
import { useLocalSearchParams, useRouter, Link, useNavigation } from 'expo-router'
import { DrawerActions } from '@react-navigation/native'
import { useState, useMemo } from 'react'
import * as Haptics from 'expo-haptics'
import {
  useCompra,
  useConfirmarCompra,
  useRecibirCompra,
  useCancelarCompra,
} from '@/libs/api-client'
import type { CompraDto, EstadoCompra } from '@/libs/api-client'
import { useColors, useIsDark, BRAND } from '@/libs/theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { formatToLocalTime } from '@/src/utils/date'
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  Truck,
  XCircle,
  Package,
  Calendar,
  Building2,
  DollarSign,
  ChevronRight,
  Check,
  AlertTriangle,
  Pencil,
  Info,
  Layers,
  FileStack,
  X
} from 'lucide-react-native'
import { BlurView } from 'expo-blur'
import { MotiView, AnimatePresence } from 'moti'
import { ForwardLogo } from '@/core/ui'

// ── Types & Constants ─────────────────────────────────────────────────────────

type StateStep = {
  key: EstadoCompra;
  label: string;
  desc: string;
  Icon: any;
  color: string;
  actionLabel?: string;
}

const STEPS: StateStep[] = [
  {
    key: 'NotaPedido',
    label: 'Nota de Pedido',
    desc: 'Orden preliminar. Sin impacto en stock ni saldo.',
    Icon: FileText,
    color: '#94a3b8',
  },
  {
    key: 'Confirmado',
    label: 'Confirmado',
    desc: 'Proveedor aceptó. Incrementa el Stock Virtual.',
    Icon: CheckCircle2,
    color: BRAND.blue,
    actionLabel: 'Confirmar Orden',
  },
  {
    key: 'Entregado',
    label: 'Mercadería Recibida',
    desc: 'Cierra el ciclo. Impacta Stock Real + Cta. Cte.',
    Icon: Truck,
    color: BRAND.lime,
    actionLabel: 'Marcar Recibida',
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function getStepIndex(estado: EstadoCompra | string): number {
  const s = String(estado)
  if (s === 'Presupuesto' || s === '1' || s === 'NotaPedido') return 0
  if (s === 'Confirmado' || s === '2') return 1
  if (s === 'Recibida' || s === '3' || s === 'Entregado') return 2
  return -1 // Cancelada (4)
}

function formatMoney(val: number) {
  return `$\u00a0${val.toLocaleString('es-AR', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`
}

function formatDate(iso: string) {
  if (!iso) return '—'
  return formatToLocalTime(iso, "dd MMM yyyy")
}

// ── Components ────────────────────────────────────────────────────────────────

function Card({ children, style, colors }: { children: any; style?: any; colors: any }) {
  return (
    <View style={[{
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 6,
    }, style]}>
      {children}
    </View>
  )
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function CompraDetailScreen() {
  const { id }    = useLocalSearchParams<{ id: string }>()
  const router    = useRouter()
  const navigation = useNavigation()
  const colors    = useColors()
  const isDark    = useIsDark()
  const insets    = useSafeAreaInsets()
  const [showStateModal, setShowStateModal] = useState(false)

  const { data: compra, isLoading, refetch, isRefetching } = useCompra(id ?? '')
  const { mutateAsync: confirmar, isPending: confirming } = useConfirmarCompra()
  const { mutateAsync: recibir,   isPending: receiving }  = useRecibirCompra()
  const { mutateAsync: cancelar,  isPending: canceling }  = useCancelarCompra()

  const isChangingStatus = confirming || receiving

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleConfirmar = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType?.Success || ('Success'.toLowerCase() as any))
      await confirmar(id)
      setShowStateModal(false)
      await refetch()
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType?.Error || ('Error'.toLowerCase() as any))
      Alert.alert('Error', e?.message ?? 'No se pudo confirmar.')
    }
  }

  const handleRecibir = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType?.Success || ('Success'.toLowerCase() as any))
      await recibir(id)
      setShowStateModal(false)
      await refetch()
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType?.Error || ('Error'.toLowerCase() as any))
      Alert.alert('Error', e?.message ?? 'No se pudo recibir.')
    }
  }

  const handleAnular = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle?.Medium || ('Medium'.toLowerCase() as any))
    Alert.alert(
      'Anular Orden',
      '¿Deseas cancelar esta operación? Se revertirán posibles impactos de stock.',
      [
        { text: 'Volver', style: 'cancel' },
        { 
          text: 'Sí, Anular', 
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType?.Warning || ('Warning'.toLowerCase() as any))
              await cancelar({ id })
              router.replace('/(tabs)/compras')
            } catch (e: any) {
              Alert.alert('Error', 'No se pudo anular la compra.')
            }
          }
        }
      ]
    )
  }

  // ── States ──────────────────────────────────────────────────────────────────

  if (isLoading || !compra) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <MotiView 
          from={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 400 }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textMuted, marginTop: 16, fontWeight: '600' }}>Cargando detalles...</Text>
        </MotiView>
      </View>
    )
  }

  const currentIdx  = getStepIndex(compra.estado ?? '')
  const isCancelada = String(compra.estado) === '4' || compra.estado === 'Cancelada'
  const isFinal     = currentIdx === 2 || isCancelada
  const provName    = compra.razonSocialProveedor || '—'
  const depoName    = compra.nombreDeposito || '—'
  const detalles    = compra.detalles ?? []

  const statusColor = isCancelada ? colors.danger : (STEPS[currentIdx]?.color ?? colors.textMuted)

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      
      {/* ── Glass Header ── */}
      {/* Header Observatorio Técnica */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 16,
        paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 20,
        paddingHorizontal: 24,
        backgroundColor: colors.bg,
        zIndex: 100,
      }}>
        <View style={{
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: colors.surface2,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <ForwardLogo size={24} showText={false} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle?.Light || ('Light'.toLowerCase() as any)); navigation.dispatch(DrawerActions.openDrawer()); }} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 24, fontWeight: '900', color: colors.text, letterSpacing: -0.5 }}>
            DETALLE DE ORDEN
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary }} />
            <Text style={{ fontSize: 10, fontWeight: '900', color: colors.primary, letterSpacing: 1.5, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
              REF: {(compra.id ?? '').toString().slice(0,12).toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {!isFinal && (
            <Link href={`/(tabs)/compras/nueva?edit=${id}`} asChild>
              <TouchableOpacity 
                onPress={() => Haptics.selectionAsync()}
                style={{
                  width: 44, height: 44, borderRadius: 15,
                  backgroundColor: `${BRAND.blue}15`, alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Pencil size={18} color={BRAND.blue} />
              </TouchableOpacity>
            </Link>
          )}
          <TouchableOpacity onPress={() => router.replace('/(tabs)/compras')} style={{ padding: 8, backgroundColor: colors.surface2, borderRadius: 20 }}>
            <X size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={{ 
          paddingTop: 10, 
          paddingBottom: 140,
          paddingHorizontal: 24 
        }}
        showsVerticalScrollIndicator={false}
      >
        
        {/* ── Hero Info Card ── */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 500 }}
        >
          <Card colors={colors} style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
            <View style={{ height: 6, backgroundColor: statusColor }} />
            <View style={{ padding: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textDisabled, fontSize: 8, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>PROVEEDOR ORIGEN</Text>
                  <Text style={{ color: colors.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.5, textTransform: 'uppercase' }}>{provName}</Text>
                </View>
                <MotiView 
                  animate={{ backgroundColor: `${statusColor}15` }}
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}
                >
                  <Text style={{ color: statusColor, fontWeight: '900', fontSize: 10, textTransform: 'uppercase' }}>
                    {isCancelada ? 'Cancelada' : STEPS[currentIdx]?.label}
                  </Text>
                </MotiView>
              </View>

              <View style={{ flexDirection: 'row', gap: 24 }}>
                <View>
                  <Text style={{ color: colors.textDisabled, fontSize: 8, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>DEPÓSITO</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Package size={12} color={colors.primary} />
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800', textTransform: 'uppercase' }}>{depoName}</Text>
                  </View>
                </View>
                <View>
                  <Text style={{ color: colors.textDisabled, fontSize: 8, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>REGISTRO</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Calendar size={12} color={colors.primary} />
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{formatDate(compra.fecha ?? '')}</Text>
                  </View>
                </View>
              </View>
            </View>
          </Card>
        </MotiView>

        {/* ── Stepper Visual Stitch ── */}
        {!isCancelada && (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 500, delay: 100 }}
            style={{ marginBottom: 16 }}
          >
            <Card colors={colors} style={{ padding: 16 }}>
              <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Flujo de Orden</Text>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                {STEPS.map((step, idx) => {
                  const isDone   = currentIdx > idx
                  const isActive = currentIdx === idx
                  const color    = isDone || isActive ? step.color : colors.textDisabled

                  return (
                    <View key={step.key} style={{ flex: 1, alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                        {/* Linea izquierda */}
                        <View style={{ flex: 1, height: 3, backgroundColor: idx === 0 ? 'transparent' : (isDone || isActive ? STEPS[idx-1].color : colors.border) }} />
                        
                        {/* Circulo Step */}
                        <MotiView 
                          animate={{ 
                            scale: isActive ? 1.25 : 1,
                            backgroundColor: isDone ? step.color : (isActive ? `${step.color}15` : colors.surface2),
                          }}
                          style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
                        >
                          {isDone ? (
                            <Check size={16} color="#fff" strokeWidth={4} />
                          ) : (
                            <step.Icon size={14} color={isActive ? step.color : colors.textDisabled} strokeWidth={isActive ? 3 : 2} />
                          )}
                        </MotiView>

                         {/* Linea derecha */}
                        <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: idx === STEPS.length - 1 ? 'transparent' : (isDone ? step.color : colors.surface2) }} />
                      </View>
                      <Text style={{ 
                        fontSize: 9, fontWeight: '900', marginTop: 8, 
                        color: isActive ? colors.text : colors.textDisabled,
                        textAlign: 'center'
                      }}>
                        {step.label}
                      </Text>
                    </View>
                  )
                })}
              </View>
            </Card>
          </MotiView>
        )}

        {/* ── Financial Summary Stitch Board ── */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 500, delay: 200 }}
          style={{ marginBottom: 16 }}
        >
          <Card colors={colors} style={{ padding: 0, overflow: 'hidden' }}>
            <View style={{ padding: 20 }}>
              <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Resumen Financiero</Text>
              
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.textMuted, fontSize: 14 }}>Subtotal Bruto</Text>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{formatMoney(compra.subtotalBrutoAmount ?? compra.totalAmount ?? 0)}</Text>
                </View>

                {(compra.descuentoTotalAmount ?? 0) > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: colors.success, fontSize: 14 }}>Bonificación Total</Text>
                    <Text style={{ color: colors.success, fontSize: 14, fontWeight: '700' }}>-{formatMoney(compra.descuentoTotalAmount ?? 0)}</Text>
                  </View>
                )}

                {(compra.gastosOperativos ?? 0) > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: colors.warning, fontSize: 14 }}>Fletes / Gastos Op.</Text>
                    <Text style={{ color: colors.warning, fontSize: 14, fontWeight: '700' }}>+{formatMoney(compra.gastosOperativos ?? 0)}</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={{ backgroundColor: colors.surface2, padding: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: colors.textDisabled, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 }}>TOTAL FINAL</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.primary, fontSize: 28, fontWeight: '900', letterSpacing: -1, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
                  {formatMoney(compra.totalAmount ?? 0)}
                </Text>
                <Text style={{ color: colors.textDisabled, fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>{compra.totalCurrency ?? 'ARS'}</Text>
              </View>
            </View>
          </Card>
        </MotiView>

        {/* ── Artículos / Detalles ── */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 500, delay: 300 }}
        >
          <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginLeft: 4 }}>
            Artículos en Orden ({detalles.length})
          </Text>
          
          {detalles.map((d, idx) => (
            <Card key={d.id} colors={colors} style={{ marginBottom: 12, padding: 14 }}>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: `${colors.primary}12`, alignItems: 'center', justifyContent: 'center' }}>
                  <Package size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '900', textTransform: 'uppercase' }}>{d.nombreProducto || '—'}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
                    {d.cantidad ?? 0} UN × {formatMoney(d.costoUnitarioBaseAmount ?? 0)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{formatMoney(d.subtotalAmount ?? 0)}</Text>
                </View>
              </View>
            </Card>
          ))}
        </MotiView>

      </ScrollView>

      {/* ── Floating Actions Stitch Sticky ── */}
      <AnimatePresence>
        {!isFinal && (
          <MotiView 
            from={{ translateY: 100 }}
            animate={{ translateY: 0 }}
            exit={{ translateY: 100 }}
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              paddingBottom: Math.max(insets.bottom, 20),
              paddingHorizontal: 16,
              paddingTop: 20,
              backgroundColor: colors.bg,
            }}
          >
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable onPress={handleAnular} style={{ flex: 1 }}>
                {({pressed}) => (
                  <View style={{
                    height: 56, borderRadius: 18,
                    backgroundColor: pressed ? `${colors.danger}25` : `${colors.danger}12`, 
                    alignItems: 'center', justifyContent: 'center',
                    transform: [{ scale: pressed ? 0.94 : 1 }],
                  }}>
                    <XCircle size={20} color={colors.danger} />
                  </View>
                )}
              </Pressable>

              <Pressable 
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle?.Light || ('Light'.toLowerCase() as any))
                  setShowStateModal(true)
                }} 
                style={{ flex: 4 }}
              >
                {({pressed}) => (
                  <View style={{
                    height: 56, borderRadius: 18,
                    backgroundColor: pressed ? `${colors.primary}90` : colors.primary, 
                    alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'row', gap: 8,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                    shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6
                  }}>
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Siguiente Estado</Text>
                    <ChevronRight size={20} color="#fff" strokeWidth={3} />
                  </View>
                )}
              </Pressable>
            </View>
          </MotiView>
        )}
      </AnimatePresence>

      {/* ── State Transition Modal ── */}
      {showStateModal && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setShowStateModal(false)} />
          <MotiView 
            from={{ translateY: 300 }}
            animate={{ translateY: 0 }}
            style={{ 
              backgroundColor: colors.surface, 
              borderTopLeftRadius: 32, borderTopRightRadius: 32,
              padding: 24, paddingBottom: Math.max(insets.bottom, 32)
            }}
          >
            <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 24 }} />
            
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: '900', marginBottom: 8 }}>Actualizar Estado</Text>
            <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: 24 }}>Confirma la transición de la orden para impactar el sistema.</Text>

            {/* Next Step Info */}
            {currentIdx < 2 && (() => {
              const nextStep = STEPS[currentIdx + 1]
              const NextIcon = nextStep.Icon
              return (
                <View style={{ 
                  backgroundColor: `${nextStep.color}12`, 
                  borderRadius: 20, padding: 20, 
                  marginBottom: 32 
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: nextStep.color, alignItems: 'center', justifyContent: 'center' }}>
                      <NextIcon size={20} color="#fff" />
                    </View>
                    <Text style={{ color: nextStep.color, fontWeight: '900', fontSize: 18 }}>{nextStep.label}</Text>
                  </View>
                  <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '500' }}>{nextStep.desc}</Text>
                </View>
              )
            })()}

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable 
                onPress={() => {
                  Haptics.selectionAsync()
                  setShowStateModal(false)
                }}
                disabled={isChangingStatus}
                style={{ flex: 1, height: 60, borderRadius: 20, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: colors.textMuted, fontWeight: '800' }}>Cancelar</Text>
              </Pressable>

              <Pressable 
                onPress={currentIdx === 0 ? handleConfirmar : handleRecibir}
                disabled={isChangingStatus}
                style={{ 
                  flex: 2, height: 60, borderRadius: 20, 
                  backgroundColor: STEPS[currentIdx + 1]?.color ?? colors.primary, 
                  alignItems: 'center', justifyContent: 'center',
                  opacity: isChangingStatus ? 0.6 : 1
                }}
              >
                {isChangingStatus ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Confirmar Cambio</Text>
                )}
              </Pressable>
            </View>
          </MotiView>
        </View>
      )}

    </View>
  )
}
