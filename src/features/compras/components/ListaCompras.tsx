import { LISTA_LARGA_PROPS } from '@/core/ui/listaLargaProps'
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, ScrollView, SectionList, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import {
  Button, DocumentCard, Fab, Field, Notice, Segmented, TopBar, TwoPane, chipForEstado, useMenuLeading,
  type SegmentedOption, useInsetInferior } from '@/core/ui/fw'
import { FiltroChip } from '@/core/ui/fw/FiltroChip'
import { EstadoDePantalla, textoSinConexion } from '@/core/ui/fw/EstadoDePantalla'
import { esFallaDeRed } from '@/core/api/errores'
import { useSinConexionSinDatos } from '@/features/ventas/lib/sinConexion'
import { Esqueletos, FILAS_CARGANDO } from '@/features/clientes/components/Esqueletos'
import { importe as cifras, radii, space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { usePermissions } from '@/core/auth/RequirePermission'
import type { CompraDtoList } from '@/libs/api-client'
import type { BorradorCompra } from '@/libs/api-client/compras'
import { agruparPorDia, horaDe, tituloDelDia } from '@/features/ventas/lib/agruparPorDia'
import { useComprasList, type PeriodoCompras, type PestanaCompras } from '../hooks/useComprasList'
import { fechaHoraTexto, llegaTexto } from '../lib/fecha'
import type { EstadoCompraRuta } from '@/features/listas/lib/filtroDeRuta'
import { numeroDeCompra } from '../lib/numero'

const PESTANAS: SegmentedOption<PestanaCompras>[] = [
  { value: 'pendientes', label: 'Pendientes' },
  { value: 'recibidas', label: 'Recibidas' },
  { value: 'borradores', label: 'Borradores' },
]
const PERIODOS: SegmentedOption<PeriodoCompras>[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: 'todo', label: 'Todo' },
]

const ESTADOS_PENDIENTES: { value: EstadoCompraRuta | null; label: string }[] = [
  { value: null, label: 'Todas' },
  { value: 'NotaPedido', label: 'Notas de pedido' },
  { value: 'Confirmado', label: 'Por recibir' },
]

const productos = (n: number) => `${n} ${n === 1 ? 'producto' : 'productos'}`

/** Fila memoizada: no se vuelve a pintar mientras la compra y `onAbrir` no cambien. */
const FilaCompra = memo(function FilaCompra({ x, onAbrir }: { x: CompraDtoList; onAbrir: (id: string) => void }) {
  return (
    <View style={{ marginBottom: space[3] }}>
      <DocumentCard
        plano
        numero={numeroDeCompra(x)}
        vendedor={x.creadoPor ?? x.nombreDeposito}
        direccion={x.razonSocialProveedor}
        nombre={[`${numeroDeCompra(x)} · ${x.creadoPor ?? x.nombreDeposito}`, llegaTexto(x.fechaEsperadaRecepcion)].filter(Boolean).join(' · ')}
        hora={horaDe(x.fecha)}
        fechaHora={fechaHoraTexto(x.fecha)}
        detalle={productos(x.itemsCount ?? 0)}
        importe={x.totalAmount}
        chip={chipForEstado('compra', x.estado)}
        onPress={() => onAbrir(x.id)}
      />
    </View>
  )
})

