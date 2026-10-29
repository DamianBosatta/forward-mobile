import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { MotiView } from 'moti'
import { ChevronRight, MapPin, Truck } from 'lucide-react-native'
import { GlassCard } from '@/core/ui'
import { useColors, BRAND } from '@/libs/theme'
import type { HojaRutaListItemDto } from '@/libs/api-client/types'
import type { EstadoHojaRutaNombre } from '@/core/constants/estados'
import { resolverEstadoHojaRuta } from '@/libs/reglas/estados'

const FlashListCast = FlashList as any

// The driver picker is fed by GET /hojas-ruta (list shape: HojaRutaListItemDto with
// cantidadParadas, no detalles array).
interface RouteSelectorProps {
  routes: HojaRutaListItemDto[]
  onSelect: (id: string) => void
}

/** Etiqueta y color de cada estado en el selector de rutas (exhaustivo por nombre del enum). */
const ESTADO_SELECTOR = {
  Programada: { label: 'PROGRAMADA', color: (_p: string) => BRAND.orange },
  Documentada: { label: 'DOCUMENTADA', color: (_p: string) => BRAND.blue },
  EnCurso: { label: 'EN RUTA', color: (p: string) => p },
  Finalizada: { label: 'FINALIZADA', color: (_p: string) => BRAND.green },
  Cancelada: { label: 'CANCELADA', color: (_p: string) => BRAND.red },
} satisfies Record<EstadoHojaRutaNombre, { label: string; color: (primary: string) => string }>

export function estatoLabel(estado: number | undefined): string {
  const r = resolverEstadoHojaRuta(estado)
  return r ? ESTADO_SELECTOR[r.nombre].label : 'DESCONOCIDO'
}

export function estadoColor(estado: number | undefined, primary: string): string {
  const r = resolverEstadoHojaRuta(estado)
  return r ? ESTADO_SELECTOR[r.nombre].color(primary) : BRAND.orange
}

/**
 * RouteSelector — displays a list of today's hojas de ruta for the driver to pick from.
 * Rendered only when the driver has more than one route today.
 */
export function RouteSelector({ routes, onSelect }: RouteSelectorProps) {
  const colors = useColors()

  return (
    <View style={{ flex: 1 }}>
      <MotiView
        from={{ opacity: 0, translateY: -10 }}
        animate={{ opacity: 1, translateY: 0 }}
        style={{ paddingHorizontal: 20, paddingBottom: 12 }}
      >
        <Text style={{ fontSize: 12, fontWeight: '900', color: colors.primary, letterSpacing: 2 }}>
          DRIVER CONSOLE
        </Text>
        <Text style={{ fontSize: 28, fontWeight: '900', color: colors.text }}>
          Seleccioná tu viaje
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>
          Tenés {routes.length} rutas para hoy
        </Text>
      </MotiView>

      <FlashListCast
        data={routes}
        keyExtractor={(item: HojaRutaListItemDto) => item.id}
        estimatedItemSize={100}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item, index }: { item: HojaRutaListItemDto; index: number }) => {
          const stopCount = item.cantidadParadas
          const color = estadoColor(item.estado, colors.primary)

          return (
            <MotiView
              from={{ opacity: 0, translateX: -20 }}
              animate={{ opacity: 1, translateX: 0 }}
              transition={{ delay: index * 80 }}
              style={{ marginBottom: 12 }}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => onSelect(item.id)}
              >
                <GlassCard style={{ padding: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <Truck size={18} color={color} />
                        <Text style={{ fontSize: 16, fontWeight: '900', color: colors.text }}>
                          Viaje #{item.id.substring(0, 8).toUpperCase()}
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <MapPin size={14} color={colors.textSecondary} />
                        <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                          {`${stopCount} ${stopCount === 1 ? 'entrega' : 'entregas'}`}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{
                        backgroundColor: color + '20',
                        paddingHorizontal: 10, paddingVertical: 6,
                        borderRadius: 10,
                        borderWidth: 1, borderColor: color,
                      }}>
                        <Text style={{ fontSize: 11, fontWeight: '900', color }}>
                          {estatoLabel(item.estado)}
                        </Text>
                      </View>
                      <ChevronRight size={20} color={colors.textMuted} />
                    </View>
                  </View>
                </GlassCard>
              </TouchableOpacity>
            </MotiView>
          )
        }}
      />
    </View>
  )
}
