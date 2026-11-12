import React, { useMemo, useState } from 'react'
import { FlatList, RefreshControl, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Plus } from 'lucide-react-native'
import { space, useColors } from '@/libs/theme'
import { Button, Field, Notice, Segmented, TopBar } from '@/core/ui/fw'
import { FiltroChip } from '@/core/ui/fw/FiltroChip'
import { EstadoDePantalla, textoSinConexion } from '@/core/ui/fw/EstadoDePantalla'
import { esFallaDeRed } from '@/core/api/errores'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { useValorDiferido } from '@/features/clientes/hooks/useCartera'
import { Esqueletos, FILAS_CARGANDO } from '@/features/clientes/components/Esqueletos'
import { usePuedeCobrar } from '@/features/cuentas/lib/permiso'
import { PERIODOS_DE_CUENTA, rangoDelPeriodo, type PeriodoDeCuenta } from '@/features/cuentas/lib/periodo'
import { usePagos } from '../api/pagos'
import { FILTROS_DE_PAGOS, textoSinPagos, type FiltroDePagos } from '../lib/pago'
import { usePuedeVerPagos } from '../lib/permiso'
import { useSinConexionSinDatos } from '../lib/sinConexion'
import { FilaDePago } from './FilaDePago'

/**
 * Tesorería > Pagos (web "Pagos & Recibos", `/finanzas/pagos`): pagos a proveedores, cobros de clientes o los dos, de a
 * 20, con búsqueda y período en el servidor. "Pagar a proveedor" abre el pago en pasos (el mismo flujo del cobro).
 * Anular y el comprobante quedan en la web.
 */
export function ListaDePagos({ onVolver }: { onVolver: () => void }) {
  const c = useColors()
  const router = useRouter()
  const puedeVer = usePuedeVerPagos()
  const puedePagar = usePuedeCobrar()
  const [filtro, setFiltro] = useState<FiltroDePagos>('proveedor')
  const [busqueda, setBusqueda] = useState('')
  const [periodo, setPeriodo] = useState<PeriodoDeCuenta | null>(null)
  const texto = useValorDiferido(busqueda.trim())
  const rango = useMemo(() => (periodo ? rangoDelPeriodo(periodo, Date.now()) : undefined), [periodo])
  const q = usePagos(filtro, texto, rango, puedeVer)
  const filas = useMemo(() => (q.data?.pages ?? []).flatMap(p => p?.items ?? []), [q.data])
  const sinRed = esFallaDeRed(q.error)
  // Sin red y sin nada guardado la consulta queda en pausa (sin error): también es "sin conexión".
  const enPausa = useSinConexionSinDatos(q)
  const sinConexion = (!!q.error && sinRed) || enPausa
  const reintentar = { label: 'Reintentar', onPress: () => void q.refetch() }

  const encabezado = (
    <TopBar
      title="Pagos"
      leading={{ kind: 'atras', onPress: onVolver }}
      actions={puedePagar && puedeVer ? [{ icon: Plus, accessibilityLabel: 'Pagar a proveedor', label: 'Pagar', onPress: () => router.push('/(tabs)/tesoreria/pagos/pagar') }] : undefined}
    />
  )
  if (!puedeVer) {
    return (
      <View style={{ flex: 1 }}>
        {encabezado}
        <EstadoDePantalla tipo="sinPermiso" titulo="No podés ver los pagos" />
      </View>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      {encabezado}
      <View style={{ gap: space[2], paddingHorizontal: space[4], paddingTop: space[3] }}>
        <Segmented options={FILTROS_DE_PAGOS} value={filtro} onChange={setFiltro} accessibilityLabel="Qué pagos ver" />
        <Field label="Buscar" value={busqueda} onChangeText={setBusqueda} placeholder="Proveedor, cliente o referencia" returnKeyType="search" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          {PERIODOS_DE_CUENTA.map(p => (
            <FiltroChip key={p.valor} label={p.label} activo={periodo === p.valor} onPress={() => setPeriodo(periodo === p.valor ? null : p.valor)} />
          ))}
        </View>
      </View>
      {q.error && !(sinRed && filas.length === 0) ? (
        <View style={{ padding: space[4], gap: space[2] }}>
          {sinRed ? (
            <Notice tone="advertencia">{textoSinConexion(q.dataUpdatedAt || undefined)}</Notice>
          ) : (
            <Notice tone="peligro">{mensajeDelServidor(q.error, 'No se pudo cargar el historial de pagos.')}</Notice>
          )}
          <Button label="Reintentar" variant="secundario" onPress={reintentar.onPress} />
        </View>
      ) : null}
      <FlatList
        data={filas}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item, index }) => (
          <FilaDePago
            pago={item}
            primera={index === 0}
            ultima={index === filas.length - 1}
            onPress={() => router.push({ pathname: '/(tabs)/tesoreria/pagos/[id]', params: { id: item.id } })}
          />
        )}
        contentContainerStyle={{ paddingTop: space[3], paddingBottom: space[6] }}
        onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage() }}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { void q.refetch() }} tintColor={c.brandInk} />}
        ListEmptyComponent={
          q.isLoading ? (
            <View style={{ paddingHorizontal: space[4] }}>
              <Esqueletos bloques={FILAS_CARGANDO} />
            </View>
          ) : sinConexion ? (
            <EstadoDePantalla tipo="sinConexion" titulo="No pudimos cargar los pagos" accion={reintentar} />
          ) : q.error ? undefined : (
            <EstadoDePantalla tipo="vacio" titulo={textoSinPagos(filtro, !!texto || !!periodo)} />
          )
        }
      />
    </View>
  )
}
