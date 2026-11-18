import { LISTA_LARGA_PROPS } from '@/core/ui/listaLargaProps'
import React, { memo, useCallback, useMemo } from 'react'
import { ActivityIndicator, FlatList, Modal, Text, View } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { StatusChip, TopBar, useInsetInferior } from '@/core/ui/fw'
import { Esqueletos } from '@/features/clientes/components/Esqueletos'
import { ErrorDeConsulta, esqueletoDeFilas } from '@/core/ui/estados'
import { EstadoDePantalla } from '@/core/ui/fw/EstadoDePantalla'
import { formatToLocalTime } from '@/core/utils/fecha'
import type { MovimientoStockHistorialDto } from '@/libs/api-client/types'
import { useMovimientosDeStock } from '../hooks/useConsultasDeStock'
import { cantidadConSigno, estadoDeMovimiento } from '../lib/stock-presentacion'

/** Fila memoizada: no se vuelve a pintar mientras el movimiento no cambie. */
const Movimiento = memo(function Movimiento({ m }: { m: MovimientoStockHistorialDto }) {
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
})

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
  const insetInferior = useInsetInferior()
  const q = useMovimientosDeStock(productoId, visible)
  const paginas = q.data?.pages
  const movimientos = useMemo(() => paginas?.flatMap((p) => p?.items ?? []) ?? [], [paginas])
  const renderMovimiento = useCallback(({ item }: { item: MovimientoStockHistorialDto }) => <Movimiento m={item} />, [])

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar} statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar title="Movimientos" subtitle={producto} leading={{ kind: 'atras', onPress: onCerrar }} />
        {q.isLoading ? (
          <View style={{ padding: space[4] }}><Esqueletos bloques={esqueletoDeFilas(5, 64)} /></View>
        ) : q.isError ? (
          <ErrorDeConsulta error={q.error} titulo="No pudimos cargar el historial" onReintentar={() => { void q.refetch() }} />
        ) : (
          <FlatList {...LISTA_LARGA_PROPS}
            data={movimientos}
            keyExtractor={(m) => m.id}
            renderItem={renderMovimiento}
            onEndReached={() => {
              if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage()
            }}
            onEndReachedThreshold={0.5}
            contentContainerStyle={{ padding: space[4], gap: space[2], paddingBottom: space[12] + insetInferior }}
            ListEmptyComponent={<EstadoDePantalla tipo="vacio" titulo="Todavía no hay movimientos de este producto." />}
            ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={c.brandInk} /> : undefined}
          />
        )}
      </View>
    </Modal>
  )
}
