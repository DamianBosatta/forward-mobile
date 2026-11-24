import React from 'react'
import { Text, View } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import type { EventoCalendario } from '@/libs/api-client/calendario'
import { cabeceraDeDia, tituloDia, type DiaSemana } from './semana'
import type { MarcaDeEntregas } from './entregas'
import { TarjetaDeEvento } from './TarjetaDeEvento'

interface Props {
  dias: DiaSemana[]
  hoy: string
  porDia: Map<string, EventoCalendario[]>
  onAbrir: (e: EventoCalendario) => void
  /** Si llegó la configuración de entregas: qué días no hay entregas y cuáles son feriado. */
  entregas: ((fecha: string) => MarcaDeEntregas) | null
  /** Dónde queda hoy dentro de la lista, para pararla ahí al abrir. */
  onHoyMedido?: (y: number) => void
}

/**
 * La semana de lunes a domingo: un día debajo del otro como la web en teléfono (`VistaSemanal`) y, en tablet horizontal,
 * una grilla de siete columnas (MB-21: entra sin desplazar para ver el domingo).
 */
export function VistaSemanal({ dias, hoy, porDia, onAbrir, entregas, onHoyMedido }: Props) {
  const c = useColors()
  const { isTabletLandscape } = useResponsive()
  return (
    <View accessibilityLabel="Calendario semanal" style={isTabletLandscape ? { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] } : { gap: space[2] }}>
      {dias.map((d) => {
        const delDia = porDia.get(d.fecha) ?? []
        const marca = entregas?.(d.fecha)
        const esHoy = d.fecha === hoy
        const tinta = esHoy ? c.ink : c.text
        return (
          <View
            key={d.fecha}
            testID={`dia-${d.fecha}`}
            accessibilityLabel={tituloDia(d.fecha)}
            onLayout={esHoy && onHoyMedido ? (ev) => onHoyMedido(ev.nativeEvent.layout.y) : undefined}
            style={{ backgroundColor: c.surfaceAlt, borderRadius: radii.tile, padding: space[3], gap: space[2], opacity: marca?.sinEntregas ? 0.8 : 1, ...(isTabletLandscape ? { flex: 1, minWidth: 0 } : null) }}
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: space[1] + 2, paddingHorizontal: space[2], borderRadius: radii.fila, backgroundColor: esHoy ? c.lime : 'transparent' }}>
              <Text accessibilityRole="header" style={{ ...typeScale.cuerpoDestacado, color: tinta }}>{cabeceraDeDia(d)}</Text>
              {esHoy ? <Text style={{ ...typeScale.etiqueta, color: tinta }}>Hoy</Text> : null}
            </View>
            {/* MB-14: la marca del día va en el cuerpo, con el mismo texto y espaciado que "Sin eventos", no pegada a la cabecera. */}
            {marca?.feriado || marca?.sinEntregas ? (
              <Text style={{ ...typeScale.secundario, color: c.textSecondary, paddingHorizontal: space[2] }}>{marca.feriado ?? 'Sin entregas'}</Text>
            ) : null}
            {delDia.length === 0 ? (
              <Text style={{ ...typeScale.secundario, color: c.textSecondary, paddingHorizontal: space[2] }}>Sin eventos</Text>
            ) : (
              delDia.map((e) => <TarjetaDeEvento key={e.clave} evento={e} onPress={() => onAbrir(e)} />)
            )}
          </View>
        )
      })}
    </View>
  )
}
