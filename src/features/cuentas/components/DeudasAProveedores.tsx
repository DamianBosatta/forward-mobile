import React from 'react'
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Notice, formatImporte } from '@/core/ui/fw'
import { HeroSaldo } from '@/features/clientes/components/SaldoDelCliente'
import { Esqueletos } from '@/features/clientes/components/Esqueletos'
import { EstadoDePantalla, textoSinConexion } from '@/core/ui/fw/EstadoDePantalla'
import { esFallaDeRed } from '@/core/api/errores'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { useDeudasProveedores, type DeudaProveedor } from '../api/queries'
import { chipAntiguedadDeuda } from '../lib/antiguedadDeuda'
import { ChipAntiguedadDeuda } from './ChipAntiguedadDeuda'
import { usePuedeCobrar } from '../lib/permiso'

/** Esqueleto del hero "Debés" y de una fila (frame 7). */
const DEBO_CARGANDO = [{ alto: 96, radio: radii.hoja, testID: 'esqueleto-hero' }, { alto: 76 }]

/**
 * Lado "Debo" de Cuentas (lámina cuentas-lista; propuesta "Finanzas como venta", frames 6 y 7): lo que se le debe a
 * cada proveedor, con el total del servidor en un hero arriba y un proveedor por fila dentro de una tarjeta.
 * La app no abre la cuenta de un proveedor; con permiso para pagar (MOD_PAGOS crear y leer, la regla del cobro), cada
 * fila lleva "Pagar", que abre el pago a ese proveedor (`onPagar`). Pedirla solo con MOD_PAGOS:Read.
 */
export function DeudasAProveedores({ onPagar }: { onPagar?: (socioId: string) => void }) {
  const c = useColors()
  const q = useDeudasProveedores(true)
  const pagar = usePuedeCobrar() ? onPagar : undefined
  const filas = (q.data?.pages ?? []).flatMap(p => p?.pagina?.items ?? [])
  const total = q.data?.pages?.[0]?.deudaTotal
  const sinRed = esFallaDeRed(q.error)

  return (
    <View style={{ flex: 1 }}>
      {total !== undefined ? (
        <View style={{ paddingHorizontal: space[4], paddingTop: space[3] }}>
          <HeroSaldo titulo="Debés" saldo={total} vencido={null} tope={null} disponible={null} accessibilityLabel={`Debés: ${formatImporte(total)}`} />
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
        renderItem={({ item, index }) => (
          <FilaDeDeuda deuda={item} primera={index === 0} ultima={index === filas.length - 1} onPagar={pagar ? () => pagar(item.socioId) : undefined} />
        )}
        contentContainerStyle={{ paddingTop: space[3], paddingBottom: space[6] }}
        onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage() }}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { void q.refetch() }} tintColor={c.brandInk} />}
        ListEmptyComponent={
          q.isLoading ? (
            <View style={{ paddingHorizontal: space[4] }}>
              <Esqueletos bloques={DEBO_CARGANDO} />
            </View>
          ) : q.error ? (
            sinRed ? (
              <EstadoDePantalla tipo="sinConexion" titulo="No pudimos cargar las deudas" accion={{ label: 'Reintentar', onPress: () => void q.refetch() }} />
            ) : undefined
          ) : (
            <EstadoDePantalla tipo="vacio" titulo="No le debés a ningún proveedor." />
          )
        }
      />
    </View>
  )
}

/**
 * Un proveedor por fila (frame 6): razón social, chip de antigüedad y el monto a la derecha. Sin flecha (no abre una
 * cuenta); con `onPagar`, un botón "Pagar" de 44 pt debajo, fuera del bloque que se lee de corrido.
 */
function FilaDeDeuda({ deuda, primera, ultima, onPagar }: { deuda: DeudaProveedor; primera: boolean; ultima: boolean; onPagar?: () => void }) {
  const c = useColors()
  const monto = formatImporte(deuda.saldoDeuda, { moneda: deuda.moneda })
  const antiguedad = chipAntiguedadDeuda(deuda.diasDeudaMasVieja)?.texto
  return (
    <View
      style={{
        minHeight: 64,
        marginHorizontal: space[4],
        paddingVertical: space[3],
        paddingHorizontal: space[4],
        gap: space[2],
        backgroundColor: c.surface,
        borderBottomWidth: ultima ? 0 : 1,
        borderBottomColor: c.surface2,
        ...(primera ? { borderTopLeftRadius: radii.tarjeta, borderTopRightRadius: radii.tarjeta } : null),
        ...(ultima ? { borderBottomLeftRadius: radii.tarjeta, borderBottomRightRadius: radii.tarjeta } : null),
      }}
    >
      <View accessible accessibilityLabel={`${deuda.razonSocial}, le debés ${monto}${antiguedad ? `, ${antiguedad}` : ''}`} style={{ gap: space[2] }}>
        <Text numberOfLines={2} style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{deuda.razonSocial}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', rowGap: space[1], columnGap: space[2] }}>
          <ChipAntiguedadDeuda dias={deuda.diasDeudaMasVieja} />
          <Text style={[typeScale.cuerpoDestacado, importe, { color: c.text, marginLeft: 'auto' }]}>{monto}</Text>
        </View>
      </View>
      {onPagar ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Pagar a ${deuda.razonSocial}`}
          onPress={onPagar}
          android_ripple={{ color: c.border }}
          style={{ alignSelf: 'flex-start', minHeight: 44, minWidth: 88, justifyContent: 'center', alignItems: 'center', paddingHorizontal: space[4], borderRadius: radii.pastilla, borderWidth: 1, borderColor: c.border }}
        >
          <Text style={{ ...typeScale.cuerpoDestacado, color: c.brandInk }}>Pagar</Text>
        </Pressable>
      ) : null}
    </View>
  )
}
