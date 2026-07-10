import React from 'react'
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router'
import { DrawerActions, useFocusEffect } from '@react-navigation/native'
import { useColors, BRAND } from '../../../libs/theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  X,
  Plus,
  ChevronDown,
  Search,
  Minus,
  Tag,
  ArrowLeft,
  Building2,
  Package,
  CheckCircle2,
  Truck,
  Trash2,
  Clock,
  Layers,
} from 'lucide-react-native'
import { Image as ExpoImage } from 'expo-image'
import { MotiView, AnimatePresence } from 'moti'
import { safeHaptics } from '@/core/utils/haptics'
import { ForwardLogo } from '@/core/ui'
import { getFullImageUrl } from '@/libs/api-client'

import { useCompraForm } from '@/features/compras/hooks/useCompraForm'
import type { EstadoOrden } from '@/features/compras/hooks/useCompraForm'

import { ProveedorModal } from '@/features/compras/components/ProveedorModal'
import { DepositoModal } from '@/features/compras/components/DepositoModal'
import { CatalogModal } from '@/features/compras/components/CatalogModal'

const ESTADO_OPTIONS: { value: EstadoOrden; label: string; desc: string; Icon: any; color: string }[] = [
  { value: 'Presupuesto', label: 'Nota de Pedido', desc: 'No afecta stock', Icon: Clock, color: '#94a3b8' },
  { value: 'Confirmado',  label: 'Confirmado',     desc: 'Genera virtual',  Icon: CheckCircle2, color: BRAND.blue },
  { value: 'Recibida',    label: 'Recibida',       desc: 'Ingreso a stock', Icon: Truck, color: BRAND.lime },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMoney(val: number) {
  return `$\u00a0${val.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function NuevaCompraScreen() {
  const router = useRouter()
  const navigation = useNavigation()
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const { edit } = useLocalSearchParams<{ edit: string }>()

  const {
    loadingEdit, loadingProds, isPending,
    proveedorSelected, setProveedorSelected,
    depositoSelected, setDepositoSelected,
    detalles,
    gastosStr, setGastosStr,
    descuentoStr, setDescuentoStr,
    estadoOrden, setEstadoOrden,
    successModal, setSuccessModal,
    showProvModal, setShowProvModal,
    showDepModal, setShowDepModal,
    showProductModal, setShowProductModal,
    provSearch, setProvSearch,
    productSearch, setProductSearch,
    subtotal, total,
    proveedoresFiltrados, productosFiltrados, depositos,
    setProductoCantidad, updateCantidad, updateCosto, removeDetalle,
    onSubmit, canSubmit,
    // State lifecycle management
    resetFormState, bumpFocusKey, queryClient, comprasKeys,
  } = useCompraForm(edit)

  // ── State Lifecycle: useFocusEffect ──────────────────────────────────────
  useFocusEffect(
    React.useCallback(() => {
      resetFormState()
      if (edit) {
        queryClient.removeQueries({ queryKey: comprasKeys.detail(edit) })
      }
      bumpFocusKey()

      return () => resetFormState()
    }, [edit, queryClient, resetFormState, bumpFocusKey, comprasKeys])
  )

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      
      {/* ── Header Premium (Reemplazo BlurView por View p/ evitar crash Android) ── */}
      <View style={{
        paddingTop: insets.top || 48,
        paddingBottom: 16,
        paddingHorizontal: 16,
        backgroundColor: colors.bg,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 100
      }}>
        <View style={{
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center',
          borderWidth: 1, borderColor: colors.border
        }}>
          <ForwardLogo size={24} showText={false} onPress={() => { safeHaptics.impact('light'); navigation.dispatch(DrawerActions.openDrawer()); }} />
        </View>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text, letterSpacing: -0.5 }}>
            {edit ? 'Editar Orden' : 'Nueva Compra'}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: '600' }}>
            {edit ? `OC #${edit.slice(0,8).toUpperCase()} · Proveedor` : 'Gestión de Abastecimiento'}
          </Text>
        </View>
        <Pressable onPress={() => router.replace('/(tabs)/compras')} style={{ padding: 8, backgroundColor: colors.surface2, borderRadius: 20 }}>
          <X size={20} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 320 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AnimatePresence>
          {loadingEdit ? (
            <MotiView 
              from={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ paddingVertical: 100, alignItems: 'center' }}
            >
              <ActivityIndicator size="large" color={colors.primary} />
            </MotiView>
          ) : (
            <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}>
              
              {/* ══ CONFIGURACIÓN PRINCIPAL (Grouped List Premium) ══ */}
              <View style={{ marginBottom: 24 }}>
                <SectionTitle colors={colors}>Origen & Destino</SectionTitle>
                <View style={{ 
                  backgroundColor: colors.surface, 
                  borderRadius: 24, 
                  overflow: 'hidden'
                }}>
                  <ConfigFieldRow 
                    label="Proveedor" 
                    value={proveedorSelected?.razonSocial} 
                    onPress={() => setShowProvModal(true)} 
                    IconCmp={Building2} 
                    colorContext={colors.primary} 
                    colors={colors}
                  />
                  <View style={{ height: 1, backgroundColor: colors.border + '40', marginLeft: 70 }} />
                  <ConfigFieldRow 
                    label="Depósito" 
                    value={depositoSelected?.nombre} 
                    onPress={() => setShowDepModal(true)} 
                    IconCmp={Package} 
                    colorContext={BRAND.blue} 
                    colors={colors}
                  />
                </View>
              </View>

              {/* ══ SELECTOR DE ESTADOS ══ */}
              {!edit && (
                <View style={{ marginBottom: 28 }}>
                  <SectionTitle colors={colors}>Flujo Inicial de la Orden</SectionTitle>
                  <View style={{ flexDirection: 'row' }}>
                    {ESTADO_OPTIONS.map((opt, index) => {
                      const active = estadoOrden === opt.value
                      return (
                        <Pressable
                          key={opt.value}
                          onPress={() => setEstadoOrden(opt.value)}
                          style={{ flex: 1, marginRight: index < 2 ? 8 : 0 }}
                        >
                          <View style={{
                            backgroundColor: active ? `${opt.color}15` : colors.surface,
                            borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8,
                            alignItems: 'center', justifyContent: 'center'
                          }}>
                            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: active ? opt.color : colors.surface2, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                              <opt.Icon size={16} color={active ? '#fff' : colors.textMuted} />
                            </View>
                            <Text style={{ fontSize: 11, fontWeight: '900', color: active ? colors.text : colors.textMuted, textAlign: 'center' }}>{opt.label}</Text>
                          </View>
                        </Pressable>
                      )
                    })}
                  </View>
                </View>
              )}

              {/* ══ ARTÍCULOS ══ */}
              <View style={{ marginBottom: 28 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <SectionTitle colors={colors} noMargin>Inventario ({detalles.length})</SectionTitle>
                  <Pressable onPress={() => setShowProductModal(true)}>
                    {({ pressed }) => (
                      <View style={{
                        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
                        backgroundColor: pressed ? `${colors.primary}30` : `${colors.primary}15`,
                        borderRadius: 12,
                      }}>
                        <Plus size={14} color={colors.primary} strokeWidth={3} style={{ marginRight: 6 }} />
                        <Text style={{ color: colors.primary, fontWeight: '900', fontSize: 11, textTransform: 'uppercase' }}>Explorar Catálogo</Text>
                      </View>
                    )}
                  </Pressable>
                </View>

                {detalles.length === 0 ? (
                  <Pressable onPress={() => setShowProductModal(true)}>
                    {({ pressed }) => (
                      <View style={{
                        height: 140, backgroundColor: pressed ? colors.surface2 : colors.surface, 
                        borderStyle: 'dashed', borderWidth: 1, borderColor: colors.textDisabled + '40',
                        borderRadius: 20, alignItems: 'center', justifyContent: 'center'
                      }}>
                         <Layers size={32} color={colors.textDisabled} />
                         <Text style={{ color: colors.textMuted, fontWeight: '700', marginTop: 12, fontSize: 13 }}>Toca para añadir artículos</Text>
                      </View>
                    )}
                  </Pressable>
                ) : (
                  <View style={{ gap: 12 }}>
                    {detalles.map(d => {
                      const dImgUrl = getFullImageUrl(d.imageUrl)
                      return (
                        <View key={d.productoId} style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 16 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
                            {/* Product Image */}
                            <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: colors.surface2, marginRight: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                              {dImgUrl ? <ExpoImage source={dImgUrl} style={{ width: '100%', height: '100%' }} /> : <Package size={16} color={colors.textDisabled} />}
                            </View>
                            {/* Product Info */}
                            <View style={{ flex: 1, marginRight: 12 }}>
                              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }} numberOfLines={2}>{d.nombre}</Text>
                              <Text style={{ color: colors.primary, fontWeight: '900', fontSize: 13, marginTop: 4 }}>Subtotal: {formatMoney(d.cantidad * d.costoUnitario)}</Text>
                            </View>
                            {/* Delete Action */}
                            <Pressable onPress={() => removeDetalle(d.productoId)} style={{ padding: 6, backgroundColor: `${colors.danger}15`, borderRadius: 10 }}>
                              <Trash2 size={16} color={colors.danger} />
                            </Pressable>
                          </View>

                          <View style={{ flexDirection: 'row', gap: 12 }}>
                            {/* Costo Input */}
                            <View style={{ flex: 1, backgroundColor: colors.surface2, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12 }}>
                              <Text style={{ fontSize: 9, color: colors.textDisabled, fontWeight: '800', textTransform: 'uppercase', marginBottom: 2 }}>Costo Unit.</Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                 <Text style={{ color: colors.textMuted, fontWeight: '800', fontSize: 14, marginRight: 2 }}>$</Text>
                                 <TextInput 
                                   style={{ flex: 1, color: colors.text, fontWeight: '800', fontSize: 15, padding: 0 }}
                                   keyboardType="decimal-pad" value={String(d.costoUnitario)} onChangeText={v => updateCosto(d.productoId, v)} selectTextOnFocus
                                 />
                              </View>
                            </View>

                            {/* Cantidad Incrementer */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface2, borderRadius: 14 }}>
                              <Pressable onPress={() => updateCantidad(d.productoId, -1)} style={{ padding: 12 }}><Minus size={16} color={colors.text} strokeWidth={3} /></Pressable>
                              <Text style={{ color: colors.text, fontWeight: '900', fontSize: 16, minWidth: 30, textAlign: 'center' }}>{d.cantidad}</Text>
                              <Pressable onPress={() => updateCantidad(d.productoId, 1)} style={{ padding: 12 }}><Plus size={16} color={colors.text} strokeWidth={3} /></Pressable>
                            </View>
                          </View>
                        </View>
                      )
                    })}
                  </View>
                )}
              </View>

              {/* ══ AJUSTES Y DESCUENTOS ══ */}
              <View>
                <SectionTitle colors={colors}>Ajustes de Valor</SectionTitle>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 20, padding: 16 }}>
                    <Text style={{ fontSize: 10, fontWeight: '900', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>Fletes / Extras</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ color: colors.textMuted, fontWeight: '800', fontSize: 18 }}>$</Text>
                      <TextInput 
                        style={{ flex: 1, marginLeft: 4, color: colors.text, fontWeight: '900', fontSize: 18, padding: 0 }}
                        keyboardType="numeric" value={gastosStr} onChangeText={setGastosStr} placeholder="0" placeholderTextColor={colors.textDisabled}
                      />
                    </View>
                  </View>
                  <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 20, padding: 16 }}>
                    <Text style={{ fontSize: 10, fontWeight: '900', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>Descuento General</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TextInput 
                        style={{ flex: 1, color: colors.text, fontWeight: '900', fontSize: 18, padding: 0 }}
                        keyboardType="numeric" value={descuentoStr} onChangeText={setDescuentoStr} placeholder="0" placeholderTextColor={colors.textDisabled}
                      />
                      <Text style={{ color: colors.textMuted, fontWeight: '800', fontSize: 18 }}>%</Text>
                    </View>
                  </View>
                </View>
              </View>

            </MotiView>
          )}
        </AnimatePresence>
      </ScrollView>

      {/* ── Floating Executive Summary (Sticky Footer) ── */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: colors.surface,
        paddingHorizontal: 20, paddingTop: 20, paddingBottom: Math.max(insets.bottom, 20),
        shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 20
      }}>
        {detalles.length > 0 && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
            <View>
              <Text style={{ fontSize: 10, fontWeight: '900', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Subtotal Bruto</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{formatMoney(subtotal)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 10, fontWeight: '900', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>A Pagar (ARS)</Text>
              <Text style={{ fontSize: 24, fontWeight: '900', color: colors.primary, letterSpacing: -1 }}>{formatMoney(total)}</Text>
            </View>
          </View>
        )}

        <Pressable
          disabled={!canSubmit || isPending}
          onPress={onSubmit}
        >
          {({ pressed }) => (
            <View style={{
              height: 56, borderRadius: 16,
              backgroundColor: canSubmit ? (pressed ? `${colors.primary}90` : colors.primary) : colors.surface2,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: pressed && !canSubmit ? 0.7 : 1
            }}>
              {isPending ? <ActivityIndicator color={canSubmit ? "#fff" : colors.textMuted} /> : (
                <>
                  {canSubmit && <CheckCircle2 size={20} color="#fff" strokeWidth={3} />}
                  <Text style={{ color: canSubmit ? '#fff' : colors.textMuted, fontWeight: '900', fontSize: 17 }}>
                    {edit ? 'Guardar Cambios' : 'Confirmar Orden'}
                  </Text>
                </>
              )}
            </View>
          )}
        </Pressable>
      </View>

      {/* ══ MODALS (Overlays absolutos) ══ */}

      {/* Success Modal Custom */}
      {successModal && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
          <MotiView
            from={{ opacity: 0, scale: 0.9, translateY: 20 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            style={{
              width: '85%',
              backgroundColor: colors.surface,
              borderRadius: 28,
              padding: 32,
              alignItems: 'center',
              shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 15
            }}
          >
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: `${BRAND.blue}15`, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <CheckCircle2 size={36} color={BRAND.blue} strokeWidth={2.5} />
            </View>
            <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', marginBottom: 32, lineHeight: 20 }}>
              La información se ha sincronizado correctamente con la base de datos central.
            </Text>
            <Pressable
              onPress={() => {
                setSuccessModal(false)
                router.replace('/(tabs)/compras')
              }}
              style={({ pressed }) => ({
                width: '100%', height: 52, backgroundColor: pressed ? `${BRAND.blue}90` : BRAND.blue,
                borderRadius: 16, alignItems: 'center', justifyContent: 'center',
              })}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }}>CONFIRMAR Y SALIR</Text>
            </Pressable>
          </MotiView>
        </View>
      )}

      {/* Proveedor Modal */}
      <ProveedorModal
        visible={showProvModal}
        onClose={() => setShowProvModal(false)}
        colors={colors}
        provSearch={provSearch}
        setProvSearch={setProvSearch}
        proveedoresFiltrados={proveedoresFiltrados}
        onSelectProveedor={setProveedorSelected}
      />

      {/* Deposito Modal */}
      <DepositoModal
        visible={showDepModal}
        onClose={() => setShowDepModal(false)}
        colors={colors}
        depositos={depositos}
        onSelectDeposito={setDepositoSelected}
      />

      {/* Producto Modal (Catálogo) */}
      <CatalogModal
        visible={showProductModal}
        onClose={() => setShowProductModal(false)}
        colors={colors}
        productSearch={productSearch}
        setProductSearch={setProductSearch}
        loadingProds={loadingProds}
        productosFiltrados={productosFiltrados}
        detalles={detalles}
        setProductoCantidad={setProductoCantidad}
      />

    </KeyboardAvoidingView>
  )
}

