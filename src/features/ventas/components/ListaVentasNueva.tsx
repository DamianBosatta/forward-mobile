import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, SectionList, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Plus } from 'lucide-react-native'
import { usePermissions } from '@/core/auth/RequirePermission'
import {
  DocumentCard, Field, Notice, Segmented, TopBar, TwoPane, chipForEstado, useMenuLeading,
  type SegmentedOption,
} from '@/core/ui/fw'
import { importe as cifras, radii, space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import type { Venta } from '@/libs/api-client'
import type { BorradorVenta } from '@/libs/api-client/ventas'
import type { FiltroVentasRuta } from '@/features/listas/lib/filtroDeRuta'
import { agruparPorDia, entregaDe, horaDe, tituloDelDia } from '../lib/agruparPorDia'
import { identidadDeBorrador } from '../lib/borradorCliente'
import { motivosDe } from '@/features/autorizaciones/lib/motivos'
import { useVentasListaNueva, type FiltroEstado, type PeriodoVentas, type PestanaVentas } from '../hooks/useVentasListaNueva'

const PESTANAS: { key: PestanaVentas; label: string }[] = [
  { key: 'presupuestos', label: 'Presupuestos' },
  { key: 'pedidos', label: 'Pedidos' },
  { key: 'borradores', label: 'Borradores' },
]
const PERIODOS: SegmentedOption<PeriodoVentas>[] = [
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
 * Lo que va al lado de la hora: por autorizar, el motivo (el primero y cuántos más); si no, el día
 * de entrega. Un servidor anterior a forward-system #884 no manda ninguno de los dos: solo la hora.
 */
function detalleDe(v: Venta): string | undefined {
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
  const { isTablet, isTabletLandscape } = useResponsive()
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

  // El borrador es siempre un presupuesto en el servidor: al retomarlo se elige qué va a ser.
  const retomar = (b: BorradorVenta) => {
    const ir = (tipo: 'Pedido' | 'Presupuesto') => router.push(`/(tabs)/ventas/nueva-v2?borrador=${b.id}&tipo=${tipo}` as never)
    Alert.alert('Retomar borrador', identidadDeBorrador(b).titulo, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Como presupuesto', onPress: () => ir('Presupuesto') },
      { text: 'Como pedido', onPress: () => ir('Pedido') },
    ])
  }

  const secundario = [typeScale.secundario, { color: c.textSecondary }]
  const esBorradores = l.pestana === 'borradores'

  const filtros = (
    <View style={{ gap: space[3], paddingBottom: space[2] }}>
      <Field label="Buscar" placeholder="Cliente o número" value={l.busqueda} onChangeText={l.setBusqueda} autoCorrect={false} />
      <Segmented accessibilityLabel="Período" options={PERIODOS} value={l.periodo} onChange={l.setPeriodo} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" accessibilityLabel="Estado" contentContainerStyle={{ gap: space[2] }}>
        {ESTADOS.map((e) => {
          const sel = e.value === l.estado
          return (
            <Pressable
              key={e.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: sel }}
              onPress={() => l.setEstado(e.value)}
              style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: space[4], borderRadius: radii.pastilla, borderWidth: 1, borderColor: sel ? c.brand : c.border, backgroundColor: sel ? c.brandSoft : c.surface }}
            >
              <Text style={[typeScale.secundario, { color: sel ? c.brandInk : c.text }]}>{e.label}</Text>
            </Pressable>
          )
        })}
      </ScrollView>
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
    <FlatList<BorradorVenta>
      data={l.borradores}
      keyExtractor={(b) => b.id}
      contentContainerStyle={{ padding: space[4], gap: space[3] }}
      ListHeaderComponent={<Notice tone="info">Los borradores se guardan solos y se descartan a las 48 h sin cambios. Tocá uno para seguirlo.</Notice>}
      renderItem={({ item: b }) => {
        const { titulo, subtitulo, total } = identidadDeBorrador(b)
        const guardado = <Text style={secundario}>{`${b.cantidadLineas} ${b.cantidadLineas === 1 ? 'línea' : 'líneas'} · Guardado ${tituloDelDia(new Date(b.fechaModificacion)).toLowerCase()} ${horaDe(b.fechaModificacion)}`}</Text>
        return (
          <Pressable accessibilityRole="button" accessibilityHint="Retomar el borrador" onPress={() => retomar(b)}
            style={{ minHeight: 48, padding: space[4], borderRadius: radii.tarjeta, backgroundColor: c.surface, gap: space[1] }}>
            <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>{titulo}</Text>
            {subtitulo ? <Text style={[typeScale.secundario, { color: c.text }]}>{subtitulo}</Text> : null}
            {/* Sin importe (servidor anterior a forward-system #898) la fila queda como siempre: solo el texto. */}
            {total === null ? guardado : (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space[2] }}>
                {guardado}
                <Text style={[typeScale.titulo, cifras, { color: c.text, textAlign: 'right' }]}>{total}</Text>
              </View>
            )}
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
        title="Ventas"
        leading={leading}
        // En tablet no hay barra inferior con el "+": la venta nueva se abre desde acá.
        actions={isTablet && canDo('MOD_VENTAS', 'create')
          ? [{ icon: Plus, accessibilityLabel: 'Nueva venta', onPress: () => router.push('/(tabs)/ventas/nueva-v2' as never) }]
          : []}
        tabs={PESTANAS.map((p) => ({ label: p.label, selected: p.key === l.pestana, onPress: () => { l.setPestana(p.key); setElegida(null) } }))}
      />
      <TwoPane
        list={esBorradores ? listaBorradores : listaVentas}
        detail={isTabletLandscape && elegida ? detalle(elegida, () => setElegida(null)) : null}
        emptyDetail={<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[6] }}><Text style={secundario}>Elegí una venta para ver el detalle.</Text></View>}
      />
    </View>
  )
}
