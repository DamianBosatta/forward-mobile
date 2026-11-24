import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, SectionList, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { usePermissions } from '@/core/auth/RequirePermission'
import {
  Button, DocumentCard, Entrada, Field, Notice, Segmented, TopBar, TwoPane, chipForEstado, formatImporte, useMenuLeading,
  type SegmentedOption, useInsetInferior } from '@/core/ui/fw'
import { FiltroChip } from '@/core/ui/fw/FiltroChip'
import { PressableFx } from '@/core/ui/fw/PressableFx'
import { LISTA_LARGA_PROPS } from '@/core/ui/listaLargaProps'
import { textoSinConexion } from '@/core/ui/fw/EstadoDePantalla'
import { EstadoDeConsulta, FILAS_CARGANDO } from '@/core/ui/estados'
import { esFallaDeRed } from '@/core/api/errores'
import { importe as cifras, radii, space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import type { Venta } from '@/libs/api-client'
import type { BorradorVenta } from '@/libs/api-client/ventas'
import type { FiltroVentasRuta } from '@/features/listas/lib/filtroDeRuta'
import { agruparPorDia, entregaDe, horaDe } from '../lib/agruparPorDia'
import { identidadDeBorrador } from '../lib/borradorCliente'
import { useSinConexionSinDatos } from '../lib/sinConexion'
import { ListaBorradores } from './ListaBorradores'
import { Fab } from '@/core/ui/fw/Fab'
import { esEstadoVenta } from '@/core/constants/estados'
import { motivosDe } from '@/features/autorizaciones/lib/motivos'
import { useVentasListaNueva, type FiltroEstado, type PeriodoVentas, type PestanaVentas } from '../hooks/useVentasListaNueva'

const PESTANAS: SegmentedOption<PestanaVentas>[] = [
  { value: 'pedidos', label: 'Pedidos' },
  { value: 'presupuestos', label: 'Presupuestos' },
  { value: 'borradores', label: 'Borradores' },
]
const PERIODOS: { value: PeriodoVentas; label: string }[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: 'todo', label: 'Todo' },
]
const ESTADOS: { value: FiltroEstado; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'Pendiente', label: 'Pendiente' },
  { value: 'PendienteAutorizacion', label: 'Por autorizar' },
  { value: 'Confirmada', label: 'Confirmado' },
  { value: 'EnRuta', label: 'En ruta' },
  { value: 'Entregada', label: 'Entregado' },
  { value: 'Anulada', label: 'Anulado' },
]

/** El cliente se identifica por la dirección; el nombre va en línea aparte. */
function clienteDe(v: Venta): { direccion: string; nombre: string | null } {
  const nombre = v.nombreFantasiaCliente?.trim() || v.razonSocialCliente
  const direccion = v.direccionCliente?.trim()
  return direccion ? { direccion, nombre } : { direccion: nombre, nombre: null }
}

/**
 * Lo que va al lado de la hora: anulada, el motivo de anulación; por autorizar, el motivo (el
 * primero y cuántos más); si no, el día de entrega. Un servidor anterior no manda los motivos: el
 * día de entrega o solo la hora.
 */
function detalleDe(v: Venta): string | undefined {
  // El servidor solo lo manda con la venta anulada (9B, prioridad 3).
  const anulacion = v.motivoAnulacion?.trim()
  if (anulacion) return anulacion
  // El servidor solo lo manda mientras la venta espera autorización.
  const motivos = motivosDe(v.motivoPendienteAutorizacion)
  if (motivos.length) return `${motivos[0]!.texto}${motivos.length > 1 ? ` (+${motivos.length - 1})` : ''}`
  // Una venta ya entregada no tiene día de entrega por delante: "Entrega mañana" la contradice.
  if (esEstadoVenta(v.estado, 'Entregada')) return undefined
  return entregaDe(v.fechaEntrega) || undefined
}

/** Lo que queda por cobrar de un pedido en pie; null si no hay deuda o la venta no cuenta como plata. */
function saldoDe(v: Venta): number | null {
  if (esEstadoVenta(v.estado, 'Anulada', 'RechazadaAutorizacion')) return null
  return typeof v.saldo === 'number' && v.saldo > 0 ? v.saldo : null
}

/** El pie de la tarjeta: el saldo, si lo hay, y a continuación el detalle (motivo o día de entrega). */
function pieDe(v: Venta): string | undefined {
  const saldo = saldoDe(v)
  const detalle = detalleDe(v)
  if (saldo === null) return detalle
  return [`Saldo ${formatImporte(saldo)}`, detalle].filter(Boolean).join(' · ')
}

interface Props {
  /** Detalle embebido para el panel derecho en tablet horizontal. */
  detalle: (id: string, cerrar: () => void) => React.ReactNode
  /** El filtro con que la abrió una fila de Inicio. */
  filtroDeRuta?: FiltroVentasRuta | null
}

