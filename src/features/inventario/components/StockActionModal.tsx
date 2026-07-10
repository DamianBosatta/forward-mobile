import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, Keyboard,
  ActivityIndicator, Modal, KeyboardAvoidingView,
  Platform, Pressable, ScrollView,
} from 'react-native'
import { X, Save, Eye, EyeOff, Settings2 } from 'lucide-react-native'
import { useColors, useIsDark } from '@/libs/theme'
import { useAjustarStock, useToggleProductoStatus } from '@/libs/api-client'
import type { StockItem } from '@/libs/api-client/types'
import * as Haptics from 'expo-haptics'
import { safeHaptics } from '@/core/utils/haptics'
import { PremiumInput } from '@/core/ui'
import { LinearGradient } from 'expo-linear-gradient'
import { MotiView } from 'moti'
import { BlurView } from 'expo-blur'

export type StockActionMode = 'adjust' | 'status'

interface StockActionModalProps {
  visible: boolean
  mode: StockActionMode | null
  item: StockItem | null
  onClose: () => void
  onSuccess: (title: string, message: string) => void
  onError: (message: string) => void
}

const QUICK_AMOUNTS = [-10, -5, -1, +1, +5, +10]

export function StockActionModal({
  visible, mode, item, onClose, onSuccess, onError
}: StockActionModalProps) {
  const colors = useColors()
  const isDark = useIsDark()

  const [cantidad, setCantidad] = useState('')
  const [observacion, setObservacion] = useState('')
  const [observacionError, setObservacionError] = useState('')

  const { mutateAsync: ajustar, isPending: isAdjusting } = useAjustarStock()
  const { mutateAsync: toggleStatus, isPending: isToggling } = useToggleProductoStatus()

  const handleClose = () => {
    setCantidad('')
    setObservacion('')
    setObservacionError('')
    Keyboard.dismiss()
    onClose()
  }

  const handleAdjust = async () => {
    if (!item || !cantidad) return
    const num = parseFloat(cantidad)
    if (isNaN(num) || num === 0) {
      onError('Ingrese un número válido distinto de cero')
      return
    }
    const observacionTrimmed = observacion.trim()
    if (!observacionTrimmed || observacionTrimmed.length < 3) {
      setObservacionError('El motivo es obligatorio (mínimo 3 caracteres).')
      return
    }
    setObservacionError('')
    try {
      await ajustar({
        productoId: item.productoId ?? item.id ?? '',
        depositoId: item.depositoId ?? '',
        cantidad: num,
        tipoMovimiento: 4,
        observacion: observacionTrimmed,
      })
      safeHaptics.notification('success')
      handleClose()
      onSuccess('Stock Ajustado', `Se ${num > 0 ? 'agregaron' : 'retiraron'} ${Math.abs(num)} unidades de ${item.producto ?? ''}`)
    } catch (e: any) {
      onError(e?.message ?? 'No se pudo realizar el ajuste')
    }
  }

  const handleToggleStatus = async () => {
    if (!item) return
    const isCurrentlyActive = item.activo ?? true
    try {
      await toggleStatus({ id: item.productoId ?? item.id ?? '', activo: !isCurrentlyActive })
      safeHaptics.notification('success')
      handleClose()
      onSuccess('Estado Actualizado', `${item.producto ?? ''} fue ${isCurrentlyActive ? 'desactivado' : 'activado'} correctamente`)
    } catch (e: any) {
      onError(e?.message ?? 'No se pudo cambiar el estado')
    }
  }

  if (!item || !mode) return null

  const modeColor = mode === 'adjust'
    ? colors.primary
    : (item.activo ? colors.danger : colors.success)

  const sheetBg = isDark ? '#0a0a0a' : '#ffffff'

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' }}
        onPress={handleClose}
      />

      {/* Bottom Sheet — natively positioned */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
        }}
      >
        <MotiView
          from={{ translateY: 400, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          exit={{ translateY: 400, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 200 }}
        >
          {/* Sheet container — plain View, no GlassCard */}
          <View
            style={{
              backgroundColor: sheetBg,
              borderTopLeftRadius: 36,
              borderTopRightRadius: 36,
              overflow: 'hidden',
              borderTopWidth: 1,
              borderLeftWidth: 1,
              borderRightWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
              paddingBottom: Platform.OS === 'ios' ? 40 : 28,
            }}
          >
            {/* Top glow */}
            <LinearGradient
              colors={[modeColor + '28', 'transparent']}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 110 }}
            />

            {/* Handle */}
            <View style={{ alignItems: 'center', paddingTop: 14, paddingBottom: 4 }}>
              <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)' }} />
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 24, gap: 0 }}
            >
              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{
                    width: 48, height: 48, borderRadius: 16,
                    backgroundColor: modeColor + '18',
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1, borderColor: modeColor + '35',
                  }}>
                    {mode === 'adjust'
                      ? <Settings2 size={24} color={colors.primary} />
                      : item.activo
                        ? <EyeOff size={24} color={colors.danger} />
                        : <Eye size={24} color={colors.success} />
                    }
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 20, fontWeight: '900', color: isDark ? '#FFFFFF' : '#0f172a', letterSpacing: -0.5, fontFamily: 'Outfit_900Black' }}>
                      {mode === 'adjust' ? 'Ajuste de Stock' : 'Cambiar Estado'}
                    </Text>
                    <Text style={{ fontSize: 11, color: isDark ? '#808080' : '#94a3b8', marginTop: 1, fontFamily: 'Outfit_700Bold' }} numberOfLines={1}>
                      {(item.producto ?? '').toUpperCase()}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleClose}
                  style={{
                    width: 40, height: 40, borderRadius: 12,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <X size={20} color={isDark ? '#FFFFFF' : '#0f172a'} />
                </TouchableOpacity>
              </View>

              {/* ── ADJUST MODE ── */}
              {mode === 'adjust' ? (
                <View style={{ gap: 20 }}>
                  {/* 4-metric panel */}
                  <View style={{
                    flexDirection: 'row', gap: 8,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                    padding: 16, borderRadius: 22,
                    borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                  }}>
                    {[
                      { label: 'ACTUAL',    value: item.cantidadActual,      color: isDark ? '#ffffff' : '#0f172a' },
                      { label: 'VIRTUAL',   value: item.cantidadVirtual,     color: colors.info },
                      { label: 'RESERVADO', value: item.cantidadReservada,   color: colors.warning },
                      { label: 'DISPON.',   value: item.cantidadDisponible ?? 0, color: colors.success },
                    ].map(m => (
                      <View key={m.label} style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ fontSize: 7, color: isDark ? '#525252' : '#94a3b8', fontFamily: 'Outfit_900Black', letterSpacing: 0.5, marginBottom: 3 }}>{m.label}</Text>
                        <Text style={{ fontSize: 20, color: m.color, fontFamily: 'Outfit_900Black' }}>{m.value}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Quick buttons */}
                  <View>
                    <Text style={{ fontSize: 9, color: isDark ? '#525252' : '#94a3b8', fontFamily: 'Outfit_900Black', letterSpacing: 1.2, marginBottom: 10 }}>
                      AJUSTE RÁPIDO
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {QUICK_AMOUNTS.map(n => (
                        <TouchableOpacity
                          key={n}
                          onPress={() => {
                            Haptics.selectionAsync()
                            const current = parseFloat(cantidad) || 0
                            setCantidad(String(current + n))
                          }}
                          style={{
                            flex: 1,
                            paddingVertical: 11,
                            borderRadius: 14,
                            alignItems: 'center',
                            backgroundColor: n < 0 ? colors.danger + '12' : colors.success + '12',
                            borderWidth: 1,
                            borderColor: n < 0 ? colors.danger + '30' : colors.success + '30',
                          }}
                        >
                          <Text style={{
                            fontSize: 13, fontFamily: 'Outfit_900Black',
                            color: n < 0 ? colors.danger : colors.success,
                          }}>
                            {n > 0 ? '+' : ''}{n}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <PremiumInput
                    label="Cantidad exacta"
                    placeholder="Ej: 10 o -5"
                    keyboardType="numeric"
                    value={cantidad}
                    onChangeText={setCantidad}
                  />

                  <PremiumInput
                    label="Motivo / Observación *"
                    placeholder="Indique el motivo (mínimo 3 caracteres)..."
                    multiline
                    numberOfLines={3}
                    value={observacion}
                    onChangeText={(text) => {
                      setObservacion(text)
                      if (observacionError) setObservacionError('')
                    }}
                    containerStyle={{ minHeight: 90 }}
                  />
                  {!!observacionError && (
                    <Text style={{ fontSize: 12, color: colors.danger, marginTop: -8, fontFamily: 'Outfit_500Medium' }}>
                      {observacionError}
                    </Text>
                  )}

                  <TouchableOpacity
                    onPress={handleAdjust}
                    disabled={isAdjusting || !cantidad || observacion.trim().length < 3}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={[colors.primary, '#008c7a']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        padding: 18, borderRadius: 20,
                        flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
                        opacity: isAdjusting || !cantidad || observacion.trim().length < 3 ? 0.5 : 1,
                        shadowColor: colors.primary,
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.35,
                        shadowRadius: 14,
                      }}
                    >
                      {isAdjusting ? <ActivityIndicator color="#000" /> : <Save size={20} color="#000" />}
                      <Text style={{ color: '#000', fontWeight: '900', fontSize: 16, letterSpacing: 0.5, fontFamily: 'Outfit_900Black' }}>
                        CONFIRMAR AJUSTE
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

              ) : (
                /* ── STATUS MODE ── */
                <View style={{ gap: 28 }}>
                  <View style={{ alignItems: 'center', gap: 20 }}>
                    <View style={{
                      width: 100, height: 100, borderRadius: 50,
                      backgroundColor: item.activo ? colors.danger + '15' : colors.success + '15',
                      alignItems: 'center', justifyContent: 'center',
                      borderWidth: 1.5, borderColor: item.activo ? colors.danger + '40' : colors.success + '40',
                    }}>
                      {item.activo
                        ? <EyeOff size={48} color={colors.danger} />
                        : <Eye size={48} color={colors.success} />
                      }
                    </View>
                    <View style={{ alignItems: 'center', paddingHorizontal: 16 }}>
                      <Text style={{ fontSize: 22, fontWeight: '900', color: isDark ? '#FFFFFF' : '#0f172a', textAlign: 'center', fontFamily: 'Outfit_900Black' }}>
                        ¿{item.activo ? 'Desactivar' : 'Activar'} Producto?
                      </Text>
                      <Text style={{ fontSize: 14, color: isDark ? '#808080' : '#64748b', textAlign: 'center', marginTop: 10, lineHeight: 22, fontFamily: 'Outfit_500Medium' }}>
                        {item.activo
                          ? 'El producto no podrá ser seleccionado en nuevas operaciones comerciales.'
                          : 'El producto volverá a estar disponible para todas las operaciones.'}
                      </Text>
                    </View>
                  </View>

                  <View style={{ gap: 12 }}>
                    <TouchableOpacity onPress={handleToggleStatus} disabled={isToggling} activeOpacity={0.8}>
                      <LinearGradient
                        colors={item.activo ? [colors.danger, '#991b1b'] : [colors.success, '#166534']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                          padding: 18, borderRadius: 20, alignItems: 'center',
                          opacity: isToggling ? 0.5 : 1,
                          shadowColor: item.activo ? colors.danger : colors.success,
                          shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 14,
                        }}
                      >
                        {isToggling
                          ? <ActivityIndicator color="#fff" />
                          : <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, fontFamily: 'Outfit_900Black', letterSpacing: 0.5 }}>
                              {item.activo ? 'SÍ, DESACTIVAR' : 'SÍ, ACTIVAR'}
                            </Text>
                        }
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleClose} activeOpacity={0.7} style={{ padding: 16, alignItems: 'center' }}>
                      <Text style={{ color: isDark ? '#808080' : '#64748b', fontWeight: '800', fontSize: 14, fontFamily: 'Outfit_700Bold' }}>CANCELAR</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </MotiView>
      </KeyboardAvoidingView>
    </Modal>
  )
}