/** Fila memoizada de un borrador: no se vuelve a pintar mientras el borrador y `onAbrir` no cambien. */
const FilaBorrador = memo(function FilaBorrador({ b, onAbrir }: { b: BorradorCompra; onAbrir: (id: string) => void }) {
  const c = useColors()
  const pie = `${b.cantidadLineas} ${b.cantidadLineas === 1 ? 'línea' : 'líneas'} · Guardado ${tituloDelDia(new Date(b.fechaModificacion)).toLowerCase()} ${horaDe(b.fechaModificacion)}`
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${b.proveedorNombre}, ${pie}`}
      onPress={() => onAbrir(b.id)}
      android_ripple={{ color: c.surface2 }}
      style={{ minHeight: 44, padding: space[5], borderRadius: radii.fila, backgroundColor: c.surface, gap: space[1], overflow: 'hidden' }}
    >
      <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>{b.proveedorNombre}</Text>
      <Text style={[typeScale.secundario, { color: c.textSecondary }]}>{pie}</Text>
    </Pressable>
  )
})

interface Props {
  /** Detalle embebido para el panel derecho en tablet horizontal. */
  detalle: (id: string, cerrar: () => void) => React.ReactNode
  /** El estado con que la abrió una fila de Inicio. */
  estadoDeRuta?: EstadoCompraRuta | null
}

/** Lista de compras con el formato nuevo (láminas Compras y TabCompras). */
export function ListaCompras({ detalle, estadoDeRuta = null }: Props) {
  const insetInferior = useInsetInferior()
  const c = useColors()
  const router = useRouter()
  const leading = useMenuLeading()
  const { isTabletLandscape } = useResponsive()
  const { canDo } = usePermissions()
  const [elegida, setElegida] = useState<string | null>(null)
  const l = useComprasList(estadoDeRuta)
  const q = l.comprasQuery
  // Tablet: si el filtro (también el que llega de Inicio) saca la compra abierta, se cierra su detalle.
  useEffect(() => {
    if (elegida && q.data && !q.isFetching && !q.isPlaceholderData && !l.compras.some((x) => x.id === elegida)) setElegida(null)
  }, [elegida, q.data, q.isFetching, q.isPlaceholderData, l.compras])

  const abrir = useCallback((id: string) => {
    if (isTabletLandscape) setElegida(id)
    else router.push(`/(tabs)/compras/${id}` as never)
  }, [isTabletLandscape, router])
  const abrirBorrador = useCallback((id: string) => router.push(`/(tabs)/compras/nueva?borrador=${id}` as never), [router])
  const secciones = useMemo(() => agruparPorDia(l.compras, (x) => x.fecha), [l.compras])
  const renderCompra = useCallback(({ item }: { item: CompraDtoList }) => <FilaCompra x={item} onAbrir={abrir} />, [abrir])
  const renderBorrador = useCallback(({ item }: { item: BorradorCompra }) => <FilaBorrador b={item} onAbrir={abrirBorrador} />, [abrirBorrador])

  const secundario = [typeScale.secundario, { color: c.textSecondary }]
  const sinRed = esFallaDeRed(q.error)
  const reintentar = { label: 'Reintentar', onPress: () => { void l.refrescar() } }
  const bq = l.borradoresQuery
  // Sin red y sin nada guardado la consulta queda en pausa (sin error): también es "sin conexión".
  const comprasEnPausa = useSinConexionSinDatos(q)
  const borradoresEnPausa = useSinConexionSinDatos(bq)
  const comprasSinConexion = (q.isError && sinRed) || comprasEnPausa
  const borradoresSinRed = (bq.isError && esFallaDeRed(bq.error)) || borradoresEnPausa
  const reintentarBorradores = { label: 'Reintentar', onPress: () => { void bq.refetch() } }

  const filtros = (
    <View style={{ gap: space[3], paddingBottom: space[2] }}>
      <Field label="Buscar" placeholder="Proveedor o número" value={l.busqueda} onChangeText={l.setBusqueda} autoCorrect={false} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Período" contentContainerStyle={{ gap: space[2] }}>
        {PERIODOS.map((p) => <FiltroChip key={p.value} label={p.label} activo={p.value === l.periodo} onPress={() => l.setPeriodo(p.value)} />)}
      </ScrollView>
      {l.pestana === 'pendientes' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" accessibilityLabel="Estado" contentContainerStyle={{ gap: space[2] }}>
          {ESTADOS_PENDIENTES.map((e) => {
            const sel = e.value === l.soloEstado
            return (
              <FiltroChip key={e.label} rol="radio" label={e.label} activo={sel} onPress={() => l.setSoloEstado(e.value)} />
            )
          })}
        </ScrollView>
      ) : null}
      {l.tarjeta ? (
        <View testID="totales-lista" style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space[3], padding: space[5], borderRadius: radii.tarjetaGrande, backgroundColor: c.lime }}>
          <View style={{ flexShrink: 1 }}>
            <Text style={[typeScale.secundario, { color: c.ink }]}>{l.tarjeta.rotulo}</Text>
            <Text style={[typeScale.numeroProtagonista, cifras, { color: c.ink }]}>{l.tarjeta.importe}</Text>
          </View>
          <Text style={[typeScale.etiqueta, { color: c.text, paddingHorizontal: space[3], paddingVertical: space[1], borderRadius: radii.pastilla, backgroundColor: c.surfaceAlt }]}>{l.tarjeta.cuenta}</Text>
        </View>
      ) : null}
      {l.contador ? <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>{l.contador}</Text> : null}
      {l.resumenTexto ? <Text style={secundario}>{l.resumenTexto}</Text> : null}
      {l.compradoTexto ? <Text style={secundario}>{l.compradoTexto}</Text> : null}
      {/* Con compras a la vista el error va arriba de ellas; sin red y sin nada que mostrar, la pantalla entera (abajo). */}
      {q.isError && !(sinRed && l.compras.length === 0) ? (
        <View style={{ gap: space[2] }}>
          {sinRed ? (
            <Notice tone="advertencia">{textoSinConexion(q.dataUpdatedAt || undefined)}</Notice>
          ) : (
            <Notice tone="peligro">No se pudieron cargar las compras.</Notice>
          )}
          <Button label={reintentar.label} variant="secundario" onPress={reintentar.onPress} />
        </View>
      ) : null}
    </View>
  )

  const listaCompras = (
    <SectionList {...LISTA_LARGA_PROPS}
      sections={secciones}
      keyExtractor={(x) => x.id}
      ListHeaderComponent={filtros}
      contentContainerStyle={{ padding: space[4], paddingBottom: space[12] * 2 + insetInferior }}
      renderSectionHeader={({ section }) => (
        <Text accessibilityRole="header" style={[typeScale.cuerpoDestacado, { color: c.textSecondary, backgroundColor: c.bg, paddingVertical: space[2] }]}>{section.titulo}</Text>
      )}
      renderItem={renderCompra}
      onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage() }}
      onEndReachedThreshold={0.4}
      refreshing={q.isRefetching}
      onRefresh={() => { void l.refrescar() }}
      ListEmptyComponent={
        q.isLoading ? <Esqueletos bloques={FILAS_CARGANDO} />
          : comprasSinConexion ? <EstadoDePantalla tipo="sinConexion" titulo="No pudimos cargar las compras" accion={reintentar} />
          : q.isError ? undefined
          : <EstadoDePantalla tipo="vacio" titulo="No hay compras con estos filtros." />
      }
      ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={c.brand} /> : undefined}
    />
  )

  const listaBorradores = (
    <FlatList<BorradorCompra> {...LISTA_LARGA_PROPS}
      data={l.borradores}
      keyExtractor={(b) => b.id}
      contentContainerStyle={{ padding: space[4], paddingBottom: space[4] + insetInferior, gap: space[3] }}
      ListHeaderComponent={<Notice tone="info">Los borradores se guardan solos mientras cargás una compra. Tocá uno para seguirlo.</Notice>}
      renderItem={renderBorrador}
      ListEmptyComponent={
        bq.isLoading ? <Esqueletos bloques={FILAS_CARGANDO} />
          : borradoresSinRed ? (
            <EstadoDePantalla tipo="sinConexion" titulo="No pudimos cargar los borradores" accion={reintentarBorradores} />
          ) : bq.isError ? (
            <View style={{ gap: space[2] }}>
              <Notice tone="peligro">No se pudieron cargar los borradores.</Notice>
              <Button label={reintentarBorradores.label} variant="secundario" onPress={reintentarBorradores.onPress} />
            </View>
          )
          : <EstadoDePantalla tipo="vacio" titulo="No tenés borradores." />
      }
    />
  )

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Compras" leading={leading} />
      <View style={{ paddingHorizontal: space[4], paddingTop: space[3] }}>
        <Segmented accessibilityLabel="Pestaña" options={PESTANAS} value={l.pestana} onChange={(p) => { l.setPestana(p); setElegida(null) }} />
      </View>
      <TwoPane
        list={
          <View style={{ flex: 1 }}>
            {l.pestana === 'borradores' ? listaBorradores : listaCompras}
            {/* La barra de accesos rápidos ya no trae el "+" (lámina CalleMiDia): la compra nueva sale de acá, en teléfono y en tablet. */}
            {canDo('MOD_COMPRAS', 'create') ? (
              <Fab accessibilityLabel="Nueva compra" label="Nueva compra" onPress={() => router.push('/(tabs)/compras/nueva' as never)} />
            ) : null}
          </View>
        }
        detail={isTabletLandscape && elegida ? detalle(elegida, () => setElegida(null)) : null}
        emptyDetail={<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[6] }}><Text style={secundario}>Elegí una compra para ver el detalle.</Text></View>}
      />
    </View>
  )
}
