import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { formatImporte } from '@/core/ui/fw'
import { EstadoDePantalla } from '@/core/ui/fw/EstadoDePantalla'
import type { EventoCalendario } from '@/libs/api-client/calendario'
import { horaDeEvento, resumenDeEvento } from './resumen'
import { depositoDe } from './tarea'
import { tituloDia } from './semana'
import { PuntoDeEstado } from './PuntoDeEstado'

interface Props {
  /** Los días (YYYY-MM-DD) a recorrer, en orden. Los que no tienen eventos no se muestran. */
  dias: string[]
  hoy: string
  porDia: Map<string, EventoCalendario[]>
  onAbrir: (e: EventoCalendario) => void
  /** "Calendario diario" o "Agenda". */
  etiqueta: string
}

/** Los eventos de uno o varios días en renglones (la web, `ListaDeEventos`): sirve para la vista Día y para la Agenda. */
export function ListaDeEventos({ dias, hoy, porDia, onAbrir, etiqueta }: Props) {
  const c = useColors()
  const conEventos = dias.filter((d) => (porDia.get(d)?.length ?? 0) > 0)
  if (conEventos.length === 0) {
    return <EstadoDePantalla tipo="vacio" titulo="No hay eventos con estos filtros." />
  }
  return (
    <View accessibilityLabel={etiqueta} style={{ gap: space[4] }}>
      {conEventos.map((d) => (
        <View key={d} testID={`dia-${d}`} style={{ gap: space[2] }}>
          <Text accessibilityRole="header" style={{ ...typeScale.cuerpoDestacado, color: c.text }}>
            {tituloDia(d)}
            {d === hoy ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}> (hoy)</Text> : null}
          </Text>
          {(porDia.get(d) ?? []).map((e) => {
            const r = resumenDeEvento(e)
            return (
              <Pressable
                key={e.clave}
                onPress={() => onAbrir(e)}
                accessibilityRole="button"
                accessibilityLabel={`${e.titulo}, ${r.estado}`}
                accessibilityHint="Abre el detalle del evento"
                android_ripple={{ color: c.surface2 }}
                style={{ minHeight: 44, flexDirection: 'row', alignItems: 'flex-start', gap: space[3], padding: space[3], backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderStrong, borderRadius: radii.campo, overflow: 'hidden' }}
              >
                <Text style={{ ...typeScale.secundario, ...importe, color: c.textSecondary, width: 44 }}>{horaDeEvento(e)}</Text>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={{ ...typeScale.cuerpoDestacado, color: r.tachado ? c.textSecondary : c.text, textDecorationLine: r.tachado ? 'line-through' : 'none' }}>{e.titulo}</Text>
                  <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{r.para ? `${r.tipo} · Para ${r.para}` : r.tipo}</Text>
                  <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{depositoDe(e)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: space[1] }}>
                  {e.monto != null ? <Text style={{ ...typeScale.secundario, ...importe, color: c.text }}>{formatImporte(e.monto)}</Text> : null}
                  <PuntoDeEstado tono={r.tono} texto={r.estado} />
                </View>
              </Pressable>
            )
          })}
        </View>
      ))}
    </View>
  )
}
