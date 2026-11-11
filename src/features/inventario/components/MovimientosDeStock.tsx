import React from 'react'
import { ActivityIndicator, FlatList, Modal, Text, View } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { StatusChip, TopBar } from '@/core/ui/fw'
import { formatToLocalTime } from '@/core/utils/fecha'
import type { MovimientoStockHistorialDto } from '@/libs/api-client/types'
import { useMovimientosDeStock } from '../hooks/useConsultasDeStock'
import { cantidadConSigno, estadoDeMovimiento } from '../lib/stock-presentacion'

function Movimiento({ m }: { m: MovimientoStockHistorialDto }) {
  const c = useColors()
  const color = m.cantidad > 0 ? c.chip.entregado.text : m.cantidad < 0 ? c.chip.anulado.text : c.text
  return (
    <View style={{ gap: space[1], padding: space[3], borderRadius: radii.tarjeta, backgroundColor: c.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <StatusChip estado={estadoDeMovimiento(m.tipoLabel, m.cantidad)} label={m.tipoLabel} />
        <Text style={[typeScale.secundario, { flex: 1, color: c.textSecondary }]}>{formatToLocalTime(m.fecha)}</Text>
        <Text style={[typeScale.cuerpoDestacado, { color, fontVariant: ['tabular-nums'] }]}>{cantidadConSigno(m.cantidad)}</Text>
      </View>
      {m.observacion ? <Text numberOfLines={2} style={[typeScale.secundario, { color: c.textSecondary }]}>{m.observacion}</Text> : null}
      <Text style={[typeScale.secundario, { color: c.textSecondary }]}>{m.usuarioNombre}</Text>
    </View>
  )
}

interface Props {
  visible: boolean
  onCerrar: () => void
  productoId: string
  producto: string
}

/**
 * Movimientos de un producto (web StockMovimientosPanel): tipo con su color, fecha y hora, cantidad con signo,
 * observación y quién. Usa el endpoint de la web (GET /Stocks/movimientos), de a 20. Cerrado no consulta. Sin el
 * enlace al historial completo de la web.
 */
export function MovimientosDeStock({ visible, onCerrar, productoId, producto }: Props) {
  const c = useColors()
  const q = useMovimientosDeStock(productoId, visible)
  const movimientos = q.data?.pages.flatMap((p) => p?.items ?? []) ?? []

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar title="Movimientos" subtitle={producto} leading={{ kind: 'atras', onPress: onCerrar }} />
        {q.isLoading ? (
          <ActivityIndicator style={{ marginTop: space[8] }} color={c.brandInk} />
        ) : q.isError ? (
          <Text accessibilityRole="alert" style={[typeScale.cuerpo, { color: c.chip.anulado.text, padding: space[4], textAlign: 'center' }]}>
            No se pudo cargar el historial. Intentá de nuevo.
          </Text>
        ) : (
          <FlatList
            data={movimientos}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => <Movimiento m={item} />}
            onEndReached={() => {
              if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage()
            }}
            onEndReachedThreshold={0.5}
            contentContainerStyle={{ padding: space[4], gap: space[2], paddingBottom: space[12] }}
            ListEmptyComponent={<Text style={[typeScale.cuerpo, { color: c.textSecondary, textAlign: 'center', padding: space[4] }]}>No hay movimientos registrados para este producto.</Text>}
            ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={c.brandInk} /> : undefined}
          />
        )}
      </View>
    </Modal>
  )
}
