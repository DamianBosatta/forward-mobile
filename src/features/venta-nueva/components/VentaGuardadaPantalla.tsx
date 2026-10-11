import React from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, Notice, TopBar, TotalsRow, formatImporte } from '@/core/ui/fw'
import { useVenta } from '@/libs/api-client/ventas'
import { useSocio } from '@/libs/api-client/socios'
import { ESTADO_PENDIENTE_AUTORIZACION } from '../lib/motivosAutorizacion'
import { codigoDeVenta, rotuloCliente, tipoDeVenta } from '../lib/ventaGuardada'
import { AccionesVenta } from './AccionesVenta'

interface Props {
  id: string
  /** Lo que dijo el servidor al guardar (useConfirmarVenta): "quedó por autorizar porque…". */
  mensaje?: string
}

/** Venta guardada (lámina Guardada, plan 9 §2.1, PR 2.9): resumen, lo que dijo el servidor y qué hacer ahora. */
export function VentaGuardadaPantalla({ id, mensaje }: Props) {
  const c = useColors()
  const router = useRouter()
  const q = useVenta(id)
  const socio = useSocio(q.data?.venta.clienteId ?? '')
  const listo = () => router.replace('/(tabs)/ventas' as never)
  const h = q.data?.venta
  const tipo = h ? tipoDeVenta(h) : 'Venta'
  const secundario = { ...typeScale.secundario, color: c.textSecondary }

  if (!q.data || !h) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar title="Venta guardada" />
        <View style={{ padding: space[4], gap: space[3] }}>
          {q.isError ? <Notice tone="peligro">No se pudo traer la venta. Ya quedó guardada: la ves en la lista.</Notice> : <ActivityIndicator color={c.brand} />}
          {q.isError ? <Button label="Listo" onPress={listo} /> : null}
        </View>
      </View>
    )
  }
  const rotulo = socio.data ? rotuloCliente(socio.data) : (h.clienteNombre ?? '')
  const porAutorizar = h.estado === ESTADO_PENDIENTE_AUTORIZACION

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title={`${tipo} guardado`} />
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4] }}>
        <View style={{ padding: space[4], borderRadius: radii.tarjeta, backgroundColor: c.surface, gap: space[2] }}>
          <Text style={{ ...typeScale.titulo, color: c.text }}>{`${tipo} ${codigoDeVenta(h)}`}</Text>
          <Text style={secundario}>{rotulo}</Text>
          {q.data.detalles.map((d) => (
            <View key={d.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
              <Text style={{ ...typeScale.cuerpo, color: c.text, flex: 1 }}>{`${d.productoNombre} × ${d.cantidad}`}</Text>
              <Text style={{ ...typeScale.cuerpo, ...importe, color: c.text }}>{formatImporte(d.subtotal)}</Text>
            </View>
          ))}
          <TotalsRow label="Total" importe={h.totalAmount} destacado />
        </View>
        <Notice tone={porAutorizar ? 'advertencia' : 'exito'} title={`${tipo} ${codigoDeVenta(h)} guardado`}>
          {mensaje ?? (porAutorizar ? 'Quedó por autorizar. Te avisamos cuando lo resuelvan.' : 'Quedó guardado.')}
        </Notice>
        <AccionesVenta venta={q.data} rotulo={rotulo} />
        <Text style={secundario}>La factura no se hace desde el teléfono: va por la pestaña Facturación de la web.</Text>
        <Button label="Listo" variant="secundario" onPress={listo} />
      </ScrollView>
    </View>
  )
}
