import React from 'react'
import { ActivityIndicator, FlatList, ScrollView, Text, View } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { Notice, StatusChip } from '@/core/ui/fw'
import { FiltroChip } from '@/core/ui/fw/FiltroChip'
import { mostrarNumero } from '@/src/utils/numero'
import type { StockItem } from '@/libs/api-client/types'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { hasCapability } from '@/features/auth/lib/capabilities'
import { useCatalogoConsulta } from '@/features/catalogo/hooks/useCatalogoConsulta'
import { chipDeStock } from '@/features/catalogo/lib/presentacion'
import { useStockPorDeposito } from '../hooks/useStockPorDeposito'
import { chipDeFilaStock, textoMinimo, textoReservadas, type FiltroEstadoStock } from '../lib/stock-presentacion'

const ESTADOS: { valor: FiltroEstadoStock; label: string }[] = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'EnAlerta', label: 'En alerta' },
  { valor: 'SinStock', label: 'Sin stock' },
]

function Kpi({ label, valor }: { label: string; valor: number | null | undefined }) {
  const c = useColors()
  return (
    <View style={{ flex: 1, backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[3], gap: space[1] }}>
      <Text style={[typeScale.secundario, { color: c.textSecondary }]}>{label}</Text>
      <Text style={[typeScale.titulo, { color: c.text }]}>{valor == null ? '-' : valor}</Text>
    </View>
  )
}

/** Renglón del teléfono: nombre, código y mínimo, disponible grande y reservadas / por ingresar. */
function FilaTelefono({ f }: { f: StockItem }) {
  const c = useColors()
  const chip = chipDeFilaStock(f)
  const sub = [f.codigoPropio, textoMinimo(f.stockMinimo)].filter(Boolean).join(' · ')
  const extra = [textoReservadas(f.cantidadReservada), f.cantidadVirtual > 0 ? `+${mostrarNumero(f.cantidadVirtual)} por ingresar` : null]
    .filter(Boolean)
    .join(' · ')
  return (
    <View
      accessibilityLabel={`${f.producto}, ${f.codigoPropio}`}
      style={{ flexDirection: 'row', gap: space[3], padding: space[3], borderRadius: radii.tarjeta, backgroundColor: c.surface }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: space[1] }}>
        <Text numberOfLines={2} style={[typeScale.cuerpoDestacado, { color: c.text }]}>{f.producto}</Text>
        <Text numberOfLines={1} style={[typeScale.secundario, { color: c.textSecondary }]}>{sub}</Text>
        <Text style={[typeScale.secundario, { color: c.textSecondary }]}>{extra}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: space[1] }}>
        <Text accessibilityLabel={`Disponible ${mostrarNumero(f.cantidadDisponible)}`} style={[typeScale.titulo, { color: c.text }]}>
          {mostrarNumero(f.cantidadDisponible)}
        </Text>
        {chip ? <StatusChip estado={chip.estado} label={chip.label} /> : null}
      </View>
    </View>
  )
}

const COLUMNAS = ['Disponible', 'Reservado', 'Por ingresar', 'Mínimo'] as const

function CeldaNumero({ children, fuerte }: { children: string; fuerte?: boolean }) {
  const c = useColors()
  return (
    <Text style={[fuerte ? typeScale.cuerpoDestacado : typeScale.cuerpo, { width: 92, textAlign: 'right', color: c.text }]}>
      {children}
    </Text>
  )
}

