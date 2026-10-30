import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, SectionList, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { usePermissions } from '@/core/auth/RequirePermission'
import {
  DocumentCard, Field, Notice, Segmented, StatusChip, TopBar, TwoPane, chipForEstado, useMenuLeading,
  type SegmentedOption,
} from '@/core/ui/fw'
import { FiltroChip } from '@/core/ui/fw/FiltroChip'
import { importe as cifras, radii, space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import type { Venta } from '@/libs/api-client'
import type { BorradorVenta } from '@/libs/api-client/ventas'
import type { FiltroVentasRuta } from '@/features/listas/lib/filtroDeRuta'
import { agruparPorDia, entregaDe, horaDe } from '../lib/agruparPorDia'
import { identidadDeBorrador } from '../lib/borradorCliente'
import { ListaBorradores } from './ListaBorradores'
import { Fab } from '@/core/ui/fw/Fab'
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
  return entregaDe(v.fechaEntrega) || undefined
}

interface Props {
  /** Detalle embebido para el panel derecho en tablet horizontal. */
  detalle: (id: string, cerrar: () => void) => React.ReactNode
  /** El filtro con que la abrió una fila de Inicio. */
  filtroDeRuta?: FiltroVentasRuta | null
}

/** Lista de ventas con el formato nuevo (láminas Ventas y TabVentas). Detrás del switch de la venta nueva. */
export function ListaVentasNueva({ detalle, filtroDeRuta = null }: Props) {
  const c = useColors()
  const router = useRouter()
  const leading = useMenuLeading()
  const { isTabletLandscape } = useResponsive()
  const { canDo } = usePermissions()
  const [elegida, setElegida] = useState<string | null>(null)
  const l = useVentasListaNueva(filtroDeRuta)
  const q = l.ventasQuery
  // Tablet: si el filtro (también el que llega de Inicio) saca la venta abierta, se cierra su detalle.
  useEffect(() => {
    if (elegida && q.data && !q.isFetching && !l.ventas.some((v) => v.id === elegida)) setElegida(null)
  }, [elegida, q.data, q.isFetching, l.ventas])

  const abrir = (id: string) => {
    if (isTabletLandscape) setElegida(id)
    else router.push(`/(tabs)/ventas/${id}` as never)
  }

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

  const contadorPorAutorizar = l.estado === 'todos' && l.totales && l.totales.porAutorizar > 0 ? l.totales.porAutorizar : null
  const filtros = (
    <View style={{ gap: space[3], paddingBottom: space[2] }}>
      <Field label="Buscar" placeholder="Cliente o número" value={l.busqueda} onChangeText={l.setBusqueda} autoCorrect={false} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Período" contentContainerStyle={{ gap: space[2] }}>
        {PERIODOS.map((p) => <FiltroChip key={p.value} label={p.label} activo={p.value === l.periodo} onPress={() => l.setPeriodo(p.value)} />)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" accessibilityLabel="Estado" contentContainerStyle={{ gap: space[2] }}>
        {ESTADOS.map((e) => {
          const sel = e.value === l.estado
          return (
            <Pressable
              key={e.value}
              accessibilityRole="radio"
              accessibilityLabel={e.label}
              accessibilityState={{ selected: sel }}
              onPress={() => l.setEstado(e.value)}
              style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space[1], justifyContent: 'center', paddingHorizontal: space[4], borderRadius: radii.pastilla, borderWidth: 1, borderColor: sel ? c.brand : c.border, backgroundColor: sel ? c.brandSoft : c.surface }}
            >
              <Text style={[typeScale.secundario, { color: sel ? c.brandInk : c.text }]}>{e.label}</Text>
              {e.value === 'PendienteAutorizacion' && contadorPorAutorizar ? (
                <Text style={[typeScale.secundario, cifras, { color: c.textSecondary }]}>{contadorPorAutorizar}</Text>
              ) : null}
            </Pressable>
          )
        })}
      </ScrollView>
      {l.totales ? (
        <View testID="totales-lista" style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space[3], padding: space[4], borderRadius: radii.tarjeta, backgroundColor: c.surface }}>
          <View style={{ flexShrink: 1 }}>
            <Text style={secundario}>{l.totales.rotulo}</Text>
            <Text style={[typeScale.titulo, cifras, { color: c.text }]}>{l.totales.importe}</Text>
          </View>
          {l.totales.porAutorizar > 0 ? <StatusChip estado="porAutorizar" label={`${l.totales.porAutorizar} por autorizar`} /> : null}
        </View>
      ) : null}
      {l.contador ? <Text style={secundario}>{l.contador}</Text> : null}
    </View>
  )

  const listaVentas = (
    <SectionList
      sections={agruparPorDia(l.ventas, (v) => v.fecha)}
      keyExtractor={(v) => v.id}
      ListHeaderComponent={filtros}
      contentContainerStyle={{ padding: space[4], paddingBottom: space[12] * 2 }}
      renderSectionHeader={({ section }) => (
        <Text accessibilityRole="header" style={[typeScale.cuerpoDestacado, { color: c.text, backgroundColor: c.bg, paddingVertical: space[2] }]}>{section.titulo}</Text>
      )}
      renderItem={({ item: v }) => (
        <View style={{ marginBottom: space[3] }}>
          <DocumentCard
            numero={v.codigoPedido ?? v.id.slice(0, 8).toUpperCase()}
            vendedor={v.vendedorNombre}
            {...clienteDe(v)}
            hora={horaDe(v.fecha)}
            detalle={detalleDe(v)}
            importe={v.totalAmount}
            chip={chipForEstado('venta', v.estado)}
            onPress={() => abrir(v.id)}
          />
        </View>
      )}
      onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage() }}
      onEndReachedThreshold={0.4}
      refreshing={q.isRefetching}
      onRefresh={() => { void l.refrescar() }}
      ListEmptyComponent={
        q.isLoading ? <ActivityIndicator color={c.brand} />
          : q.isError ? <Notice tone="peligro">No se pudieron cargar las ventas. Deslizá hacia abajo para reintentar.</Notice>
          : <Text style={secundario}>No hay ventas con estos filtros.</Text>
      }
      ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={c.brand} /> : null}
    />
  )

  const listaBorradores = (
    <ListaBorradores
      borradores={l.borradores}
      cargando={l.borradoresQuery.isLoading}
      error={l.borradoresQuery.isError}
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
      {/* La venta nueva sale de este botón, en teléfono y en tablet; pide elegir el cliente primero. */}
      {canDo('MOD_VENTAS', 'create') ? <Fab accessibilityLabel="Nueva venta" label="Nueva venta" onPress={() => router.push('/(tabs)/ventas/nueva' as never)} /> : null}
    </View>
  )
}
