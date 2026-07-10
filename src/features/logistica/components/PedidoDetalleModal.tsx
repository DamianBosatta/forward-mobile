import React from 'react'
import { View, Text, Modal, TouchableOpacity, ScrollView, Platform, StyleSheet, ActivityIndicator } from 'react-native'
import { useColors } from '@/libs/theme'
import { X, Package, PackageCheck, AlertCircle } from 'lucide-react-native'
import Animated, { FadeIn, FadeOut, SlideInDown } from 'react-native-reanimated'
import { useVenta } from '@/libs/api-client'

interface PedidoDetalleModalProps {
  ventaId: string | null
  clienteNombre?: string
  isVisible: boolean
  onClose: () => void
}

/**
 * Read-only view of a delivery's order contents (items + bultos) for the driver,
 * so they can check what goes in the package without leaving the console.
 */
export const PedidoDetalleModal = ({ ventaId, clienteNombre, isVisible, onClose }: PedidoDetalleModalProps) => {
  const colors = useColors()
  const { data, isLoading, isError } = useVenta(ventaId ?? '')

  const items = data?.detalles ?? []
  const totalUnidades = items.reduce((acc, it) => acc + (it.cantidad ?? 0), 0)
  const bultos = data?.bultos?.length ?? 0
  const total = data?.venta?.totalAmount

  return (
    <Modal visible={isVisible} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          entering={FadeIn}
          exiting={FadeOut}
          style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' }}
        >
          <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        <Animated.View
          entering={SlideInDown.springify().damping(20)}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            padding: 24,
            paddingBottom: Platform.OS === 'ios' ? 40 : 24,
            maxHeight: '85%'
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '900', color: colors.primary, letterSpacing: 1.2, marginBottom: 4 }}>CONTENIDO DEL PEDIDO</Text>
              <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }} numberOfLines={1}>{clienteNombre || 'Pedido'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ backgroundColor: colors.surface2, padding: 8, borderRadius: 12 }}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={{ paddingVertical: 48, alignItems: 'center' }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : isError ? (
            <View style={{ paddingVertical: 48, alignItems: 'center', gap: 10 }}>
              <AlertCircle size={36} color={colors.danger} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textMuted }}>No se pudo cargar el pedido</Text>
            </View>
          ) : items.length === 0 ? (
            <View style={{ paddingVertical: 48, alignItems: 'center', gap: 10 }}>
              <Package size={36} color={colors.textDisabled} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textMuted }}>El pedido no tiene items</Text>
            </View>
          ) : (
            <>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
                {items.map((it, i) => (
                  <View
                    key={it.id ?? i}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
                      borderBottomWidth: i === items.length - 1 ? 0 : 1, borderBottomColor: colors.border
                    }}
                  >
                    <View style={{ minWidth: 44, height: 38, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.primary + '1A', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 15, fontWeight: '900', color: colors.primary }}>{it.cantidad}x</Text>
                    </View>
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: colors.text }}>{it.productoNombre}</Text>
                  </View>
                ))}
              </ScrollView>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <PackageCheck size={18} color={colors.primary} />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textSecondary }}>
                    {bultos} {bultos === 1 ? 'bulto' : 'bultos'} · {totalUnidades} u.
                  </Text>
                </View>
                {total != null && (
                  <Text style={{ fontSize: 16, fontWeight: '900', color: colors.text }}>
                    $ {Math.round(total).toLocaleString('es-AR')}
                  </Text>
                )}
              </View>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  )
}
