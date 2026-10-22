import React from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Notice, StatusChip, chipForEstado } from '@/core/ui/fw'
import { useVenta } from '@/libs/api-client'
import type { VentaPreparacion } from '@/libs/api-client/logistica'
import type { VentaDetalleItemDto } from '@/libs/api-client/types'
import { tituloDelDia } from '@/features/ventas/lib/agruparPorDia'
import { parseDateSafe } from '@/src/utils/date'

type Empaque = NonNullable<VentaDetalleItemDto['empaque']>

const enBultos = (n: number, de: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios} de ${de}`

/**
 * "48 u. · 4 bultos de 12" (lámina PedidosPorPreparar). El desglose lo arma el servidor (9B,
 * prioridad 3); sin empaque (producto sin bulto o servidor anterior) solo las unidades.
 */
function textoCantidad(cantidad: number, empaque: Empaque | null | undefined): string {
  if (!empaque) return `${cantidad} u.`
  const partes = [
    empaque.bultosMadre > 0 && empaque.unidadesPorBultoMadre
      ? enBultos(empaque.bultosMadre, empaque.unidadesPorBultoMadre, 'bulto madre', 'bultos madre') : null,
    empaque.bultos > 0 ? enBultos(empaque.bultos, empaque.unidadesPorBulto, 'bulto', 'bultos') : null,
    empaque.unidadesSueltas > 0 ? `${empaque.unidadesSueltas} u.` : null,
  ].filter(Boolean)
  if (partes.length === 0) return `${cantidad} u.`
  const desglose = partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
  return `${cantidad} u. · ${desglose}`
}

/** Panel de detalle de las láminas ModPreparar y TabLogistica: qué sale y cuándo, solo para ver. */
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
      <Text style={{ ...typeScale.seccion, color: c.text }}>{`Productos (${pedido.itemsCount})`}</Text>
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
              <Text style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.text }}>{textoCantidad(l.cantidad, l.empaque)}</Text>
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
      <Notice tone="info">Solo para ver cómo va. Preparar y armar la ruta se hace en la web.</Notice>
    </ScrollView>
  )
}
