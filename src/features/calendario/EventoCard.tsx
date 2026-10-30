import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { radii, shadowMd, space, typeScale, useColors, useIsDark } from '@/libs/theme'
import { StatusChip, formatImporte } from '@/core/ui/fw'
import type { EventoCalendario } from '@/libs/api-client/calendario'
import { chipDe, TIPO } from './presentacion'

/** Un evento del día (lámina M16): la hora a la izquierda ("Todo el día" sin hora), y en la tarjeta el título con el importe, el estado con su tipo y de dónde se agendó. */
export function EventoCard({ evento: e, onPress }: { evento: EventoCalendario; onPress: () => void }) {
  const c = useColors()
  const sombra = shadowMd[useIsDark() ? 'dark' : 'light']
  const chip = chipDe(e)
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
      <Text style={{ ...typeScale.secundario, color: c.textSecondary, width: 56, textAlign: 'right', paddingTop: space[4] }}>{e.hora || 'Todo el día'}</Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${e.titulo}, ${chip?.label ?? e.estado}`}
        accessibilityHint="Abre el detalle del evento"
        android_ripple={{ color: c.surface2 }}
        style={{ flex: 1, minWidth: 0, backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[4], gap: space[2], overflow: 'hidden', ...sombra }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space[2] }}>
          <Text style={{ ...typeScale.cuerpoDestacado, color: c.text, flex: 1 }}>{e.titulo}</Text>
          {e.monto != null ? <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{formatImporte(e.monto)}</Text> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space[2] }}>
          {chip ? <StatusChip estado={chip.estado} label={chip.label} /> : null}
          <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{TIPO[e.tipo] ?? e.tipo}</Text>
        </View>
        {e.descripcion ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{e.descripcion}</Text> : null}
        {e.ventaCodigo ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`Agendado desde la venta ${e.ventaCodigo}`}</Text> : null}
      </Pressable>
    </View>
  )
}
