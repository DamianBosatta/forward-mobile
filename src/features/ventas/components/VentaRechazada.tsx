import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { formatImporte } from '@/core/ui/fw'
import type { VentaHeaderDto } from '@/libs/api-client/types'
import { motivosDe } from '@/features/autorizaciones/lib/motivos'
import { horaDe, tituloDelDia } from '../lib/agruparPorDia'

/** "Deuda vencida y crédito": los motivos por los que esperaba, que el servidor conserva tras el rechazo. */
function esperabaPor(flags: number | null | undefined): string | null {
  const textos = motivosDe(flags).map((m) => m.filtro.toLowerCase())
  if (!textos.length) return null
  const frase = textos.length > 1 ? `${textos.slice(0, -1).join(', ')} y ${textos[textos.length - 1]}` : textos[0]!
  return frase.charAt(0).toUpperCase() + frase.slice(1)
}

interface Props {
  venta: VentaHeaderDto
  /** Deuda vencida del cliente, si el servidor la manda a quien puede verla. */
  deudaVencida: number | null
  telefono: string | null
  onCobrar: (() => void) | null
  onArmarIgual: (() => void) | null
  onLlamar: (() => void) | null
}

function Accion({ titulo, detalle, onPress }: { titulo: string; detalle: string; onPress: () => void }) {
  const c = useColors()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      onPress={onPress}
      style={{ minHeight: 56, padding: space[3], borderRadius: radii.tarjeta, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, gap: 2 }}
    >
      <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{titulo}</Text>
      <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{detalle}</Text>
    </Pressable>
  )
}

/** Pedido rechazado por gestión (láminas ResRechazada y TabVentasRechazada): por qué y qué hacer ahora. */
export function VentaRechazada({ venta, deudaVencida, telefono, onCobrar, onArmarIgual, onLlamar }: Props) {
  const c = useColors()
  const sec = { ...typeScale.secundario, color: c.textSecondary }
  const cuando = venta.fechaModificacion ? `${tituloDelDia(new Date(venta.fechaModificacion)).toLowerCase()} ${horaDe(venta.fechaModificacion)}` : null
  const quien = [venta.autorizadoPor, cuando].filter(Boolean).join(' · ')
  const motivos = esperabaPor(venta.motivoPendienteAutorizacion)
  return (
    <View style={{ gap: space[4] }}>
      <View style={{ gap: space[2] }}>
        <View accessible accessibilityRole="alert" style={{ padding: space[3], borderRadius: radii.campo, backgroundColor: c.chip.anulado.bg, gap: space[1] }}>
          <Text style={{ ...typeScale.cuerpoDestacado, color: c.chip.anulado.text }}>Rechazado por gestión</Text>
          <Text style={{ ...typeScale.cuerpo, color: c.text }}>{venta.motivoRechazoAutorizacion ? `“${venta.motivoRechazoAutorizacion}”` : 'Sin motivo cargado.'}</Text>
        </View>
        {quien ? <Text style={sec}>{quien}</Text> : null}
      </View>
      <View style={{ gap: space[1] }}>
        {motivos ? <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={sec}>Esperaba por</Text><Text style={{ ...typeScale.cuerpo, color: c.text }}>{motivos}</Text></View> : null}
        {deudaVencida && deudaVencida > 0 ? <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={sec}>Deuda del cliente</Text><Text style={{ ...typeScale.cuerpo, color: c.text }}>{formatImporte(deudaVencida)}</Text></View> : null}
      </View>
      {onCobrar || onArmarIgual || onLlamar ? (
        <View style={{ gap: space[2] }}>
          <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>¿Qué hacés ahora?</Text>
          {onCobrar ? <Accion titulo="Cobrar lo vencido" detalle="Y después mandar el pedido de nuevo" onPress={onCobrar} /> : null}
          {onArmarIgual ? <Accion titulo="Armar uno nuevo igual" detalle="Copia las líneas a una venta nueva" onPress={onArmarIgual} /> : null}
          {onLlamar ? <Accion titulo="Llamar al cliente" detalle={telefono ?? ''} onPress={onLlamar} /> : null}
        </View>
      ) : null}
      <Text style={sec}>Un pedido rechazado ya no se puede editar: queda como registro para vos y para gestión.</Text>
    </View>
  )
}
