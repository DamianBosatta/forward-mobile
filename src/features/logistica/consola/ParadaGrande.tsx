import React from 'react'
import { Text, View } from 'react-native'
import { MapPin } from 'lucide-react-native'
import { FONT, importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { StatusChip, formatImporte } from '@/core/ui/fw'
import { PressableFx } from '@/core/ui/fw/PressableFx'
import type { ParadaDto } from '@/libs/api-client/types'
import { chipCobro, etiquetaNota, importeParada } from './cobroParada'
import { piezasDeParada } from './piezasParada'
import { HorarioDelDia } from './HorarioDelDia'

interface Props {
  parada: ParadaDto
  numero: number
  total: number
  puedeLlamar: boolean
  notaCargando: boolean
  onLlamar: () => void
  onNota: () => void
}

/**
 * Lámina chofer-01-viaje: la próxima parada ocupa la pantalla (cliente grande, dirección, piezas y
 * monto) en la tarjeta lime del restyle FWD (la única de la pantalla). El resto de las acciones del pedido quedan como atajos de 44 px; las
 * principales (Ir, ¡Llegué!) viven en la barra fija de abajo.
 */
export function ParadaGrande({ parada, numero, total, puedeLlamar, notaCargando, onLlamar, onNota }: Props) {
  const c = useColors()
  const cobro = importeParada(parada)
  const chip = chipCobro(parada)
  const nota = etiquetaNota(parada)
  const piezas = piezasDeParada(parada)
  return (
    <View
      accessibilityLabel="Próxima parada"
      style={{ backgroundColor: c.lime, borderRadius: radii.tarjetaGrande, padding: space[5], gap: space[3] }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2], flexWrap: 'wrap' }}>
        {/* Pastilla ink con texto lime: el "Parada 3 de 8" de la lámina. */}
        <View style={{ backgroundColor: c.ink, borderRadius: radii.pastilla, paddingHorizontal: space[4], paddingVertical: space[2], minHeight: 28, justifyContent: 'center' }}>
          <Text style={{ ...typeScale.secundario, fontFamily: FONT.extrabold, fontWeight: '800', color: c.lime }}>{`Parada ${numero} de ${total}`}</Text>
        </View>
        {chip ? <StatusChip estado={chip.estado} label={chip.label} /> : null}
      </View>
      <View style={{ gap: space[1] }}>
        <Text maxFontSizeMultiplier={1.3} style={{ ...typeScale.consolaCifra, color: c.ink }}>
          {parada.clienteNombre}
        </Text>
        {/* El cliente se identifica por la dirección: es el punto de entrega. */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}>
          <MapPin size={24} color={c.ink} />
          <Text style={{ ...typeScale.consolaTexto, fontFamily: FONT.semibold, fontWeight: '600', color: c.ink, flex: 1 }}>{parada.direccion}</Text>
        </View>
        <HorarioDelDia horario={parada.horarioDelDia} color={c.ink} />
        {nota ? <Text style={{ ...typeScale.secundario, color: c.ink }}>{`Remito ${nota}`}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: space[3] }}>
        <Dato rotulo="Piezas" valor={String(piezas.total)} />
        <Dato rotulo={cobro.aCobrar ? 'A cobrar' : cobro.rotulo} valor={formatImporte(cobro.valor)} crece />
      </View>
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <Atajo label="Llamar" disabled={!puedeLlamar} onPress={onLlamar} />
        <Atajo label="Nota de entrega" busy={notaCargando} onPress={onNota} />
      </View>
    </View>
  )
}

function Dato({ rotulo, valor, crece }: { rotulo: string; valor: string; crece?: boolean }) {
  const c = useColors()
  return (
    <View style={{ flex: crece ? 1 : undefined, backgroundColor: c.veilInk12, borderRadius: radii.cantidad, paddingVertical: space[3], paddingHorizontal: space[4] }}>
      <Text style={{ ...typeScale.etiqueta, color: c.ink, opacity: 0.78, textTransform: 'uppercase' }}>{rotulo}</Text>
      <Text maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit style={{ ...typeScale.consolaCifra, ...importe, color: c.ink }}>{valor}</Text>
    </View>
  )
}

function Atajo({ label, onPress, disabled, busy }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean }) {
  const c = useColors()
  const inactivo = disabled || busy
  return (
    <PressableFx
      onPress={inactivo ? undefined : onPress}
      disabled={inactivo}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactivo, busy: !!busy }}
      android_ripple={{ color: c.ink }}
      style={{ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[2], borderRadius: radii.pastilla, backgroundColor: c.veilInk12, opacity: inactivo ? 0.5 : 1 }}
    >
      <Text maxFontSizeMultiplier={1.3} style={{ ...typeScale.cuerpoDestacado, color: c.ink, textAlign: 'center' }}>{label}</Text>
    </PressableFx>
  )
}
