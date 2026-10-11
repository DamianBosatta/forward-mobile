import React from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Notice, StatusChip, chipForEstado } from '@/core/ui/fw'
import { useVenta } from '@/libs/api-client'
import type { VentaPreparacion } from '@/libs/api-client/logistica'
import { tituloDelDia } from '@/features/ventas/lib/agruparPorDia'
import { parseDateSafe } from '@/src/utils/date'

/** Panel de detalle de la lámina TabPedidosPorPreparar: qué sale, cuándo y qué hay que preparar. */
export function PedidoPorPrepararDetalle({ pedido }: { pedido: VentaPreparacion }) {
  const c = useColors()
  const q = useVenta(pedido.id)
  const chip = chipForEstado('venta', pedido.estado)
  const entrega = parseDateSafe(pedido.fechaEntrega)
  const lineas = q.data?.detalles ?? []
  const observaciones = q.data?.venta?.observaciones?.trim()
  const secundario = { ...typeScale.secundario, color: c.textSecondary }
  const dato = (titulo: string, valor: string) => (
    <View style={{ flexDirection: 'row', gap: space[3] }}>
      <Text style={{ ...secundario, width: 72 }}>{titulo}</Text>
      <Text style={{ ...typeScale.cuerpo, color: c.text, flex: 1 }}>{valor}</Text>
    </View>
  )

  return (
    <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4] }}>
      <View style={{ gap: space[1] }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2] }}>
          <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text, flex: 1 }}>
            {`Pedido ${pedido.codigoPedido ?? pedido.id.slice(0, 8).toUpperCase()}`}
          </Text>
          {chip ? <StatusChip estado={chip.estado} label={chip.label} /> : null}
        </View>
        <Text style={secundario}>{`${pedido.clienteNombre} · ${pedido.vendedorNombre}`}</Text>
      </View>
      <View style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[4], gap: space[2] }}>
        {dato('Entrega', entrega ? tituloDelDia(entrega) : 'Sin fecha')}
        {dato('Cómo', pedido.metodoEntregaNombre)}
        {dato('Lugar', pedido.direccion)}
      </View>
      <Notice tone="info" title="Solo lectura:">
        la preparación y el empaque se registran en el depósito. Acá ves qué sale y cuándo.
      </Notice>
      <Text style={{ ...typeScale.seccion, color: c.text }}>{`Qué preparar (${pedido.itemsCount} ${pedido.itemsCount === 1 ? 'línea' : 'líneas'})`}</Text>
      {q.isLoading ? (
        <ActivityIndicator color={c.brand} accessibilityLabel="Cargando las líneas" />
      ) : q.isError ? (
        <Notice tone="peligro">No se pudieron cargar las líneas del pedido.</Notice>
      ) : (
        <View style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta }}>
          {lineas.map((l, i) => (
            <View
              key={l.id ?? i}
              style={{
                flexDirection: 'row', gap: space[3], padding: space[4],
                borderBottomWidth: i === lineas.length - 1 ? 0 : 1, borderBottomColor: c.border,
              }}
            >
              <Text style={{ ...typeScale.cuerpo, color: c.text, flex: 1 }}>{l.productoNombre}</Text>
              <Text style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.text }}>{`${l.cantidad} u.`}</Text>
            </View>
          ))}
        </View>
      )}
      {observaciones ? (
        <View style={{ gap: space[1] }}>
          <Text style={{ ...typeScale.seccion, color: c.text }}>Observaciones</Text>
          <Text style={{ ...typeScale.cuerpo, color: c.text }}>{observaciones}</Text>
        </View>
      ) : null}
    </ScrollView>
  )
}
