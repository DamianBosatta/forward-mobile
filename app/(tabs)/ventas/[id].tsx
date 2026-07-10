import {
  View, Text, ScrollView, Pressable, Alert, ActivityIndicator,
  Modal, StyleSheet, Platform, TouchableOpacity
} from 'react-native'
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router'
import { DrawerActions } from '@react-navigation/native'
import { useState, useMemo } from 'react'
import { safeHaptics } from '@/core/utils/haptics'
import {
  useVenta,
  useConvertirPresupuesto, useAnularVenta,
  useSocio,
  getNotaEntregaUrl, getEtiquetasUrl
} from '@/libs/api-client'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { canAuthorizeVenta } from '@/features/ventas/lib/authorization'
import { AuthorizationModal } from '@/features/ventas/components/AuthorizationModal'
import { Linking } from 'react-native'
import { useColors, useIsDark, BRAND, tokens } from '@/libs/theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  ArrowLeft, CheckCircle2, Truck, XCircle, Package,
  Calendar, Building2, Check, Layers,
  X, ShoppingCart, ClipboardList, PackageCheck, Route, Ban,
  User, ChevronRight, Pencil, Printer, ExternalLink, QrCode,
  Clock, ShieldCheck, TrendingUp, Info, AlertTriangle,
  ArrowRight, Phone, MessageCircle, MapPin, ChevronDown
} from 'lucide-react-native'
import { BlurView } from 'expo-blur'
import { MotiView, AnimatePresence } from 'moti'
import { ForwardLogo, RequirePermission, GlassCard, AuroraGlow } from '@/core/ui'
import { usePermissions } from '@/core/auth/RequirePermission'
import { ConfirmModal } from '@/core/ui/ConfirmModal'
import { LinearGradient } from 'expo-linear-gradient'
import {
  calcularRentabilidadVenta,
  puedeVerRentabilidad,
} from '@/features/ventas/lib/rentabilidad-venta'

// ── Types & Constants ─────────────────────────────────────────────────────────
type StateStep = {
  key: string
  label: string
  desc: string
  Icon: any
  color: string
}

// Static STEPS replaced by dynamic steps inside VentaDetailScreen to support themes properly


// ── Helpers ────────────────────────────────────────────────────────────────────
function getStepIndex(estado: any): number {
  const s = String(estado)
  if (s === '2' || s === 'Confirmada') return 0
  if (s === '3' || s === 'EnPreparacion') return 1
  if (s === '4' || s === 'Empacada') return 1
  if (s === '5' || s === 'EnRuta') return 2
  if (s === '6' || s === 'Entregada') return 3
  return -1
}

