import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { MapPin } from 'lucide-react-native'
import { FONT, importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { StatusChip, formatImporte } from '@/core/ui/fw'
import type { ParadaDto } from '@/libs/api-client/types'
import { chipCobro, etiquetaNota, importeParada } from './cobroParada'
import { piezasDeParada } from './piezasParada'

interface Props {
  parada: ParadaDto
  numero: number
  total: number
  puedeLlamar: boolean
  notaCargando: boolean
  onLlamar: () => void
  onVerPedido: () => void
  onNota: () => void
}

/**
 * Lámina chofer-01-viaje: la próxima parada ocupa la pantalla (cliente grande, dirección, piezas y
 * monto) con borde de 3 px. El resto de las acciones del pedido quedan como atajos de 44 px; las
 * principales (Ir, ¡Llegué!) viven en la barra fija de abajo.
 */
export function ParadaGrande({ parada, numero, total, puedeLlamar, notaCargando, onLlamar, onVerPedido, onNota }: Props) {
  const c = useColors()
  const cobro = importeParada(parada)
  const chip = chipCobro(parada)
  const nota = etiquetaNota(parada)
  const piezas = piezasDeParada(parada)
  return (
    <View
      accessibilityLabel="Próxima parada"
      style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, borderWidth: 3, borderColor: c.brandInk, padding: space[4], gap: space[3] }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2], flexWrap: 'wrap' }}>
        <StatusChip estado="enCurso" label={`Parada ${numero} de ${total}`} />
        {chip ? <StatusChip estado={chip.estado} label={chip.label} /> : null}
      </View>
      <View style={{ gap: space[1] }}>
        <Text maxFontSizeMultiplier={1.3} style={{ ...typeScale.titulo, fontSize: 30, lineHeight: 36, color: c.text }}>
          {parada.clienteNombre}
        </Text>
        {/* El cliente se identifica por la dirección: es el punto de entrega. */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}>
          <MapPin size={24} color={c.text} />
          <Text style={{ ...typeScale.cuerpo, fontSize: 21, lineHeight: 28, color: c.text, flex: 1 }}>{parada.direccion}</Text>
        </View>
        {nota ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`Remito ${nota}`}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: space[3] }}>
        <Dato rotulo="Piezas" valor={String(piezas.total)} />
        <Dato rotulo={cobro.aCobrar ? 'A cobrar' : cobro.rotulo} valor={formatImporte(cobro.valor)} crece />
      </View>
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <Atajo label="Llamar" disabled={!puedeLlamar} onPress={onLlamar} />
        <Atajo label="Ver pedido" onPress={onVerPedido} />
        <Atajo label="Nota de entrega" busy={notaCargando} onPress={onNota} />
      </View>
    </View>
  )
}

function Dato({ rotulo, valor, crece }: { rotulo: string; valor: string; crece?: boolean }) {
  const c = useColors()
  return (
    <View style={{ flex: crece ? 1 : undefined, backgroundColor: c.surface2, borderRadius: radii.campo, padding: space[3] }}>
      <Text style={{ ...typeScale.etiqueta, color: c.textSecondary, textTransform: 'uppercase' }}>{rotulo}</Text>
      <Text maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit style={{ ...typeScale.titulo, ...importe, fontSize: 30, lineHeight: 36, color: c.text }}>{valor}</Text>
    </View>
  )
}

function Atajo({ label, onPress, disabled, busy }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean }) {
  const c = useColors()
  const inactivo = disabled || busy
  return (
    <Pressable
      onPress={inactivo ? undefined : onPress}
      disabled={inactivo}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactivo, busy: !!busy }}
      style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[2], borderRadius: radii.campo, borderWidth: 2, borderColor: inactivo ? c.border : c.textSecondary, backgroundColor: c.surface }}
    >
      <Text maxFontSizeMultiplier={1.3} style={{ ...typeScale.secundario, fontFamily: FONT.semibold, fontWeight: '600', color: inactivo ? c.textSecondary : c.text, textAlign: 'center' }}>{label}</Text>
    </Pressable>
  )
}
