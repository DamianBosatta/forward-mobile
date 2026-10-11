import React, { useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, SectionList, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import {
  DocumentCard, Fab, Field, Notice, Segmented, TopBar, TwoPane, chipForEstado, useMenuLeading,
  type SegmentedOption,
} from '@/core/ui/fw'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { usePermissions } from '@/core/auth/RequirePermission'
import type { CompraDtoList } from '@/libs/api-client'
import type { BorradorCompra } from '@/libs/api-client/compras'
import { agruparPorDia, horaDe, tituloDelDia } from '@/features/ventas/lib/agruparPorDia'
import { useComprasList, type PeriodoCompras, type PestanaCompras } from '../hooks/useComprasList'

const PESTANAS: { key: PestanaCompras; label: string }[] = [
  { key: 'pendientes', label: 'Pendientes' },
  { key: 'recibidas', label: 'Recibidas' },
  { key: 'borradores', label: 'Borradores' },
]
const PERIODOS: SegmentedOption<PeriodoCompras>[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: 'todo', label: 'Todo' },
]

const productos = (n: number) => `${n} ${n === 1 ? 'producto' : 'productos'}`

interface Props {
  /** Detalle embebido para el panel derecho en tablet horizontal. */
  detalle: (id: string, cerrar: () => void) => React.ReactNode
}

/** Lista de compras con el formato nuevo (láminas Compras y TabCompras). */
export function ListaCompras({ detalle }: Props) {
  const c = useColors()
  const router = useRouter()
  const leading = useMenuLeading()
  const { isTablet, isTabletLandscape } = useResponsive()
  const { canDo } = usePermissions()
  const [elegida, setElegida] = useState<string | null>(null)
  const l = useComprasList()
  const q = l.comprasQuery

  const abrir = (id: string) => {
    if (isTabletLandscape) setElegida(id)
    else router.push(`/(tabs)/compras/${id}` as never)
  }

  const secundario = [typeScale.secundario, { color: c.textSecondary }]

  const filtros = (
    <View style={{ gap: space[3], paddingBottom: space[2] }}>
      <Field label="Buscar" placeholder="Proveedor o número" value={l.busqueda} onChangeText={l.setBusqueda} autoCorrect={false} />
      <Segmented accessibilityLabel="Período" options={PERIODOS} value={l.periodo} onChange={l.setPeriodo} />
      {l.contador ? <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>{l.contador}</Text> : null}
      {l.resumenTexto ? <Text style={secundario}>{l.resumenTexto}</Text> : null}
      {l.compradoTexto ? <Text style={secundario}>{l.compradoTexto}</Text> : null}
    </View>
  )

  const listaCompras = (
    <SectionList
      sections={agruparPorDia(l.compras, (x) => x.fecha)}
      keyExtractor={(x) => x.id}
      ListHeaderComponent={filtros}
      contentContainerStyle={{ padding: space[4], paddingBottom: space[12] * 2 }}
      renderSectionHeader={({ section }) => (
        <Text accessibilityRole="header" style={[typeScale.cuerpoDestacado, { color: c.textSecondary, backgroundColor: c.bg, paddingVertical: space[2] }]}>{section.titulo}</Text>
      )}
      renderItem={({ item: x }: { item: CompraDtoList }) => (
        <View style={{ marginBottom: space[3] }}>
          <DocumentCard
            numero={x.id.slice(0, 8).toUpperCase()}
            vendedor={x.nombreDeposito}
            avatar={x.razonSocialProveedor}
            direccion={x.razonSocialProveedor}
            hora={horaDe(x.fecha)}
            detalle={productos(x.itemsCount ?? 0)}
            importe={x.totalAmount}
            chip={chipForEstado('compra', x.estado)}
            onPress={() => abrir(x.id)}
          />
        </View>
      )}
      onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage() }}
      onEndReachedThreshold={0.4}
      refreshing={q.isRefetching}
      onRefresh={() => { void l.refrescar() }}
      ListEmptyComponent={
        q.isLoading ? <ActivityIndicator color={c.brand} />
          : q.isError ? <Notice tone="peligro">No se pudieron cargar las compras. Deslizá hacia abajo para reintentar.</Notice>
          : <Text style={secundario}>No hay compras con estos filtros.</Text>
      }
      ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={c.brand} /> : null}
    />
  )

  const listaBorradores = (
    <FlatList<BorradorCompra>
      data={l.borradores}
      keyExtractor={(b) => b.id}
      contentContainerStyle={{ padding: space[4], gap: space[3] }}
      ListHeaderComponent={<Notice tone="info">Los borradores se guardan solos mientras cargás una compra. Tocá uno para seguirlo.</Notice>}
      renderItem={({ item: b }) => {
        const pie = `${b.cantidadLineas} ${b.cantidadLineas === 1 ? 'línea' : 'líneas'} · Guardado ${tituloDelDia(new Date(b.fechaModificacion)).toLowerCase()} ${horaDe(b.fechaModificacion)}`
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${b.proveedorNombre}, ${pie}`}
            onPress={() => router.push(`/(tabs)/compras/nueva?borrador=${b.id}` as never)}
            style={({ pressed }) => ({ minHeight: 44, padding: space[4], borderRadius: radii.tarjeta, backgroundColor: pressed ? c.surface2 : c.surface, gap: space[1] })}
          >
            <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>{b.proveedorNombre}</Text>
            <Text style={secundario}>{pie}</Text>
          </Pressable>
        )
      }}
      ListEmptyComponent={
        l.borradoresQuery.isLoading ? <ActivityIndicator color={c.brand} />
          : l.borradoresQuery.isError ? <Notice tone="peligro">No se pudieron cargar los borradores.</Notice>
          : <Text style={secundario}>No tenés borradores.</Text>
      }
    />
  )

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar
        title="Compras"
        leading={leading}
        tabs={PESTANAS.map((p) => ({ label: p.label, selected: p.key === l.pestana, onPress: () => { l.setPestana(p.key); setElegida(null) } }))}
      />
      <TwoPane
        list={
          <View style={{ flex: 1 }}>
            {l.pestana === 'borradores' ? listaBorradores : listaCompras}
            {/* En teléfono la compra nueva sale del "+" de la barra de accesos rápidos. */}
            {isTablet && canDo('MOD_COMPRAS', 'create') ? (
              <Fab accessibilityLabel="Nueva compra" onPress={() => router.push('/(tabs)/compras/nueva' as never)} />
            ) : null}
          </View>
        }
        detail={isTabletLandscape && elegida ? detalle(elegida, () => setElegida(null)) : null}
        emptyDetail={<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[6] }}><Text style={secundario}>Elegí una compra para ver el detalle.</Text></View>}
      />
    </View>
  )
}
