import React from 'react'
import { View, Text } from 'react-native'
import { CheckCircle2, XCircle, Package } from 'lucide-react-native'
import { MotiView } from 'moti'
import { GlassCard } from '@/core/ui'
import { useColors, BRAND } from '@/libs/theme'
import { EstadoParada } from '@/libs/api-client/types'

// Local extension of ParadaDto that includes mutable delivery state
// (mirrors the ParadaConEstado in logistica.store.ts).
interface ParadaConEstado {
  id?: string
  clienteNombre?: string | null
  direccion?: string | null
  estado?: number
  motivoRechazo?: string | null
}

interface FinalizedTripSummaryProps {
  detalles: ParadaConEstado[]
}

/**
 * FinalizedTripSummary — renders a per-stop result list for a completed route.
 * Shown in place of the active FlashList when estado === Finalizada.
 */
export function FinalizedTripSummary({ detalles }: FinalizedTripSummaryProps) {
  const colors = useColors()

  const delivered  = detalles.filter(d => d.estado === EstadoParada.Entregado).length
  const failed     = detalles.filter(d => d.estado !== EstadoParada.Entregado && d.estado !== EstadoParada.Pendiente).length

  if (detalles.length === 0) {
    return (
      <GlassCard style={{ padding: 32, alignItems: 'center', margin: 16 }}>
        <Package size={40} color={colors.textDisabled} />
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textMuted, marginTop: 16, textAlign: 'center' }}>
          No se reportaron paradas
        </Text>
      </GlassCard>
    )
  }

  return (
    <View style={{ paddingHorizontal: 16 }}>
      {/* Summary counters */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
        <View style={{ flex: 1, backgroundColor: BRAND.green + '15', padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: BRAND.green + '40' }}>
          <CheckCircle2 size={22} color={BRAND.green} />
          <Text style={{ fontSize: 24, fontWeight: '900', color: BRAND.green, marginTop: 6 }}>{delivered}</Text>
          <Text style={{ fontSize: 11, fontWeight: '800', color: BRAND.green, opacity: 0.8 }}>ENTREGADAS</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: BRAND.red + '15', padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: BRAND.red + '40' }}>
          <XCircle size={22} color={BRAND.red} />
          <Text style={{ fontSize: 24, fontWeight: '900', color: BRAND.red, marginTop: 6 }}>{failed}</Text>
          <Text style={{ fontSize: 11, fontWeight: '800', color: BRAND.red, opacity: 0.8 }}>NO ENTREGADAS</Text>
        </View>
      </View>

      <Text style={{ fontSize: 12, fontWeight: '900', color: colors.textSecondary, letterSpacing: 1.5, marginBottom: 12 }}>
        DETALLE POR PARADA
      </Text>

      {detalles.map((parada, index) => {
        const isDelivered = parada.estado === EstadoParada.Entregado
        const isPending   = parada.estado === EstadoParada.Pendiente
        const statusColor = isDelivered ? BRAND.green : isPending ? colors.textDisabled : BRAND.red
        const estadoLabel = isDelivered ? 'Entregada' : isPending ? 'Pendiente' : 'No Entregada'

        return (
          <MotiView
            key={parada.id ?? String(index)}
            from={{ opacity: 0, translateX: -16 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ delay: index * 60 }}
            style={{ marginBottom: 10 }}
          >
            <GlassCard style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>
                    {parada.clienteNombre ?? '—'}
                  </Text>
                  {parada.direccion ? (
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                      {parada.direccion}
                    </Text>
                  ) : null}
                  {!isDelivered && !isPending && parada.motivoRechazo ? (
                    <Text style={{ fontSize: 12, color: BRAND.red, marginTop: 4, fontStyle: 'italic' }}>
                      Motivo: {parada.motivoRechazo}
                    </Text>
                  ) : null}
                </View>

                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  backgroundColor: statusColor + '20',
                  paddingHorizontal: 10, paddingVertical: 6,
                  borderRadius: 10, borderWidth: 1, borderColor: statusColor + '60',
                  marginLeft: 12,
                }}>
                  {isDelivered
                    ? <CheckCircle2 size={14} color={statusColor} />
                    : <XCircle size={14} color={statusColor} />
                  }
                  <Text style={{ fontSize: 11, fontWeight: '900', color: statusColor }}>
                    {estadoLabel.toUpperCase()}
                  </Text>
                </View>
              </View>
            </GlassCard>
          </MotiView>
        )
      })}
    </View>
  )
}