// ── Components Helper ─────────────────────────────────────────────────────────

function SectionTitle({ children, colors, style, noMargin }: any) {
  return (
    <Text style={[{
      fontSize: 9, fontWeight: '900', color: colors.textDisabled,
      textTransform: 'uppercase', letterSpacing: 2,
      marginBottom: noMargin ? 0 : 16, marginLeft: 4
    }, style]}>{children}</Text>
  )
}

const ConfigFieldRow = ({ label, value, onPress, IconCmp, colorContext, colors }: any) => (
  <Pressable onPress={onPress}>
    {({ pressed }) => (
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
        paddingHorizontal: 20,
        backgroundColor: pressed ? `${colors.primary}08` : 'transparent',
      }}>
        <View style={{ 
          width: 40, height: 40, borderRadius: 12, 
          backgroundColor: `${colorContext}12`, 
          alignItems: 'center', justifyContent: 'center',
          marginRight: 16 
        }}>
          <IconCmp size={20} color={colorContext} />
        </View>
        
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={{ fontSize: 9, fontWeight: '900', color: colors.textDisabled, textTransform: 'uppercase', letterSpacing: 1.5 }}>
            {label}
          </Text>
          <Text style={{ fontSize: 14, fontWeight: '900', color: value ? colors.text : colors.primary, marginTop: 2, textTransform: value ? 'uppercase' : 'none' }}>
            {value || 'SELECCIONAR...'}
          </Text>
        </View>
        
        <ChevronDown size={18} color={colors.textDisabled} />
      </View>
    )}
  </Pressable>
)
