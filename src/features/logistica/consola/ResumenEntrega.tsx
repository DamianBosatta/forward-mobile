import React from 'react'
import { Text, View } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { formatImporte } from '@/core/ui/fw'

export interface DatosResumen {
  receptor: string
  conFotoRemito: boolean
  devueltos: { nombre: string; cantidad: number }[]
  cobros: { medio: string; monto: number; conFoto: boolean }[]
  firmada: boolean
  aDeudaAnterior: boolean
}

function Fila({ izq, der, fuerte }: { izq: string; der?: string; fuerte?: boolean }) {
  const c = useColors()
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[3] }}>
      <Text style={{ ...(fuerte ? typeScale.cuerpoDestacado : typeScale.cuerpo), color: fuerte ? c.text : c.textSecondary, flexShrink: 1 }}>{izq}</Text>
      {der ? <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{der}</Text> : null}
    </View>
  )
}

/** Lámina Resumen (E6): lo que se va a registrar, en tres bloques. Solo muestra: el servidor decide importes e imputación. */
export function ResumenEntrega({ d }: { d: DatosResumen }) {
  const c = useColors()
  const total = d.cobros.reduce((t, x) => t + x.monto, 0)
  const bloque = { backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[4], gap: space[2] }
  return (
    <View accessibilityLabel="Resumen de la entrega" style={{ gap: space[4] }}>
      <View style={bloque}>
        <Text style={{ ...typeScale.seccion, color: c.text }}>Entrega</Text>
        <Fila izq="Recibió" der={d.receptor} />
        <Fila izq="Foto del remito" der={d.conFotoRemito ? 'Lista' : 'Sin foto'} />
      </View>
      {d.devueltos.length > 0 ? (
        <View style={bloque}>
          <Text style={{ ...typeScale.seccion, color: c.text }}>Devolución</Text>
          <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Por autorizar en depósito</Text>
          {d.devueltos.map((x) => (
            <Fila key={x.nombre} izq={`${x.cantidad} × ${x.nombre}`} />
          ))}
          <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
            Llevala al depósito. La nota de crédito se acredita cuando la reciban; hasta entonces la deuda del cliente no cambia.
          </Text>
        </View>
      ) : null}
      <View style={bloque}>
        <Text style={{ ...typeScale.seccion, color: c.text }}>Cobro</Text>
        {d.cobros.length === 0 ? <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>Sin cobro: el pedido queda en la cuenta del cliente.</Text> : null}
        {d.cobros.map((x, i) => (
          <Fila key={i} izq={x.medio} der={formatImporte(x.monto)} />
        ))}
        {d.cobros.length > 1 ? <Fila izq="Total cobrado" der={formatImporte(total)} fuerte /> : null}
        {d.cobros.length > 0 ? (
          <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
            {d.aDeudaAnterior ? 'El cobro va a la deuda anterior del cliente. ' : ''}Lo cobrado queda a tu nombre hasta que lo rindas en el depósito.
          </Text>
        ) : null}
        {d.firmada ? <Fila izq="Firma del cliente" der="Foto lista" /> : null}
      </View>
    </View>
  )
}
