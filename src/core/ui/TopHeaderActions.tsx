import React, { useState } from 'react'
import { View, Pressable, Text, Modal, StyleSheet, ScrollView, Platform, useWindowDimensions } from 'react-native'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useThemeStore, useColors } from '@/libs/theme'
import { Sun, Moon, Bell, AlertCircle, ChevronRight, Lock, Clock } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { useVentas } from '@/libs/api-client'
import type { Venta, PagedResult } from '@/libs/api-client/types'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { MotiView } from 'moti'

export function TopHeaderActions() {
  const { mode, setMode } = useThemeStore()
  const { user, canDo, isAdmin } = useAuthStore()
  // The "requiere autorización" badge only matters to users who can see ventas. A chofer (no
  // MOD_VENTAS) would otherwise get a 403 from this poll on every screen header.
  const canSeeVentas = !!(isAdmin?.() || canDo?.('MOD_VENTAS', 'read'))
  const colors = useColors()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width: windowWidth } = useWindowDimensions()
  const [showDropdown, setShowDropdown] = useState(false)

  const toggleTheme = () => {
    setMode(mode === 'dark' ? 'light' : 'dark')
  }

  const getInitials = () => {
    if (user?.nombre && user?.apellido) {
      return `${user.nombre[0]}${user.apellido[0]}`.toUpperCase()
    }
    return user?.username?.substring(0, 2).toUpperCase() || 'U'
  }

  // Poll for pending sales with a reason (authorization required)
  const { data: rawData } = useVentas({ estado: 'PendienteAutorizacion', pageSize: 100 }, { enabled: canSeeVentas })
  const ventasParaAutorizar = ((rawData as { data?: PagedResult<Venta> })?.data?.items ?? (rawData as PagedResult<Venta>)?.items ?? []) as Venta[]
  const hasNotifications = ventasParaAutorizar.length > 0

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {/* Theme Toggle */}
        <Pressable
          onPress={toggleTheme}
          style={{ 
            width: 40, height: 40, borderRadius: 20, 
            backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: colors.border
          }}
        >
          {mode === 'dark' ? <Sun size={20} color={colors.text} /> : <Moon size={20} color={colors.text} />}
        </Pressable>

        {/* Notifications */}
        <Pressable
          onPress={() => {
            if (hasNotifications) {
              setShowDropdown(true)
            }
          }}
          style={{ 
            width: 40, height: 40, borderRadius: 20, 
            backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: colors.border, position: 'relative'
          }}
        >
          <Bell size={20} color={hasNotifications ? colors.danger : colors.text} />
          {hasNotifications && (
            <View style={{
              position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: 7,
              backgroundColor: colors.danger, borderWidth: 2, borderColor: colors.bg,
              alignItems: 'center', justifyContent: 'center'
            }}>
              <Text style={{ color: '#fff', fontSize: 8, fontWeight: 'bold' }} maxFontSizeMultiplier={1.3}>{ventasParaAutorizar.length}</Text>
            </View>
          )}
        </Pressable>

        {/* User Avatar linking to Perfil */}
        <Pressable
          onPress={() => router.push('/(tabs)/perfil')}
          style={{ 
            width: 40, height: 40, borderRadius: 20, 
            backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
            borderWidth: 1.5, borderColor: colors.surface,
            shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3, shadowRadius: 5, elevation: 4
          }}
        >
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 }} maxFontSizeMultiplier={1.3}>
            {getInitials()}
          </Text>
        </Pressable>
      </View>

      {/* Notifications Dropdown Modal */}
      <Modal visible={showDropdown} transparent animationType="none">
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowDropdown(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
        </Pressable>
        
        <MotiView 
          from={{ opacity: 0, scale: 0.95, translateY: -10 }} 
          animate={{ opacity: 1, scale: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 250 }}
          style={{
            position: 'absolute',
            top: insets.top + (Platform.OS === 'ios' ? 60 : 70),
            right: 20,
            width: Math.min(340, windowWidth - 32),
            maxHeight: 450,
            backgroundColor: colors.surface,
            borderRadius: 24,
            padding: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 10,
            borderWidth: 1,
            borderColor: colors.border
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, paddingHorizontal: 4 }}>
            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: `${colors.danger}15`, alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={18} color={colors.danger} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '900', letterSpacing: 0.5 }}>REQUIERE AUTORIZACIÓN</Text>
              <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600' }}>{ventasParaAutorizar.length} pedidos en espera</Text>
            </View>
          </View>

          {/* List */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {ventasParaAutorizar.map((venta: Venta, index: number) => (
              <MotiView key={venta.id} from={{ opacity: 0, translateX: 10 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: index * 50 }}>
                <Pressable
                  onPress={() => {
                    setShowDropdown(false)
                    router.push(`/(tabs)/ventas/${venta.id}`)
                  }}
                  style={({ pressed }) => ({
                    backgroundColor: colors.surface2,
                    borderRadius: 16,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                    transform: [{ scale: pressed ? 0.98 : 1 }]
                  })}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '900', flex: 1, marginRight: 8 }} numberOfLines={1}>
                      {venta.razonSocialCliente ?? 'Cliente'}
                    </Text>
                    <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '900' }}>
                      ${(venta.totalAmount ?? 0).toLocaleString('es-AR')}
                    </Text>
                  </View>
                  
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Clock size={12} color={colors.textDisabled} />
                    <Text style={{ color: colors.textDisabled, fontSize: 10, fontWeight: '800' }}>
                      {new Date(venta.fecha ?? '').toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: `${colors.border}50` }}>
                    <Text style={{ color: colors.danger, fontSize: 11, fontWeight: '700', fontStyle: 'italic', flex: 1 }}>
                      Falta de stock físico
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ color: colors.text, fontSize: 10, fontWeight: '900' }}>REVISAR</Text>
                      <ChevronRight size={14} color={colors.text} strokeWidth={3} />
                    </View>
                  </View>
                </Pressable>
              </MotiView>
            ))}
          </ScrollView>
        </MotiView>
      </Modal>
    </>
  )
}