function formatMoney(val: number) {
  return `$ ${val.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function formatDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function getInitials(name?: string) {
  if (!name) return 'CF'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase()
}

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function VentaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const navigation = useNavigation()
  const colors = useColors()
  const isDark = useIsDark()
  const insets = useSafeAreaInsets()
  
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [modalState, setModalState] = useState<{ visible: boolean; title: string; message: string; variant: 'success' | 'danger' | 'warning' | 'info' | 'primary'; onConfirm: () => void; onCancel?: () => void } | null>(null)

  // Premium UI & interaction state hooks
  const [clientExpanded, setClientExpanded] = useState(false)
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null)
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})

  const { user } = useAuthStore()
  const { data: raw, isLoading, refetch } = useVenta(id ?? '')
  const { mutateAsync: convertir, isPending: converting } = useConvertirPresupuesto()
  const { mutateAsync: anular, isPending: canceling } = useAnularVenta()

  const { canUpdate } = usePermissions()
  const canModify = canUpdate('MOD_VENTAS')

  const isChangingStatus = converting

  const venta = useMemo(() => raw?.venta, [raw])
  const detalles = useMemo(() => raw?.detalles ?? [], [raw])
  const bultos = useMemo(() => raw?.bultos ?? [], [raw])

  // Fetch customer details dynamically
  const { data: socio, isLoading: loadingSocio } = useSocio(venta?.clienteId ?? '')

  // Stepper steps dynamically resolving delivered to colors.primary
  const steps = useMemo<StateStep[]>(() => [
    { key: 'Confirmada',    label: 'Confirmado',      desc: 'Pedido aceptado y stock reservado.',                 Icon: CheckCircle2,  color: BRAND.blue },
    { key: 'Empacada',      label: 'Preparado',       desc: 'Picking y empaque finalizado en depósito.',          Icon: Package,       color: '#8b5cf6' },
    { key: 'EnRuta',        label: 'En Ruta',         desc: 'En camino al domicilio del cliente.',                Icon: Route,         color: '#6366f1' },
    { key: 'Entregada',     label: 'Entregado',       desc: 'Venta finalizada. Impacto en CC del cliente.',       Icon: Truck,         color: colors.primary },
  ], [colors])

  const currentIdx = useMemo(() => getStepIndex(venta?.estado), [venta])
  const isCancelled = useMemo(() => !venta?.activo || String(venta?.estado) === '8' || String(venta?.estado) === '7', [venta])
  const isPresupuesto = venta?.tipoOperacion === 1
  const isFinal = currentIdx === 3 || isCancelled

  const statusColor = isCancelled ? colors.danger : (steps[currentIdx]?.color ?? BRAND.blue)

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleAnular = () => {
    if (!venta) return
    safeHaptics.impact('medium')
    setModalState({
      visible: true,
      title: 'Anular Venta',
      message: '¿Deseas cancelar esta venta? Se liberará el stock reservado.',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await anular({ id: id!, version: venta.version ?? 0, motivoAnulacion: 'Cancelación manual' })
          setModalState(null)
          router.replace('/(tabs)/ventas')
        } catch (e: any) {
          Alert.alert('Error', 'No se pudo anular la venta.')
        }
      }
    })
  }

  const handleConvertir = async () => {
    if (!venta) return
    try {
      await convertir({ id: id!, version: venta.version ?? 0, usuarioGeneradorId: user?.id ?? '' })
      await refetch()
    } catch (e: any) {
      Alert.alert('Error', 'No se pudo convertir el presupuesto.')
    }
  }

  const handlePrintNota = () => Linking.openURL(getNotaEntregaUrl(id!))
  const handlePrintEtiquetas = () => Linking.openURL(getEtiquetasUrl(id!))

  if (isLoading || !venta) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AuroraGlow color={statusColor} opacity={0.15} />

      {/* Sticky Header Premium */}
      <View style={{ zIndex: 100 }}>
        <BlurView intensity={25} tint={isDark ? "dark" : "light"} style={{ paddingTop: insets.top + 10, paddingBottom: 15 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20 }}>
            <TouchableOpacity 
              onPress={() => router.replace('/(tabs)/ventas')}
              style={[styles.backButton, {
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
              }]}
            >
              <ArrowLeft size={22} color={colors.text} />
            </TouchableOpacity>
            
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                {isPresupuesto ? 'PRESUPUESTO' : 'DETALLE VENTA'}
              </Text>
              <View style={[styles.headerIdBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                <Text style={[styles.headerIdText, { color: colors.textMuted }]}>
                  ID: {(venta.id ?? '').slice(0,8).toUpperCase()}
                </Text>
              </View>
            </View>

            <ForwardLogo size={28} showText={false} />
          </View>
        </BlurView>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
        
        {/* ── Bento Hero Section ── */}
        <MotiView from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <View style={{ marginBottom: 20 }}>
            {/* Client Main Bento - Full Width (Expandable) */}
            <Pressable 
              onPress={() => {
                safeHaptics.impact('light');
                setClientExpanded(!clientExpanded);
              }}
            >
              <GlassCard intensity={15} style={[styles.heroCardMain, { 
                borderColor: clientExpanded ? colors.primary : colors.border,
                shadowColor: clientExpanded ? colors.primary : undefined,
                shadowOffset: clientExpanded ? { width: 0, height: 4 } : undefined,
                shadowOpacity: clientExpanded ? 0.3 : undefined,
                shadowRadius: clientExpanded ? 12 : undefined,
                elevation: clientExpanded ? 8 : undefined,
                marginBottom: 12
              }]}>
                <View style={[styles.statusStrip, { backgroundColor: statusColor }]} />
                <View style={{ padding: 20 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.sectionLabel, { color: colors.textMuted, marginBottom: 0 }]}>CLIENTE RECEPTOR</Text>
                      <ChevronDown size={14} color={colors.textMuted} style={{ transform: [{ rotate: clientExpanded ? '180deg' : '0deg' }] }} />
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: `${statusColor}12`, borderColor: `${statusColor}25` }]}>
                      <Text style={[styles.statusText, { color: statusColor, fontSize: 9 }]}>
                        {isCancelled ? 'CANCELADO' : (steps[currentIdx]?.label || 'PENDIENTE')}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.clientName, { color: colors.text }]} numberOfLines={clientExpanded ? undefined : 2}>
                    {venta.clienteNombre || 'Consumidor Final'}
                  </Text>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {clientExpanded && (
                      <MotiView
                        from={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ type: 'timing', duration: 250 }}
                        style={{ overflow: 'hidden', marginTop: 16 }}
                      >
                        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16, gap: 14 }}>
                          {/* Metadata grid */}
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                            {socio?.cuit && (
                              <View style={[styles.clientMetaChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }]}>
                                <Text style={[styles.clientMetaLabel, { color: colors.textMuted }]}>CUIT</Text>
                                <Text style={[styles.clientMetaValue, { color: colors.text }]}>{socio.cuit}</Text>
                              </View>
                            )}
                            {socio?.condicionIva && (
                              <View style={[styles.clientMetaChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }]}>
                                <Text style={[styles.clientMetaLabel, { color: colors.textMuted }]}>IVA</Text>
                                <Text style={[styles.clientMetaValue, { color: colors.text }]}>{socio.condicionIva}</Text>
                              </View>
                            )}
                          </View>

                          {socio?.direccion && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <MapPin size={16} color={colors.primary} />
                              <Text style={[styles.clientAddress, { color: colors.text }]} numberOfLines={2}>
                                {socio.direccion}
                              </Text>
                            </View>
                          )}

                          {/* Interactive Action Shortcuts */}
                          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                            {socio?.telefono && (
                              <>
                                <TouchableOpacity
                                  onPress={() => Linking.openURL(`tel:${socio.telefono}`)}
                                  style={[styles.clientActionBtn, { backgroundColor: colors.surface2, borderColor: colors.border }]}
                                >
                                  <Phone size={16} color={colors.text} />
                                  <Text style={[styles.clientActionText, { color: colors.text }]} maxFontSizeMultiplier={1.3}>Llamar</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                  onPress={() => {
                                    const cleanPhone = (socio.telefono ?? '').replace(/[^0-9]/g, '');
                                    const formattedPhone = cleanPhone.startsWith('54') ? cleanPhone : `54${cleanPhone}`;
                                    const text = `Hola *${venta.clienteNombre || 'Cliente'}*, nos comunicamos de Forward por tu pedido #${(venta.id ?? '').slice(0, 8).toUpperCase()}.`;
                                    Linking.openURL(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`);
                                  }}
                                  style={[styles.clientActionBtn, { backgroundColor: 'rgba(37, 211, 102, 0.08)', borderColor: 'rgba(37, 211, 102, 0.2)' }]}
                                >
                                  <MessageCircle size={16} color="#25D366" />
                                  <Text style={[styles.clientActionText, { color: '#25D366' }]} maxFontSizeMultiplier={1.3}>WhatsApp</Text>
                                </TouchableOpacity>
                              </>
                            )}

                            {socio?.direccion && (
                              <TouchableOpacity
                                onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(socio.direccion ?? '')}`)}
                                style={[styles.clientActionBtn, { backgroundColor: 'rgba(59, 130, 246, 0.08)', borderColor: 'rgba(59, 130, 246, 0.2)' }]}
                              >
                                <MapPin size={16} color="#3b82f6" />
                                <Text style={[styles.clientActionText, { color: '#3b82f6' }]} maxFontSizeMultiplier={1.3}>Ver Mapa</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      </MotiView>
                    )}
                  </AnimatePresence>
                </View>
              </GlassCard>
            </Pressable>

            {/* Metadata Panel (Emisión, Vendedor, Depósito) */}
            <GlassCard intensity={10} style={{ borderRadius: 24, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 14 }}>
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', alignItems: 'center', justifyContent: 'center' }}>
                    <Calendar size={16} color={colors.primary} />
                  </View>
                  <Text style={[styles.infoLabel, { color: colors.textMuted, fontSize: tokens.typography.xs.size, marginBottom: 0 }]}>EMISIÓN</Text>
                </View>
                <Text style={[styles.infoValueSmall3, { color: colors.text, fontSize: 13 }]}>{formatDate(venta.fecha ?? '')}</Text>
              </View>

              <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={16} color={colors.primary} />
                  </View>
                  <Text style={[styles.infoLabel, { color: colors.textMuted, fontSize: tokens.typography.xs.size, marginBottom: 0 }]}>VENDEDOR</Text>
                </View>
                <Text style={[styles.infoValueSmall3, { color: colors.text, fontSize: 13 }]} numberOfLines={1}>{venta.vendedorNombre || 'Sistema'}</Text>
              </View>

              <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', alignItems: 'center', justifyContent: 'center' }}>
                    <Building2 size={16} color={colors.primary} />
                  </View>
                  <Text style={[styles.infoLabel, { color: colors.textMuted, fontSize: tokens.typography.xs.size, marginBottom: 0 }]}>DEPÓSITO</Text>
                </View>
                <Text style={[styles.infoValueSmall3, { color: colors.text, fontSize: 13, flexShrink: 1, textAlign: 'right' }]} numberOfLines={1}>{venta.depositoNombre || 'Principal'}</Text>
              </View>

            </GlassCard>
          </View>
        </MotiView>

        {/* ── Action Buttons Hero ── */}
        {!isFinal && !isCancelled && (
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: 100 }}>
            <View style={styles.heroQuickActions}>
              <RequirePermission module={["MOD_VENTAS", "MOD_PEDIDOS"]} action="update">
                {(String(venta.estado) === '1' || String(venta.estado) === 'Pendiente' || String(venta.estado) === '2' || String(venta.estado) === 'Confirmada' || String(venta.estado) === '9' || String(venta.estado) === 'PendienteAutorizacion') && (
                  <TouchableOpacity 
                    onPress={() => router.push(`/(tabs)/ventas/nueva?editId=${venta.id}`)} 
                    style={[styles.heroActionBtn, {
                      backgroundColor: colors.surface2,
                      borderColor: colors.border
                    }]}
                  >
                    <Pencil size={18} color={colors.text} />
                    <Text style={[styles.heroActionBtnText, { color: colors.text }]} maxFontSizeMultiplier={1.3}>Modificar</Text>
                  </TouchableOpacity>
                )}
              </RequirePermission>

              <RequirePermission module="MOD_VENTAS" action="delete">
                <TouchableOpacity 
                  onPress={handleAnular} 
                  style={[styles.heroActionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.2)' }]}
                >
                  <XCircle size={18} color={colors.danger} />
                  <Text style={[styles.heroActionBtnText, { color: colors.danger }]} maxFontSizeMultiplier={1.3}>Anular</Text>
                </TouchableOpacity>
              </RequirePermission>
            </View>
          </MotiView>
        )}

        {/* ── Logistics Stepper Premium ── */}
        {!isCancelled && !isPresupuesto && (
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: 150 }}>
            <GlassCard intensity={8} style={[styles.stepperContainer, { borderColor: colors.border }]}>
              <View style={styles.stepperHeader}>
                <TrendingUp size={16} color={colors.primary} />
                <Text style={[styles.stepperTitle, { color: colors.textMuted }]}>SEGUIMIENTO LOGÍSTICO</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10 }}>
                {steps.map((step, idx) => {
                  const isDone = currentIdx > idx
                  const isActive = currentIdx === idx
                  const lineBg = colors.border
                  const circleBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'
                  const textMutedColor = colors.textMuted
                  return (
                    <Pressable 
                      key={step.key} 
                      onPress={() => {
                        safeHaptics.impact('light');
                        setActiveStepIndex(activeStepIndex === idx ? null : idx);
                      }}
                      style={{ flex: 1, alignItems: 'center', zIndex: 5 }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                        <View style={{ flex: 1, height: 2, backgroundColor: idx === 0 ? 'transparent' : (isDone || isActive ? steps[idx-1].color : lineBg) }} />
                        
                        <View style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
                          {isActive && (
                            <MotiView
                              from={{ scale: 1, opacity: 0.6 }}
                              animate={{ scale: 1.6, opacity: 0 }}
                              transition={{
                                type: 'timing',
                                duration: 2000,
                                loop: true,
                                repeat: Infinity,
                              }}
                              style={{
                                position: 'absolute',
                                width: 34,
                                height: 34,
                                borderRadius: 17,
                                backgroundColor: step.color,
                              }}
                            />
                          )}
                          <View style={[
                            styles.stepCircle, 
                            { 
                              backgroundColor: isDone ? step.color : (isActive ? `${step.color}20` : circleBg),
                              borderColor: isActive ? step.color : 'transparent',
                              borderWidth: isActive ? 2 : 0,
                              width: 34,
                              height: 34
                            }
                          ]}>
                            {isDone ? <Check size={14} color="#fff" strokeWidth={4} /> : <step.Icon size={14} color={isActive ? step.color : textMutedColor} />}
                          </View>
                        </View>
                        <View style={{ flex: 1, height: 2, backgroundColor: idx === steps.length - 1 ? 'transparent' : (isDone ? step.color : lineBg) }} />
                      </View>
                      <Text style={[styles.stepLabel, { color: isActive ? colors.text : textMutedColor }]}>{step.label}</Text>
                    </Pressable>
                  )
                })}
              </View>

              <AnimatePresence>
                {activeStepIndex !== null && (
                  <MotiView
                    from={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    transition={{ type: 'timing', duration: 200 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <View style={[styles.stepperTooltip, { 
                      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      borderColor: steps[activeStepIndex]?.color ?? colors.border
                    }]}>
                      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 4 }}>
                        <View style={[styles.tooltipDot, { backgroundColor: steps[activeStepIndex]?.color }]} />
                        <Text style={[styles.tooltipTitle, { color: colors.text }]}>
                          {steps[activeStepIndex]?.label}
                        </Text>
                      </View>
                      <Text style={[styles.tooltipDesc, { color: colors.textMuted }]}>
                        {steps[activeStepIndex]?.desc}
                      </Text>
                    </View>
                  </MotiView>
                )}
              </AnimatePresence>
            </GlassCard>
          </MotiView>
        )}

        {/* ── Bultos Bento Box ── */}
        {bultos.length > 0 && (
          <MotiView from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 200 }}>
            <GlassCard intensity={12} style={[styles.bultosCard, { borderColor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)' }]}>
              <View style={styles.bultosHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <PackageCheck size={20} color={BRAND.blue} />
                  <Text style={[styles.bultosTitle, { color: colors.text }]}>LOGÍSTICA • {bultos.length} BULTOS</Text>
                </View>
                <TouchableOpacity onPress={handlePrintEtiquetas} style={styles.reprintBtn}>
                  <Printer size={14} color={BRAND.blue} />
                  <Text style={styles.reprintText}>Etiquetas</Text>
                </TouchableOpacity>
              </View>
              
              <View style={{ gap: 10 }}>
                {bultos.map((b: any) => (
                  <View key={b.id} style={[styles.bultoItem, {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    borderColor: colors.border
                  }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, overflow: 'hidden' }}>
                      <View style={[styles.bultoCircle, {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
                      }]}>
                        <Text style={[styles.bultoNum, { color: colors.text }]} maxFontSizeMultiplier={1.3}>{b.numero}</Text>
                      </View>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={[styles.bultoName, { color: colors.text }]}>
                          Tracking: {b.trackingId}
                        </Text>
                        <Text style={[styles.bultoDate, { color: colors.textMuted }]} numberOfLines={1}>Generado el {formatDate(b.fechaCreacion)}</Text>
                      </View>
                    </View>
                    <QrCode size={18} color={isDark ? '#525252' : '#94a3b8'} />
                  </View>
                ))}
              </View>
            </GlassCard>
          </MotiView>
        )}

        {/* ── Financial Summary ── */}
        <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: 250 }}>
          <GlassCard intensity={15} style={[styles.financeCard, { borderColor: colors.border }]}>
            <View style={{ padding: 24 }}>
              <View style={styles.financeHeader}>
                <ShieldCheck size={16} color={colors.primary} />
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>CERTIFICADO DE OPERACIÓN</Text>
              </View>
              <View style={{ gap: 16, marginTop: 12 }}>
                <View style={styles.financeRow}>
                  <Text style={[styles.financeLabel, { color: colors.textMuted }]}>Subtotal Bruto</Text>
                  <Text style={[styles.financeValue, { color: colors.text }]}>{formatMoney(venta.subtotalBrutoAmount ?? 0)}</Text>
                </View>
                {(venta.porcentajeDescuento ?? 0) > 0 && (
                  <View style={styles.financeRow}>
                    <Text style={[styles.financeLabel, { color: colors.danger }]}>Bonificación Especial ({venta.porcentajeDescuento ?? 0}%)</Text>
                    <Text style={[styles.financeValue, { color: colors.danger }]}>-{formatMoney(venta.montoDescuentoAmount ?? 0)}</Text>
                  </View>
                )}
                {(venta.cargoFleteAmount ?? 0) > 0 && (
                  <View style={styles.financeRow}>
                    <Text style={[styles.financeLabel, { color: colors.textMuted }]}>Cargo por Flete</Text>
                    <Text style={[styles.financeValue, { color: colors.text }]}>+{formatMoney(venta.cargoFleteAmount ?? 0)}</Text>
                  </View>
                )}
              </View>
            </View>
            <LinearGradient
              colors={isDark ? ['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)'] : ['rgba(0,0,0,0.03)', 'rgba(0,0,0,0.015)']}
              style={[styles.totalRow, { borderTopColor: colors.border }]}
            >
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.totalLabel, { color: colors.textMuted }]}>TOTAL A FACTURAR</Text>
                <Text 
                  adjustsFontSizeToFit
                  minimumFontScale={0.55}
                  numberOfLines={1}
                  style={[styles.totalValue, { color: colors.text }]}
                >
                  {formatMoney(venta.totalAmount ?? 0)}
                </Text>
              </View>
              <View style={[styles.totalIconCircle, {
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
              }]}>
                <TrendingUp size={24} color={isDark ? '#fff' : colors.primary} strokeWidth={2.5} />
              </View>
            </LinearGradient>
          </GlassCard>
        </MotiView>

        {/* ── Rentabilidad de la Venta (cost roles only — gated by precioCostoSnapshot presence) ── */}
        {puedeVerRentabilidad(
          detalles.map((d: any) => ({
            precioUnitario: d.precioUnitario ?? 0,
            precioCostoSnapshot: d.precioCostoSnapshot ?? null,
            cantidad: d.cantidad ?? 0,
          }))
        ) && (() => {
          const rent = calcularRentabilidadVenta({
            detalles: detalles.map((d: any) => ({
              precioUnitario: d.precioUnitario ?? 0,
              precioCostoSnapshot: d.precioCostoSnapshot ?? null,
              cantidad: d.cantidad ?? 0,
            })),
            subtotalBruto: venta.subtotalBrutoAmount ?? 0,
            montoDescuento: venta.montoDescuentoAmount ?? 0,
          })
          if (!rent) return null
          const { margenNeto, margenPct } = rent
          const isPositive = margenNeto >= 0
          const margenColor = isPositive ? '#22c55e' : colors.danger
          return (
            <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: 275 }}>
              <GlassCard intensity={12} style={[styles.financeCard, { borderColor: isPositive ? 'rgba(34,197,94,0.25)' : `${colors.danger}30` }]}>
                <View style={{ padding: 20 }}>
                  <View style={styles.financeHeader}>
                    <TrendingUp size={16} color={margenColor} />
                    <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>RENTABILIDAD DE LA VENTA</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 14, fontFamily: 'Outfit_500Medium', lineHeight: 16 }}>
                    Margen neto vs costo de compra (después del descuento general).
                  </Text>
                  <View style={{ gap: 12 }}>
                    <View style={styles.financeRow}>
                      <Text style={[styles.financeLabel, { color: colors.textMuted }]}>Margen Neto</Text>
                      <Text style={[styles.financeValue, { color: margenColor }]}>
                        {isPositive ? '+' : ''}{margenNeto.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} {venta.totalCurrency ?? 'ARS'}
                      </Text>
                    </View>
                    <View style={styles.financeRow}>
                      <Text style={[styles.financeLabel, { color: colors.textMuted }]}>Margen %</Text>
                      <Text style={[styles.financeValue, { color: margenColor }]}>
                        {isPositive ? '+' : ''}{margenPct.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                      </Text>
                    </View>
                  </View>
                </View>
              </GlassCard>
            </MotiView>
          )
        })()}

        {/* ── Items List ── */}
        <View style={styles.itemsHeader}>
          <View style={[styles.itemsIndicator, { backgroundColor: colors.primary }]} />
          <Text style={[styles.itemsTitle, { color: colors.textMuted }]}>DETALLE DE PRODUCTOS ({detalles.length})</Text>
        </View>

        {detalles.map((item: any, idx: number) => {
          const s = String(venta.estado)
          const needsStockPanel = s === '9' || s === 'PendienteAutorizacion' || s === '1' || s === 'Pendiente'
          const stockDisponible = Number(item.stockDisponible) || 0
          const faltante = Math.max(0, item.cantidad - stockDisponible)
          
          const isExpanded = !!expandedItems[item.id]
          const itemSubtotalOriginal = (item.precioUnitarioNormal ?? item.precioUnitario) * item.cantidad
          const itemMontoDescuento = itemSubtotalOriginal - item.subtotal
          const itemDescuentoPorc = item.porcentajeDescuento || (itemSubtotalOriginal > 0 ? Math.round((itemMontoDescuento / itemSubtotalOriginal) * 100) : 0)

          return (
            <MotiView key={item.id} from={{ opacity: 0, translateX: -10 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: 350 + idx * 50 }}>
              <Pressable
                onPress={() => {
                  safeHaptics.impact('light');
                  setExpandedItems(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                }}
              >
                <GlassCard intensity={8} style={[styles.itemCard, { borderColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <View style={[styles.itemIconCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
                      <Package size={22} color={colors.primary} strokeWidth={2.5} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemName, { color: colors.text }]}>{item.productoNombre}</Text>
                      <View style={styles.itemMetaRow}>
                        <Text style={[styles.itemQty, { color: colors.textMuted }]}>{item.cantidad} UN</Text>
                        <View style={[styles.metaDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
                        <Text style={[styles.itemPrice, { color: colors.textMuted }]}>{formatMoney(item.precioUnitario)} c/u</Text>
                        <ChevronDown size={14} color={colors.textMuted} style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }], marginLeft: 2 }} />
                      </View>
                    </View>
                    <Text style={[styles.itemTotal, { color: colors.text }]}>{formatMoney(item.subtotal)}</Text>
                  </View>

                  <AnimatePresence>
                    {isExpanded && (
                      <MotiView
                        from={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ type: 'timing', duration: 200 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <View style={[styles.itemDetailsPanel, { borderTopColor: colors.border }]}>
                          <View style={styles.expandedInfoRow}>
                            <Text style={[styles.expandedInfoLabel, { color: colors.textMuted }]}>Código SKU</Text>
                            <Text style={[styles.expandedInfoValue, { color: colors.text }]}>{(item.productoId || 'N/A').toUpperCase()}</Text>
                          </View>
                          <View style={styles.expandedInfoRow}>
                            <Text style={[styles.expandedInfoLabel, { color: colors.textMuted }]}>Precio Lista</Text>
                            <Text style={[styles.expandedInfoValue, { color: colors.text }]}>{formatMoney(item.precioUnitarioNormal ?? item.precioUnitario)}</Text>
                          </View>
                          {itemMontoDescuento > 0 && (
                            <View style={styles.expandedInfoRow}>
                              <Text style={[styles.expandedInfoLabel, { color: colors.danger }]}>Bonificación ({itemDescuentoPorc}%)</Text>
                              <Text style={[styles.expandedInfoValue, { color: colors.danger }]}>-{formatMoney(itemMontoDescuento)}</Text>
                            </View>
                          )}
                          <View style={styles.expandedInfoRow}>
                            <Text style={[styles.expandedInfoLabel, { color: colors.textMuted }]}>Precio Unitario Neto</Text>
                            <Text style={[styles.expandedInfoValue, { color: colors.text, fontWeight: '700' }]}>{formatMoney(item.precioUnitario)}</Text>
                          </View>
                        </View>
                      </MotiView>
                    )}
                  </AnimatePresence>

                  {needsStockPanel && (
                    <View style={[styles.stockPanel, { borderTopColor: colors.border }]}>
                      <View style={styles.stockHeaderPanel}>
                        <Info size={12} color={colors.textMuted} />
                        <Text style={[styles.stockTitleLabel, { color: colors.textMuted }]}>AUDITORÍA DE STOCK</Text>
                      </View>
                      
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={[styles.stockBox, {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                          borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'
                        }]}>
                          <Text style={[styles.stockBoxLabel, { color: colors.textMuted }]}>REQUERIDO</Text>
                          <Text style={[styles.stockBoxValue, { color: colors.text }]}>{item.cantidad}</Text>
                        </View>
                        <View style={[styles.stockBox, { 
                          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                          borderColor: faltante > 0 ? `${colors.danger}40` : `${colors.primary}40` 
                        }]}>
                          <Text style={[styles.stockBoxLabel, { color: colors.textMuted }]}>DISPONIBLE</Text>
                          <Text style={[styles.stockBoxValue, { color: faltante > 0 ? colors.danger : colors.primary }]}>{stockDisponible}</Text>
                        </View>
                      </View>

                      {faltante > 0 && (
                        <View style={[styles.faltanteAlert, { backgroundColor: `${colors.danger}12`, borderColor: `${colors.danger}30` }]}>
                          <AlertTriangle size={14} color={colors.danger} />
                          <Text style={[styles.faltanteText, { color: colors.danger }]}>STOCK INSUFICIENTE: FALTA {faltante} UN.</Text>
                        </View>
                      )}
                    </View>
                  )}
                </GlassCard>
              </Pressable>
            </MotiView>
          )
        })}

        {/* Timeline de Auditoría Premium */}
        <GlassCard intensity={8} style={[styles.timelineCard, { borderColor: colors.border, marginTop: 24 }]}>
          <View style={styles.timelineHeader}>
            <Layers size={16} color={colors.primary} />
            <Text style={[styles.timelineTitle, { color: colors.textMuted }]}>LÍNEA DE TIEMPO DE AUDITORÍA</Text>
          </View>

          <View style={{ gap: 0, paddingLeft: 6 }}>
            {/* Event 1: Creación */}
            <View style={styles.timelineNodeRow}>
              <View style={styles.timelineLeftCol}>
                <View style={[styles.timelineIconCircle, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }]}>
                  <Clock size={14} color={colors.primary} />
                </View>
                {(venta.modificadoPor || venta.autorizadoPor) && (
                  <View style={[styles.timelineConnectorLine, { backgroundColor: colors.border }]} />
                )}
              </View>
              <View style={styles.timelineRightCol}>
                <Text style={[styles.timelineNodeTitle, { color: colors.text }]}>Creación del Pedido</Text>
                <Text style={[styles.timelineNodeDesc, { color: colors.textMuted }]}>
                  Por <Text style={{ color: colors.text, fontWeight: '600' }}>{venta.creadoPor || 'Sistema'}</Text>
                </Text>
                <Text style={[styles.timelineNodeTime, { color: colors.textMuted }]}>{formatDate(venta.fechaCreacion ?? '')}</Text>
              </View>
            </View>

            {/* Event 2: Modificación */}
            {venta.modificadoPor && (
              <View style={styles.timelineNodeRow}>
                <View style={styles.timelineLeftCol}>
                  <View style={[styles.timelineIconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.25)' }]}>
                    <Pencil size={14} color="#f59e0b" />
                  </View>
                  {venta.autorizadoPor && (
                    <View style={[styles.timelineConnectorLine, { backgroundColor: colors.border }]} />
                  )}
                </View>
                <View style={styles.timelineRightCol}>
                  <Text style={[styles.timelineNodeTitle, { color: colors.text }]}>Última Modificación</Text>
                  <Text style={[styles.timelineNodeDesc, { color: colors.textMuted }]}>
                    Por <Text style={{ color: colors.text, fontWeight: '600' }}>{venta.modificadoPor}</Text>
                  </Text>
                  <Text style={[styles.timelineNodeTime, { color: colors.textMuted }]}>{formatDate(venta.fechaModificacion ?? '')}</Text>
                </View>
              </View>
            )}

            {/* Event 3: Autorización */}
            {venta.autorizadoPor && (
              <View style={styles.timelineNodeRow}>
                <View style={styles.timelineLeftCol}>
                  <View style={[styles.timelineIconCircle, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }]}>
                    <ShieldCheck size={14} color={colors.primary} />
                  </View>
                </View>
                <View style={styles.timelineRightCol}>
                  <Text style={[styles.timelineNodeTitle, { color: colors.primary }]}>Pedido Autorizado</Text>
                  <Text style={[styles.timelineNodeDesc, { color: colors.textMuted }]}>
                    Por <Text style={{ color: colors.text, fontWeight: '600' }}>{venta.autorizadoPor}</Text>
                  </Text>
                  <Text style={[styles.timelineNodeTime, { color: colors.textMuted }]}>{formatDate(venta.fechaModificacion ?? venta.fechaCreacion ?? '')}</Text>
                </View>
              </View>
            )}
          </View>
        </GlassCard>

      </ScrollView>

      {/* ── Floating Action Bar Premium ── */}
      {(() => {
        if (isCancelled || isFinal) return null
        const s = String(venta.estado)
        let actionLabel = '', IconComponent: any = null, actionColor = colors.primary, actionFn: (() => any) = () => {}, actionVisible = true

        if (isPresupuesto) {
          actionLabel = 'Convertir a Pedido';
          actionColor = '#6366f1';
          actionFn = handleConvertir;
        }
        else if (canAuthorizeVenta(s, user?.roles ?? [])) {
          actionLabel = 'Autorizar Pedido';
          actionColor = BRAND.orange;
          actionFn = () => setShowAuthModal(true);
          IconComponent = CheckCircle2;
        }
        else {
          actionVisible = false
        }

        if (!actionVisible) return null

        const actionTextColor = actionColor === colors.primary 
          ? (isDark ? '#000' : '#fff') 
          : ((actionColor === colors.warning || actionColor === BRAND.orange) ? '#000' : '#fff')
        const actionIcon = IconComponent ? <IconComponent size={22} color={actionTextColor} strokeWidth={3} /> : null

        return (
          <AnimatePresence>
            <MotiView 
              from={{ translateY: 100, opacity: 0 }} 
              animate={{ translateY: 0, opacity: 1 }} 
              style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20), borderTopColor: colors.border }]}
            >
              <BlurView intensity={40} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
              <TouchableOpacity 
                onPress={() => {
                  safeHaptics.impact('medium');
                  actionFn();
                }} 
                disabled={isChangingStatus}
                activeOpacity={0.9}
                style={[styles.mainActionBtn, { backgroundColor: actionColor, opacity: isChangingStatus ? 0.7 : 1 }]}
              >
                {isChangingStatus ? (
                  <ActivityIndicator color={actionTextColor} />
                ) : (
                  <>
                    <Text style={[styles.mainActionText, { color: actionTextColor }]} maxFontSizeMultiplier={1.3}>
                      {actionLabel.toUpperCase()}
                    </Text>
                    {actionIcon}
                  </>
                )}
              </TouchableOpacity>
            </MotiView>
          </AnimatePresence>
        )
      })()}

      {canAuthorizeVenta(String(venta?.estado), user?.roles ?? []) && (
        <AuthorizationModal
          ventaId={id ?? ''}
          version={venta?.version ?? 0}
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onAuthorized={() => refetch()}
        />
      )}

      {modalState && (
        <ConfirmModal
          visible={modalState.visible}
          title={modalState.title}
          message={modalState.message}
          variant={modalState.variant}
          onConfirm={modalState.onConfirm}
          onCancel={modalState.onCancel || (() => setModalState(null))}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  backButton: { width: 48, height: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  headerTitle: { fontSize: tokens.typography.xl.size, fontWeight: '900', fontFamily: 'Outfit_900Black', letterSpacing: -0.5 },
  headerIdBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 2 },
  headerIdText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5, fontFamily: 'Outfit_900Black' },

  heroCardMain: { borderRadius: 32, overflow: 'hidden', borderWidth: 1 },
  heroCardSmall: { borderRadius: 24, padding: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroCardSmall3: { borderRadius: 20, padding: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusStrip: { height: 6, width: '100%' },
  sectionLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginBottom: 6, fontFamily: 'Outfit_900Black' },
  clientName: { fontSize: 24, fontWeight: '900', fontFamily: 'Outfit_900Black', letterSpacing: -0.5, lineHeight: 28 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  statusText: { fontWeight: '900', fontSize: tokens.typography.xs.size, fontFamily: 'Outfit_900Black', textTransform: 'uppercase' },
  infoLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8, marginBottom: 2, fontFamily: 'Outfit_900Black' },
  infoValueSmall: { fontSize: 13, fontWeight: '700', fontFamily: 'Outfit_700Bold' },
  infoValueSmall3: { fontSize: 11, fontWeight: '700', fontFamily: 'Outfit_700Bold' },

  clientMetaChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, flexDirection: 'column', minWidth: 80 },
  clientMetaLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5, fontFamily: 'Outfit_900Black', marginBottom: 2 },
  clientMetaValue: { fontSize: tokens.typography.sm.size, fontWeight: '700', fontFamily: 'Outfit_700Bold' },
  clientAddress: { fontSize: 13, fontFamily: 'Outfit_500Medium', flex: 1 },
  clientActionBtn: { flex: 1, height: 40, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  clientActionText: { fontSize: tokens.typography.sm.size, fontWeight: '800', fontFamily: 'Outfit_700Bold' },

  heroQuickActions: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  heroActionBtn: { flex: 1, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, borderWidth: 1 },
  heroActionBtnText: { fontWeight: '900', fontSize: tokens.typography.base.size, fontFamily: 'Outfit_900Black' },
  
  stepperContainer: { borderRadius: 28, padding: 20, marginBottom: 20, borderWidth: 1 },
  stepperHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20, opacity: 0.6 },
  stepperTitle: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5, fontFamily: 'Outfit_900Black' },
  stepCircle: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontSize: 9, fontWeight: '900', marginTop: 10, fontFamily: 'Outfit_900Black' },
  stepperTooltip: { padding: 14, borderRadius: 18, borderWidth: 1, borderStyle: 'solid' },
  tooltipDot: { width: 8, height: 8, borderRadius: 4 },
  tooltipTitle: { fontSize: 13, fontWeight: '900', fontFamily: 'Outfit_900Black' },
  tooltipDesc: { fontSize: tokens.typography.sm.size, fontFamily: 'Outfit_500Medium', lineHeight: 16 },
  
  bultosCard: { borderRadius: 28, padding: 20, marginBottom: 20, borderWidth: 1 },
  bultosHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  bultosTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5, fontFamily: 'Outfit_900Black' },
  reprintBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(59, 130, 246, 0.12)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  reprintText: { color: '#3b82f6', fontSize: 11, fontWeight: '900', fontFamily: 'Outfit_900Black' },
  bultoItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 20, borderWidth: 1 },
  bultoCircle: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bultoNum: { fontSize: tokens.typography.base.size, fontWeight: '900', fontFamily: 'Outfit_900Black' },
  bultoName: { fontSize: tokens.typography.base.size, fontWeight: '700', fontFamily: 'Outfit_700Bold' },
  bultoDate: { fontSize: tokens.typography.xs.size, fontFamily: 'Outfit_500Medium', marginTop: 2 },
  
  financeCard: { borderRadius: 32, overflow: 'hidden', marginBottom: 24, borderWidth: 1 },
  financeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  financeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  financeLabel: { fontSize: 15, fontWeight: '600', fontFamily: 'Outfit_500Medium' },
  financeValue: { fontSize: 15, fontWeight: '800', fontFamily: 'Outfit_700Bold' },
  totalRow: { padding: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1 },
  totalLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, fontFamily: 'Outfit_900Black', marginBottom: 4 },
  totalValue: { fontSize: 34, fontWeight: '900', fontFamily: 'Outfit_900Black', letterSpacing: -1 },
  totalIconCircle: { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  
  itemsHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, paddingHorizontal: 4 },
  itemsIndicator: { width: 4, height: 16, borderRadius: 2 },
  itemsTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, fontFamily: 'Outfit_900Black' },
  itemCard: { borderRadius: 28, padding: 18, marginBottom: 14, borderWidth: 1 },
  itemIconCircle: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  itemName: { fontWeight: '900', fontSize: tokens.typography.md.size, fontFamily: 'Outfit_900Black', marginBottom: 4 },
  itemMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemQty: { fontSize: tokens.typography.sm.size, fontWeight: '800', fontFamily: 'Outfit_700Bold' },
  metaDivider: { width: 4, height: 4, borderRadius: 2 },
  itemPrice: { fontSize: tokens.typography.sm.size, fontFamily: 'Outfit_500Medium' },
  itemTotal: { fontWeight: '900', fontSize: tokens.typography.lg.size, fontFamily: 'Outfit_900Black', letterSpacing: -0.5 },
  itemDetailsPanel: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, gap: 10 },
  expandedInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  expandedInfoLabel: { fontSize: 13, fontFamily: 'Outfit_500Medium' },
  expandedInfoValue: { fontSize: 13, fontFamily: 'Outfit_700Bold' },
  
  stockPanel: { marginTop: 18, paddingTop: 18, borderTopWidth: 1 },
  stockHeaderPanel: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  stockTitleLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2, fontFamily: 'Outfit_900Black' },
  stockBox: { flex: 1, padding: 14, borderRadius: 18, alignItems: 'center', borderWidth: 1 },
  stockBoxLabel: { fontSize: 8, fontWeight: '900', marginBottom: 6, fontFamily: 'Outfit_900Black' },
  stockBoxValue: { fontSize: 20, fontWeight: '900', fontFamily: 'Outfit_900Black' },
  faltanteAlert: { marginTop: 14, padding: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', borderWidth: 1 },
  faltanteText: { fontSize: 11, fontWeight: '900', fontFamily: 'Outfit_900Black' },
  
  auditContainer: { marginTop: 24, padding: 24, borderRadius: 28, borderStyle: 'dashed', borderWidth: 1, marginBottom: 20 },
  auditHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, opacity: 0.5 },
  auditTitle: { fontSize: tokens.typography.xs.size, fontWeight: '900', letterSpacing: 1.5, fontFamily: 'Outfit_900Black' },
  auditRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  auditDot: { width: 6, height: 6, borderRadius: 3 },
  auditText: { fontSize: 11, fontFamily: 'Outfit_500Medium' },
  auditUser: { fontWeight: '700' },
  authBadgeContainer: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, borderWidth: 1 },
  authText: { fontSize: 11, fontWeight: '900', fontFamily: 'Outfit_900Black' },

  timelineCard: { borderRadius: 28, padding: 20, marginBottom: 20, borderWidth: 1 },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  timelineTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, fontFamily: 'Outfit_900Black' },
  timelineNodeRow: { flexDirection: 'row', gap: 16 },
  timelineLeftCol: { alignItems: 'center', width: 28 },
  timelineRightCol: { flex: 1, paddingBottom: 20 },
  timelineIconCircle: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  timelineConnectorLine: { width: 2, flex: 1, marginVertical: 4 },
  timelineNodeTitle: { fontSize: tokens.typography.base.size, fontWeight: '900', fontFamily: 'Outfit_900Black' },
  timelineNodeDesc: { fontSize: tokens.typography.sm.size, fontFamily: 'Outfit_500Medium', marginTop: 2 },
  timelineNodeTime: { fontSize: tokens.typography.xs.size, fontFamily: 'Outfit_500Medium', marginTop: 4, opacity: 0.8 },
  
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, overflow: 'hidden', borderTopWidth: 1 },
  mainActionBtn: { height: 68, borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 14, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 18, elevation: 10 },
  mainActionText: { fontWeight: '900', fontSize: 17, fontFamily: 'Outfit_900Black', letterSpacing: 1 },
  
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 20 },
  packingModal: { borderRadius: 36, padding: 28, borderWidth: 1 },
  modalHeaderPanel: { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 28 },
  modalIconBox: { width: 60, height: 60, borderRadius: 20, backgroundColor: 'rgba(139, 92, 246, 0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.2)' },
  modalTitle: { fontSize: 24, fontWeight: '900', fontFamily: 'Outfit_900Black' },
  modalSubtitle: { fontSize: tokens.typography.base.size, fontFamily: 'Outfit_500Medium', marginTop: 2 },
  bultosInputContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 28, borderRadius: 28, marginBottom: 28, borderWidth: 1 },
  stepperBtn: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  stepperSign: { fontSize: tokens.typography['3xl'].size, fontWeight: '300' },
  bultosCount: { fontSize: 56, fontWeight: '900', fontFamily: 'Outfit_900Black', lineHeight: 60 },
  bultosLabel: { fontSize: tokens.typography.xs.size, fontWeight: '900', letterSpacing: 2, fontFamily: 'Outfit_900Black' },
  modalCancelBtn: { flex: 1, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { fontWeight: '900', fontSize: 13, letterSpacing: 1, fontFamily: 'Outfit_900Black' },
  modalConfirmBtn: { flex: 2, height: 60, borderRadius: 20, backgroundColor: '#8b5cf6', alignItems: 'center', justifyContent: 'center', shadowColor: '#8b5cf6', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 15 },
  modalConfirmText: { color: '#fff', fontWeight: '900', fontSize: tokens.typography.md.size, letterSpacing: 1, fontFamily: 'Outfit_900Black' }
})

