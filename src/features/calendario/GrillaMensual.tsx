import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import type { EventoCalendario } from '@/libs/api-client/calendario'
import { tituloDia, type MesGrilla } from './semana'
import type { MarcaDeEntregas } from './entregas'
import { resumenDeEvento } from './resumen'

/** Cuántos eventos caben en una celda antes de resumir el resto en "+N más" (la web, `MAX_POR_CELDA`). */
const MAX_POR_CELDA = 3
const ENCABEZADO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const textoEventos = (n: number) => `${n} ${n === 1 ? 'evento' : 'eventos'}`

interface Props {
  mes: MesGrilla
  hoy: string
  porDia: Map<string, EventoCalendario[]>
  /** Tocar un día abre la semana de ese día, como la web. */
  onElegirDia: (fecha: string) => void
  entregas: ((fecha: string) => MarcaDeEntregas) | null
}

/**
 * El mes de lunes a domingo (la web, `GrillaMensual`, adaptada al teléfono): en vez del chip con título, cada evento
 * es una marca con el color de su estado (hasta 3) y "+N más". El estado se lee en la semana, al tocar el día.
 */
export function GrillaMensual({ mes, hoy, porDia, onElegirDia, entregas }: Props) {
  const c = useColors()
  return (
    <View accessibilityLabel="Calendario mensual" style={{ borderWidth: 1, borderColor: c.border, borderRadius: radii.campo, overflow: 'hidden', backgroundColor: c.border, gap: 1 }}>
      <View style={{ flexDirection: 'row', gap: 1 }}>
        {ENCABEZADO.map((n) => (
          <Text key={n} style={{ flex: 1, textAlign: 'center', ...typeScale.etiqueta, color: c.textSecondary, backgroundColor: c.surface2, paddingVertical: space[1] + 2 }}>{n}</Text>
        ))}
      </View>
      {mes.semanas.map((semana) => (
        <View key={semana[0].fecha} style={{ flexDirection: 'row', gap: 1 }}>
          {semana.map((d) => {
            const delDia = porDia.get(d.fecha) ?? []
            const marca = entregas?.(d.fecha)
            const esHoy = d.fecha === hoy
            return (
              <Pressable
                key={d.fecha}
                testID={`celda-${d.fecha}`}
                onPress={() => onElegirDia(d.fecha)}
                accessibilityRole="button"
                accessibilityLabel={`Ver la semana del ${tituloDia(d.fecha).toLowerCase()}, ${textoEventos(delDia.length)}${marca?.feriado ? `, ${marca.feriado}` : ''}`}
                android_ripple={{ color: c.surface2 }}
                style={{ flex: 1, minWidth: 0, minHeight: 64, padding: 3, gap: 3, backgroundColor: marca?.sinEntregas ? c.surface2 : c.surface, opacity: d.delMes ? 1 : 0.5 }}
              >
                <View style={{ width: 24, height: 24, borderRadius: radii.pastilla, alignItems: 'center', justifyContent: 'center', backgroundColor: esHoy ? c.action : 'transparent' }}>
                  <Text style={{ ...typeScale.etiqueta, color: esHoy ? c.onAction : c.text }}>{d.numero}</Text>
                </View>
                {marca?.feriado ? <Text numberOfLines={1} style={{ ...typeScale.etiqueta, color: c.textSecondary }}>Feriado</Text> : null}
                {delDia.slice(0, MAX_POR_CELDA).map((e) => (
                  <View key={e.clave} testID="marca" style={{ height: 6, borderRadius: radii.pastilla, backgroundColor: c[resumenDeEvento(e).tono] }} />
                ))}
                {delDia.length > MAX_POR_CELDA ? (
                  <Text numberOfLines={1} style={{ ...typeScale.etiqueta, color: c.textSecondary }}>{`+${delDia.length - MAX_POR_CELDA} más`}</Text>
                ) : null}
              </Pressable>
            )
          })}
        </View>
      ))}
    </View>
  )
}
