import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Banknote, FileText, Package, SquareCheck, type LucideIcon } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { formatImporte } from '@/core/ui/fw'
import type { EventoCalendario } from '@/libs/api-client/calendario'
import { horaDeEvento, resumenDeEvento, type ClaseDeEvento } from './resumen'
import { depositoDe } from './tarea'
import { PuntoDeEstado } from './PuntoDeEstado'

const ICONO: Record<ClaseDeEvento, LucideIcon> = { tarea: SquareCheck, entrega: Package, cobro: Banknote, empresa: FileText }

/** Un evento en un día de la semana (la web, `TarjetaDeEvento`): ícono, hora y tipo, título, "Para …", importe, depósito y estado. */
export function TarjetaDeEvento({ evento: e, onPress }: { evento: EventoCalendario; onPress: () => void }) {
  const c = useColors()
  const r = resumenDeEvento(e)
  const hora = horaDeEvento(e)
  const Icono = ICONO[r.clase]
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${e.titulo}, ${r.estado}`}
      accessibilityHint="Abre el detalle del evento"
      android_ripple={{ color: c.surface2 }}
      style={{ minHeight: 44, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radii.campo, paddingVertical: space[2] + 2, paddingHorizontal: space[3], gap: space[1], overflow: 'hidden' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] + 2 }}>
        <Icono size={16} color={c.textSecondary} />
        <Text style={{ ...typeScale.secundario, ...importe, color: c.textSecondary, flexShrink: 1 }}>{hora ? `${hora} · ${r.tipo}` : r.tipo}</Text>
      </View>
      <Text style={{ ...typeScale.cuerpoDestacado, color: r.tachado ? c.textSecondary : c.text, textDecorationLine: r.tachado ? 'line-through' : 'none' }}>{e.titulo}</Text>
      {r.para ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`Para ${r.para}`}</Text> : null}
      {e.monto != null ? <Text style={{ ...typeScale.secundario, ...importe, color: c.textSecondary }}>{formatImporte(e.monto)}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space[1], marginTop: 2 }}>
        <Text style={{ ...typeScale.etiqueta, color: c.text, borderWidth: 1, borderColor: c.border, borderRadius: radii.campo / 2, paddingHorizontal: space[1] + 2, paddingVertical: 1 }}>{depositoDe(e)}</Text>
        <PuntoDeEstado tono={r.tono} texto={r.estado} />
      </View>
    </Pressable>
  )
}
