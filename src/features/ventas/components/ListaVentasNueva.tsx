import React from 'react'
import { ActivityIndicator, Pressable, ScrollView, SectionList, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import {
  DocumentCard, Field, Notice, Segmented, TopBar, chipForEstado, useMenuLeading,
  type SegmentedOption,
} from '@/core/ui/fw'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import type { Venta } from '@/libs/api-client'
import { agruparPorDia, horaDe } from '../lib/agruparPorDia'
import { useVentasListaNueva, type FiltroEstado, type PeriodoVentas, type PestanaVentas } from '../hooks/useVentasListaNueva'

const PESTANAS: { key: PestanaVentas; label: string }[] = [
  { key: 'presupuestos', label: 'Presupuestos' },
  { key: 'pedidos', label: 'Pedidos' },
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

/** Lista de ventas con el formato nuevo (láminas Ventas y TabVentas). Detrás del switch de la venta nueva. */
export function ListaVentasNueva() {
  const c = useColors()
  const router = useRouter()
  const leading = useMenuLeading()
  const l = useVentasListaNueva()
  const q = l.ventasQuery

  const abrir = (id: string) => router.push(`/(tabs)/ventas/${id}` as never)

  const secundario = [typeScale.secundario, { color: c.textSecondary }]

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
            importe={v.totalAmount}
            chip={chipForEstado('venta', v.estado)}
            onPress={() => abrir(v.id)}
          />
        </View>
      )}
      onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage() }}
      onEndReachedThreshold={0.4}
      refreshing={q.isRefetching}
      onRefresh={() => { void q.refetch() }}
      ListEmptyComponent={
        q.isLoading ? <ActivityIndicator color={c.brand} />
          : q.isError ? <Notice tone="peligro">No se pudieron cargar las ventas. Deslizá hacia abajo para reintentar.</Notice>
          : <Text style={secundario}>No hay ventas con estos filtros.</Text>
      }
      ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={c.brand} /> : null}
    />
  )

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar
        title="Ventas"
        leading={leading}
        tabs={PESTANAS.map((p) => ({ label: p.label, selected: p.key === l.pestana, onPress: () => l.setPestana(p.key) }))}
      />
      {listaVentas}
    </View>
  )
}