/** Fila memoizada: no se vuelve a pintar mientras la venta y `onAbrir` no cambien. */
const FilaVenta = memo(function FilaVenta({ v, indice, onAbrir }: { v: Venta; indice: number; onAbrir: (id: string) => void }) {
  return (
    <Entrada tipo="fila" indice={indice} style={{ marginBottom: space[3] }}>
      <DocumentCard
        numero={v.codigoPedido ?? v.id.slice(0, 8).toUpperCase()}
        vendedor={v.vendedorNombre}
        {...clienteDe(v)}
        hora={horaDe(v.fecha)}
        detalle={pieDe(v)}
        importe={v.totalAmount}
        chip={chipForEstado('venta', v.estado)}
        onPress={() => onAbrir(v.id)}
      />
    </Entrada>
  )
})

/** Lista de ventas con el formato nuevo (láminas Ventas y TabVentas). Detrás del switch de la venta nueva. */
export function ListaVentasNueva({ detalle, filtroDeRuta = null }: Props) {
  const insetInferior = useInsetInferior()
  const c = useColors()
  const router = useRouter()
  const leading = useMenuLeading()
  const { isTabletLandscape, isTablet } = useResponsive()
  const { canDo } = usePermissions()
  const [elegida, setElegida] = useState<string | null>(null)
  const l = useVentasListaNueva(filtroDeRuta)
  const q = l.ventasQuery
  // Tablet: si el filtro (también el que llega de Inicio) saca la venta abierta, se cierra su detalle.
  useEffect(() => {
    if (elegida && q.data && !q.isFetching && !l.ventas.some((v) => v.id === elegida)) setElegida(null)
  }, [elegida, q.data, q.isFetching, l.ventas])

  const abrir = useCallback((id: string) => {
    if (isTabletLandscape) setElegida(id)
    else router.push(`/(tabs)/ventas/${id}` as never)
  }, [isTabletLandscape, router])
  const secciones = useMemo(() => agruparPorDia(l.ventas, (v) => v.fecha), [l.ventas])
  const renderVenta = useCallback(({ item, index }: { item: Venta; index: number }) => <FilaVenta v={item} indice={index} onAbrir={abrir} />, [abrir])

  // Desde forward-system #883 el borrador guarda si se armaba un pedido o un presupuesto y se retoma
  // como tal. Un servidor anterior no lo manda (todo borrador es presupuesto ahí): se pregunta.
  const retomar = (b: BorradorVenta) => {
    const ir = (tipo: 'Pedido' | 'Presupuesto') => router.push(`/(tabs)/ventas/nueva?borrador=${b.id}&tipo=${tipo}` as never)
    if (b.tipoOperacion === 'Pedido' || b.tipoOperacion === 'Presupuesto') return ir(b.tipoOperacion)
    Alert.alert('Retomar borrador', identidadDeBorrador(b).titulo, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Como presupuesto', onPress: () => ir('Presupuesto') },
      { text: 'Como pedido', onPress: () => ir('Pedido') },
    ])
  }

  const secundario = [typeScale.secundario, { color: c.textSecondary }]
  const esBorradores = l.pestana === 'borradores'
  const sinRed = esFallaDeRed(q.error)
  const reintentar = { label: 'Reintentar', onPress: () => { void l.refrescar() } }
  const bq = l.borradoresQuery
  // Sin red y sin nada guardado la consulta queda en pausa (sin error): también es "sin conexión".
  const ventasEnPausa = useSinConexionSinDatos(q)
  const borradoresEnPausa = useSinConexionSinDatos(bq)
  const ventasSinConexion = (q.isError && sinRed) || ventasEnPausa
  const borradoresSinConexion = (bq.isError && esFallaDeRed(bq.error)) || borradoresEnPausa

  const contadorPorAutorizar = l.estado === 'todos' && l.totales && l.totales.porAutorizar > 0 ? l.totales.porAutorizar : null
  const filtros = (
    <View style={{ gap: space[3], paddingBottom: space[2] }}>
      <Field label="Buscar" placeholder="Cliente o número" value={l.busqueda} onChangeText={l.setBusqueda} autoCorrect={false} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Período" contentContainerStyle={{ gap: space[2] }}>
        {PERIODOS.map((p) => <FiltroChip key={p.value} label={p.label} activo={p.value === l.periodo} onPress={() => l.setPeriodo(p.value)} />)}
      </ScrollView>
      {/* La barra queda a la vista en Android: sin ella, el último chip cortado no dice que la fila se desliza. */}
      <ScrollView horizontal showsHorizontalScrollIndicator persistentScrollbar accessibilityRole="radiogroup" accessibilityLabel="Estado" contentContainerStyle={{ gap: space[2] }}>
        {ESTADOS.map((e) => {
          const sel = e.value === l.estado
          return (
            <PressableFx
              key={e.value}
              accessibilityRole="radio"
              accessibilityLabel={e.label}
              accessibilityState={{ selected: sel }}
              onPress={() => l.setEstado(e.value)}
              android_ripple={{ color: c.surfaceAlt }}
              style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space[2], justifyContent: 'center', paddingHorizontal: space[4], borderRadius: radii.pastilla, backgroundColor: sel ? c.primaryBg : c.surface }}
            >
              <Text style={[typeScale.etiquetaChip, { color: sel ? c.primaryFg : c.text }]}>{e.label}</Text>
              {e.value === 'PendienteAutorizacion' && contadorPorAutorizar ? (
                <View style={{ minWidth: 20, height: 20, paddingHorizontal: space[1], borderRadius: radii.pastilla, alignItems: 'center', justifyContent: 'center', backgroundColor: c.warning }}>
                  <Text style={[typeScale.etiquetaChip, cifras, { color: c.onState }]}>{contadorPorAutorizar}</Text>
                </View>
              ) : null}
            </PressableFx>
          )
        })}
      </ScrollView>
      {l.totales ? (
        <View testID="totales-lista" style={{ gap: space[3], padding: space[5], borderRadius: radii.tarjetaGrande, backgroundColor: c.lime }}>
          <Text style={[typeScale.secundario, { color: c.ink }]}>{l.totales.rotulo}</Text>
          <Text style={[typeScale.titulo, cifras, { color: c.ink }]}>{l.totales.importe}</Text>
          {l.totales.porAutorizar > 0 ? (
            <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: space[2], paddingHorizontal: space[3], minHeight: 32, borderRadius: radii.pastilla, backgroundColor: c.ink }}>
              <View style={{ width: 10, height: 10, borderRadius: radii.pastilla, backgroundColor: c.warning }} />
              <Text style={[typeScale.etiquetaChip, { color: c.lime }]}>{`${l.totales.porAutorizar} por autorizar`}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      {l.contador ? <Text style={secundario}>{l.contador}</Text> : null}
      {/* Con ventas a la vista el error va arriba de ellas; sin red y sin nada que mostrar, la pantalla entera (abajo). */}
      {q.isError && !(sinRed && l.ventas.length === 0) ? (
        <View style={{ gap: space[2] }}>
          {sinRed ? (
            <Notice tone="advertencia">{textoSinConexion(q.dataUpdatedAt || undefined)}</Notice>
          ) : (
            <Notice tone="peligro">No se pudieron cargar las ventas.</Notice>
          )}
          <Button label={reintentar.label} variant="secundario" onPress={reintentar.onPress} />
        </View>
      ) : null}
    </View>
  )

  const listaVentas = (
    <SectionList {...LISTA_LARGA_PROPS}
      sections={secciones}
      keyExtractor={(v) => v.id}
      ListHeaderComponent={filtros}
      contentContainerStyle={{ padding: space[4], paddingBottom: space[12] * 2 + insetInferior }}
      renderSectionHeader={({ section }) => (
        <Text accessibilityRole="header" style={[typeScale.cuerpoDestacado, { color: c.text, backgroundColor: c.bg, paddingVertical: space[2] }]}>{section.titulo}</Text>
      )}
      renderItem={renderVenta}
      onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage() }}
      onEndReachedThreshold={0.4}
      refreshing={q.isRefetching}
      onRefresh={() => { void l.refrescar() }}
      ListEmptyComponent={
        // Con error del servidor el aviso va arriba (filtros); sin red y sin ventas, la pantalla entera.
        <EstadoDeConsulta
          cargando={q.isLoading}
          esqueleto={FILAS_CARGANDO}
          sinConexion={ventasSinConexion}
          error={ventasSinConexion ? q.error : undefined}
          tituloError="No pudimos cargar las ventas"
          onReintentar={reintentar.onPress}
          vacio={!q.isError}
          tituloVacio="No hay ventas con estos filtros."
        />
      }
      ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={c.brand} /> : undefined}
    />
  )

  const listaBorradores = (
    <ListaBorradores
      borradores={l.borradores}
      cargando={bq.isLoading}
      error={bq.isError}
      sinConexion={borradoresSinConexion}
      onReintentar={() => { void bq.refetch() }}
      onSeguir={retomar}
    />
  )

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Ventas" leading={leading} />
      <View style={{ paddingHorizontal: space[4], paddingTop: space[3] }}>
        <Segmented accessibilityLabel="Pestaña" options={PESTANAS} value={l.pestana} onChange={(p) => { l.setPestana(p); setElegida(null) }} />
      </View>
      <TwoPane
        list={esBorradores ? listaBorradores : listaVentas}
        detail={isTabletLandscape && elegida ? detalle(elegida, () => setElegida(null)) : null}
        emptyDetail={<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[6] }}><Text style={secundario}>Elegí una venta para ver el detalle.</Text></View>}
      />
      {/* En teléfono la venta nueva sale del botón central de la barra inferior (NuevaVentaCentral): acá no se repite.
          En tablet no hay barra inferior, así que el botón sigue acá; pide elegir el cliente primero. */}
      {/* Con una venta abierta en el panel el botón taparía su barra de acciones (Cobrar, Total): se oculta. */}
      {isTablet && !(isTabletLandscape && elegida) && canDo('MOD_VENTAS', 'create') ? <Fab accessibilityLabel="Nueva venta" label="Nueva venta" onPress={() => router.push('/(tabs)/ventas/nueva' as never)} /> : null}
    </View>
  )
}
