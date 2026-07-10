import React from 'react'
import { View, Text } from 'react-native'
import { MotiView } from 'moti'
import { LinearGradient } from 'expo-linear-gradient'
import { Navigation, Flag, MapPin } from 'lucide-react-native'
import { useColors, BRAND } from '@/libs/theme'
import { EstadoHojaRuta } from '@/libs/api-client/types'

interface DriverCoachBannerProps {
  /** Driver first name — the console always addresses them personally. */
  firstName: string
  estado?: EstadoHojaRuta
  total: number
  pendingCount: number
  nextStopName?: string | null
}

/**
 * Personalized coaching banner for the driver console. It speaks to the driver by
 * name and adapts the message to the route state so the console feels like a
 * co-pilot guiding the day, not a static dashboard.
 */
export function DriverCoachBanner({ firstName, estado, total, pendingCount, nextStopName }: DriverCoachBannerProps) {
  const colors = useColors()
  const name = (firstName || 'Chofer').trim()
  const allDone = total > 0 && pendingCount === 0

  let eyebrow: string
  let message: string
  let accent = colors.primary
  let Icon = Navigation

  if (estado === EstadoHojaRuta.Programada) {
    const word = total === 1 ? 'parada' : 'paradas'
    eyebrow = 'RUTA LISTA'
    message = `${name}, tu ruta está lista con ${total} ${word} para hoy. Tocá “Iniciar recorrido” para arrancar.`
    accent = BRAND.blue
    Icon = MapPin
  } else if (allDone) {
    eyebrow = '¡ÚLTIMO ENTREGADO!'
    message = `${name}, entregaste el último pedido. Recordá finalizar la ruta para cerrar el día.`
    accent = BRAND.green
    Icon = Flag
  } else if (pendingCount === 1 && nextStopName) {
    eyebrow = 'ÚLTIMA PARADA'
    message = `${name}, te queda 1 sola parada: ${nextStopName}. ¡La última, dale!`
    accent = colors.primary
    Icon = Navigation
  } else if (nextStopName) {
    eyebrow = 'EN RUTA'
    message = `${name}, tu próxima parada es ${nextStopName}. Te quedan ${pendingCount} paradas por entregar.`
    accent = colors.primary
    Icon = Navigation
  } else {
    eyebrow = 'EN RUTA'
    message = `${name}, ¡a la ruta!`
  }

  return (
    <MotiView
      from={{ opacity: 0, translateY: -10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 450 }}
      style={{ marginBottom: 20 }}
    >
      <View style={{ borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: accent + '40', backgroundColor: colors.surface }}>
        <LinearGradient
          colors={[accent + '1F', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
          <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: accent + '22', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={22} color={accent} strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: accent, marginBottom: 3 }}>{eyebrow}</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, lineHeight: 19 }}>{message}</Text>
          </View>
        </View>
      </View>
    </MotiView>
  )
}
