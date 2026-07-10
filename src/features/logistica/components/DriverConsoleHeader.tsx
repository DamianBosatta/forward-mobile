import React from 'react'
import { View, Text, TouchableOpacity, Linking } from 'react-native'
import { MotiView, AnimatePresence } from 'moti'
import { LinearGradient } from 'expo-linear-gradient'
import { Navigation, MapPin, PackageCheck, Phone, Package } from 'lucide-react-native'
import { GlassCard } from '@/core/ui'
import { useColors, tokens, BRAND } from '@/libs/theme'
import { EstadoHojaRuta, EstadoParada } from '@/libs/api-client/types'
import { DriverCoachBanner } from './DriverCoachBanner'

interface DriverConsoleHeaderProps {
  estado?: EstadoHojaRuta
  detalles: any[]
  firstName: string
  isReadOnly: boolean
  onSelectStop: (stop: any) => void
  onVerPedido: (stop: any) => void
  onNavigate: (lat: number, lng: number, address: string) => void
}

/**
 * FlashList header for the driver console: the personalized coach banner plus, when the route
 * is EnCurso, the "PRÓXIMA PARADA" focus card. Memoized + rendered through a stable useCallback
 * in the parent so it does NOT remount (and re-fire its entrance animation) on every unrelated
 * re-render of the console — only when the route data actually changes.
 */
function DriverConsoleHeaderComponent({
  estado,
  detalles,
  firstName,
  isReadOnly,
  onSelectStop,
  onVerPedido,
  onNavigate,
}: DriverConsoleHeaderProps) {
  const colors = useColors()
  const nextStop = detalles.find((d) => d.estado === EstadoParada.Pendiente)
  const pendingCount = detalles.filter((d) => d.estado === EstadoParada.Pendiente).length

  return (
    <>
      <DriverCoachBanner
        firstName={firstName}
        estado={estado}
        total={detalles.length}
        pendingCount={pendingCount}
        nextStopName={nextStop?.clienteNombre}
      />
      <AnimatePresence>
        {estado === EstadoHojaRuta.EnCurso && nextStop && (
          <MotiView
            from={{ opacity: 0, scale: 0.9, translateY: -20 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{ marginBottom: 24 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12, marginLeft: 4 }}>
              <Navigation size={13} color={colors.primary} strokeWidth={3} />
              <Text style={{ fontSize: 13, fontWeight: '900', letterSpacing: 1.2, color: colors.primary }}>PRÓXIMA PARADA</Text>
            </View>
            <TouchableOpacity activeOpacity={0.9} onPress={() => !isReadOnly && onSelectStop(nextStop)}>
              <GlassCard style={{ padding: 0, borderColor: colors.primary, borderWidth: 2, overflow: 'hidden', ...tokens.shadows.premium }}>
                <LinearGradient
                  colors={[colors.primary + '22', 'transparent']}
                  start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                />
                <View style={{ padding: 20 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
                      <LinearGradient
                        colors={[colors.primary, BRAND.lime]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <MapPin size={22} color="#fff" strokeWidth={2.5} />
                      </LinearGradient>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 21, fontWeight: '900', color: colors.text }} numberOfLines={1}>{nextStop.clienteNombre}</Text>
                        <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>{nextStop.direccion}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => onNavigate(nextStop.latitud ?? 0, nextStop.longitud ?? 0, nextStop.direccion ?? '')}
                      style={{ backgroundColor: colors.primary, width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginLeft: 8, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 }}
                    >
                      <Navigation size={24} color="#fff" strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>

                  <View style={{ flexDirection: 'row', marginTop: 20, gap: 12 }}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface2, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14 }}>
                      <PackageCheck size={22} color={colors.primary} />
                      <View>
                        <Text style={{ fontSize: 10, fontWeight: '900', letterSpacing: 0.5, color: colors.textMuted }}>BULTOS</Text>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text }}>{nextStop.cantidadBultos}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => Linking.openURL(`tel:${nextStop.telefono || ''}`)}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface2, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14 }}
                    >
                      <Phone size={22} color={BRAND.blue} />
                      <View>
                        <Text style={{ fontSize: 10, fontWeight: '900', letterSpacing: 0.5, color: colors.textMuted }}>LLAMAR</Text>
                        <Text style={{ fontSize: 14, fontWeight: '900', color: colors.text }}>CLIENTE</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    onPress={() => onVerPedido(nextStop)}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, paddingVertical: 13, borderRadius: 14, borderWidth: 1.5, borderColor: colors.primary + '55' }}
                  >
                    <Package size={18} color={colors.primary} />
                    <Text style={{ fontSize: 13, fontWeight: '900', letterSpacing: 0.5, color: colors.primary }}>VER PEDIDO</Text>
                  </TouchableOpacity>
                </View>
              </GlassCard>
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: colors.border, marginTop: 24, marginHorizontal: 20 }} />
          </MotiView>
        )}
      </AnimatePresence>
    </>
  )
}

export const DriverConsoleHeader = React.memo(DriverConsoleHeaderComponent)