/** Renglón de la tablet (lámina TabStock): Producto · Disponible · Reservado · Por ingresar · Mínimo. */
function FilaTablet({ f }: { f: StockItem }) {
  const c = useColors()
  const chip = chipDeFilaStock(f)
  return (
    <View
      accessibilityLabel={`${f.producto}, ${f.codigoPropio}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 56, paddingHorizontal: space[3], backgroundColor: c.surface, borderRadius: radii.campo }}
    >
      <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <View style={{ flexShrink: 1 }}>
          <Text numberOfLines={1} style={[typeScale.cuerpoDestacado, { color: c.text }]}>{f.producto}</Text>
          <Text numberOfLines={1} style={[typeScale.secundario, { color: c.textSecondary }]}>{f.codigoPropio}</Text>
        </View>
        {chip ? <StatusChip estado={chip.estado} label={chip.label} /> : null}
      </View>
      <CeldaNumero fuerte>{mostrarNumero(f.cantidadDisponible)}</CeldaNumero>
      <CeldaNumero>{mostrarNumero(f.cantidadReservada)}</CeldaNumero>
      <CeldaNumero>{mostrarNumero(f.cantidadVirtual)}</CeldaNumero>
      <CeldaNumero>{mostrarNumero(f.stockMinimo)}</CeldaNumero>
    </View>
  )
}

function CabeceraTablet() {
  const c = useColors()
  return (
    <View style={{ flexDirection: 'row', gap: space[2], paddingHorizontal: space[3], paddingBottom: space[1] }}>
      <Text style={[typeScale.secundario, { flex: 1, color: c.textSecondary }]}>Producto</Text>
      {COLUMNAS.map((label) => (
        <Text key={label} style={[typeScale.secundario, { width: 92, textAlign: 'right', color: c.textSecondary }]}>{label}</Text>
      ))}
    </View>
  )
}

/** Sin CAP_VER_CANTIDADES_STOCK: el mismo catálogo, solo con "Hay stock / Sin stock" que decide el servidor. */
function StockSinCantidades({ busqueda }: { busqueda: string }) {
  const c = useColors()
  const cat = useCatalogoConsulta()
  const { setBusqueda } = cat
  // La búsqueda de esta vista vive en la pantalla; el hook la espera ~300 ms como en el catálogo.
  React.useEffect(() => { setBusqueda(busqueda) }, [busqueda, setBusqueda])
  if (cat.isLoading) return <ActivityIndicator style={{ marginTop: space[8] }} color={c.brandInk} />
  if (cat.isError) return <View style={{ padding: space[4] }}><Notice tone="peligro">No se pudo cargar el stock. Revisá la conexión y volvé a intentar.</Notice></View>
  return (
    <FlatList
      data={cat.productos}
      keyExtractor={(p) => p.id}
      onEndReached={cat.cargarMas}
      onEndReachedThreshold={0.5}
      contentContainerStyle={{ padding: space[4], gap: space[2], paddingBottom: space[12] }}
      ListHeaderComponent={<Notice tone="info">Tu perfil no ve cantidades: se muestra solo si hay o no hay stock.</Notice>}
      ListEmptyComponent={
        <Text style={[typeScale.cuerpo, { color: c.textSecondary, textAlign: 'center', marginTop: space[8] }]}>
          No hay productos que coincidan con la búsqueda.
        </Text>
      }
      renderItem={({ item }) => {
        const chip = chipDeStock(cat.disponible.get(item.id))
        return (
          <View
            accessibilityLabel={`${item.nombre}, ${item.codigoPropio}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3], borderRadius: radii.tarjeta, backgroundColor: c.surface }}
          >
            <View style={{ flex: 1, minWidth: 0, gap: space[1] }}>
              <Text numberOfLines={2} style={[typeScale.cuerpoDestacado, { color: c.text }]}>{item.nombre}</Text>
              <Text numberOfLines={1} style={[typeScale.secundario, { color: c.textSecondary }]}>{item.codigoPropio}</Text>
            </View>
            {chip ? <StatusChip estado={chip.estado} label={chip.label} /> : null}
          </View>
        )
      }}
    />
  )
}

function StockConCantidades({ busqueda, tablet }: { busqueda: string; tablet: boolean }) {
  const c = useColors()
  const s = useStockPorDeposito({ conCantidades: true, busqueda })
  return (
    <View style={{ flex: 1 }}>
      {s.depositos.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2], paddingHorizontal: space[4], paddingTop: space[3] }} style={{ flexGrow: 0 }}>
          {s.depositos.map((d) => (
            <FiltroChip key={d.id} label={d.nombre} activo={d.id === s.depositoId} onPress={() => s.setDeposito(d.id)} />
          ))}
        </ScrollView>
      ) : null}
      <View style={{ flexDirection: 'row', gap: space[2], paddingHorizontal: space[4], paddingTop: space[3] }}>
        <Kpi label="Artículos" valor={s.totales?.articulos} />
        <Kpi label="En alerta" valor={s.totales?.enAlerta} />
        <Kpi label="Sin stock" valor={s.totales?.sinStock} />
      </View>
      <View style={{ flexDirection: 'row', gap: space[2], paddingHorizontal: space[4], paddingTop: space[3] }}>
        {ESTADOS.map((e) => (
          <FiltroChip key={e.valor} label={e.label} activo={s.estado === e.valor} onPress={() => s.setEstado(e.valor)} />
        ))}
      </View>
      {s.isLoading ? (
        <ActivityIndicator style={{ marginTop: space[8] }} color={c.brandInk} />
      ) : s.isError ? (
        <View style={{ padding: space[4] }}><Notice tone="peligro">No se pudo cargar el stock. Revisá la conexión y volvé a intentar.</Notice></View>
      ) : (
        <FlatList
          data={s.filas}
          keyExtractor={(f) => f.id}
          onEndReached={s.cargarMas}
          onEndReachedThreshold={0.5}
          contentContainerStyle={{ padding: space[4], gap: space[2], paddingBottom: space[12] }}
          ListHeaderComponent={tablet ? <CabeceraTablet /> : null}
          ListEmptyComponent={
            <Text style={[typeScale.cuerpo, { color: c.textSecondary, textAlign: 'center', marginTop: space[8] }]}>
              No hay productos que coincidan.
            </Text>
          }
          ListFooterComponent={s.isFetchingNextPage ? <ActivityIndicator color={c.brandInk} /> : null}
          renderItem={({ item }) => (tablet ? <FilaTablet f={item} /> : <FilaTelefono f={item} />)}
        />
      )}
    </View>
  )
}

/**
 * Stock por depósito, solo ver (láminas ModStock y TabStock). Con CAP_VER_CANTIDADES_STOCK muestra cantidades;
 * sin ella, solo "Hay stock / Sin stock". La capacidad decide acá, no el rol (X3).
 */
export function StockPorDeposito({ busqueda, tablet }: { busqueda: string; tablet: boolean }) {
  const veCantidades = hasCapability(useAuthStore((s) => s.user?.permissions), 'CAP_VER_CANTIDADES_STOCK')
  return veCantidades ? <StockConCantidades busqueda={busqueda} tablet={tablet} /> : <StockSinCantidades busqueda={busqueda} />
}
