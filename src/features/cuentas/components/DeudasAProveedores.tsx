import React from 'react'
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native'
import { importe, space, typeScale, useColors } from '@/libs/theme'
import { Notice, formatImporte } from '@/core/ui/fw'
import { EstadoDePantalla, textoSinConexion } from '@/core/ui/fw/EstadoDePantalla'
import { esFallaDeRed } from '@/core/api/errores'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { useDeudasProveedores, type DeudaProveedor } from '../api/queries'

/**
 * Lado "Debo" de Cuentas (lámina cuentas-lista): lo que se le debe a cada proveedor, con el total del servidor arriba.
 * Es de solo lectura: la app no abre la cuenta de un proveedor. Pedirla solo con MOD_PAGOS:Read.
 */
export function DeudasAProveedores() {
  const c = useColors()
  const q = useDeudasProveedores(true)
  const filas = (q.data?.pages ?? []).flatMap(p => p?.pagina?.items ?? [])
  const total = q.data?.pages?.[0]?.deudaTotal
  const sinRed = esFallaDeRed(q.error)

  return (
    <View style={{ flex: 1 }}>
      {total !== undefined ? (
        <View
          accessible
          accessibilityLabel={`Debés: ${formatImporte(total)}`}
          style={{ paddingHorizontal: space[4], paddingTop: space[3], gap: space[1] }}
        >
          <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Debés</Text>
          <Text style={[typeScale.titulo, importe, { color: c.text }]}>{formatImporte(total)}</Text>
        </View>
      ) : null}
      {q.error && !(sinRed && filas.length === 0) ? (
        <View style={{ padding: space[4] }}>
          {sinRed ? (
            <Notice tone="advertencia">{textoSinConexion(q.dataUpdatedAt || undefined)}</Notice>
          ) : (
            <Notice tone="peligro">{mensajeDelServidor(q.error, 'No se pudieron cargar las deudas con proveedores.')}</Notice>
          )}
        </View>
      ) : null}
      <FlatList
        data={filas}
        keyExtractor={item => item.socioId}
        renderItem={({ item }) => <FilaDeDeuda deuda={item} />}
        onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage() }}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={c.brandInk} />}
        ListEmptyComponent={
          q.isLoading ? (
            <ActivityIndicator color={c.brandInk} style={{ marginTop: space[8] }} />
          ) : q.error ? (
            sinRed ? (
              <EstadoDePantalla tipo="sinConexion" titulo="No pudimos cargar las deudas" accion={{ label: 'Reintentar', onPress: () => void q.refetch() }} />
            ) : null
          ) : (
            <EstadoDePantalla tipo="vacio" titulo="No le debés a ningún proveedor." />
          )
        }
      />
    </View>
  )
}

function FilaDeDeuda({ deuda }: { deuda: DeudaProveedor }) {
  const c = useColors()
  const monto = formatImporte(deuda.saldoDeuda, { moneda: deuda.moneda })
  return (
    <View
      accessible
      accessibilityLabel={`${deuda.razonSocial}, le debés ${monto}`}
      style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space[2], minHeight: 56, paddingVertical: space[3], paddingHorizontal: space[4], backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border }}
    >
      <Text numberOfLines={1} style={{ ...typeScale.cuerpoDestacado, color: c.text, flexShrink: 1 }}>{deuda.razonSocial}</Text>
      <Text style={[typeScale.cuerpoDestacado, importe, { color: c.text }]}>{monto}</Text>
    </View>
  )
}
