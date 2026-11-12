import React from 'react'
import { ActivityIndicator, FlatList, ScrollView, View } from 'react-native'
import { radii, space, useColors } from '@/libs/theme'
import { Notice, StatusChip, useInsetInferior } from '@/core/ui/fw'
import { FiltroChip } from '@/core/ui/fw/FiltroChip'
import { EstadoDePantalla, textoSinConexion } from '@/core/ui/fw/EstadoDePantalla'
import { esFallaDeRed } from '@/core/api/errores'
import type { StockItem } from '@/libs/api-client/types'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { hasCapability } from '@/features/auth/lib/capabilities'
import { chipDeStock } from '@/features/catalogo/lib/presentacion'
import { useProductosDeStockConsulta } from '../hooks/useProductosDeStockConsulta'
import { TODOS_LOS_DEPOSITOS, useStockPorDeposito } from '../hooks/useStockPorDeposito'
import { textoVacio } from '../lib/stock-presentacion'
import { CabeceraDeTabla, FilaDeLista, FilaDeTabla, TarjetaDeLinea, TarjetaDeProducto, TarjetaSinCantidades } from './TarjetaDeStock'
import { FraganciasDeLinea } from './FraganciasDeLinea'
import { BotonFiltros, HojaDeFiltros, SelectorDeVista } from './FiltrosDeStock'
import { TotalesDeStock, type VistaDeStock } from './TotalesDeStock'
import { DetalleDeStock } from './DetalleDeStock'

/** Un renglón de la grilla: N tarjetas, o el panel de fragancias de una línea desplegada a todo el ancho. */
type Bloque<T> = { tipo: 'fila'; key: string; items: T[] } | { tipo: 'fragancias'; key: string; linea: T }

/** Arma los renglones de la grilla; debajo del renglón de cada línea desplegada va su panel (web LineaAromaCards). */
function enBloques<T extends { id: string }>(items: T[], columnas: number, desplegada: (i: T) => boolean = () => false): Bloque<T>[] {
  const bloques: Bloque<T>[] = []
  for (let i = 0; i < items.length; i += columnas) {
    const fila = items.slice(i, i + columnas)
    bloques.push({ tipo: 'fila', key: `fila-${fila[0].id}`, items: fila })
    for (const l of fila.filter(desplegada)) bloques.push({ tipo: 'fragancias', key: `fragancias-${l.id}`, linea: l })
  }
  return bloques
}

/** Lugar vacío que completa el último renglón para que las tarjetas no se estiren. */
const Hueco = () => <View style={{ flex: 1 }} />

/** Cargando (web InventarioGrid): esqueletos de tarjeta. */
function Esqueletos({ columnas }: { columnas: number }) {
  const c = useColors()
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2], padding: space[4] }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <View key={i} testID="esqueleto-tarjeta" style={{ width: `${Math.floor(100 / columnas) - 3}%`, height: 200, borderRadius: radii.tarjeta, backgroundColor: c.surface2 }} />
      ))}
    </View>
  )
}

/** Sin CAP_VER_CANTIDADES_STOCK (lámina 7): el catálogo de hoy, en tarjetas con solo "Hay stock / Sin stock" del servidor. */
function StockSinCantidades({ busqueda, columnas }: { busqueda: string; columnas: number }) {
  const insetInferior = useInsetInferior()
  const c = useColors()
  const cat = useProductosDeStockConsulta()
  const { setBusqueda } = cat
  // La búsqueda de esta vista vive en la pantalla; el hook la espera ~300 ms como en el catálogo.
  React.useEffect(() => { setBusqueda(busqueda) }, [busqueda, setBusqueda])
  if (cat.isLoading) return <ActivityIndicator style={{ marginTop: space[8] }} color={c.brandInk} />
  const sinRed = cat.isError && esFallaDeRed(cat.error)
  if (sinRed && cat.productos.length === 0) {
    return <EstadoDePantalla tipo="sinConexion" titulo="No pudimos cargar el stock" accion={{ label: 'Reintentar', onPress: () => { void cat.refetch() } }} />
  }
  if (cat.isError && !sinRed) return <View style={{ padding: space[4] }}><Notice tone="peligro">No se pudo cargar el stock. Revisá la conexión y volvé a intentar.</Notice></View>
  return (
    <FlatList
      data={enBloques(cat.productos, columnas)}
      keyExtractor={(b) => b.key}
      onEndReached={cat.cargarMas}
      onEndReachedThreshold={0.5}
      contentContainerStyle={{ padding: space[4], gap: space[2], paddingBottom: space[12] + insetInferior }}
      ListHeaderComponent={
        <View style={{ gap: space[2] }}>
          {sinRed ? <Notice tone="advertencia">{textoSinConexion(cat.dataUpdatedAt)}</Notice> : null}
          <Notice tone="info">Tu perfil no ve cantidades: se muestra solo si hay o no hay stock.</Notice>
        </View>
      }
      ListEmptyComponent={<EstadoDePantalla tipo="vacio" titulo="No hay productos que coincidan con la búsqueda." />}
      renderItem={({ item: b }) =>
        b.tipo === 'fila' ? (
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            {b.items.map((p) => {
              const chip = chipDeStock(cat.disponible.get(p.id))
              return (
                <TarjetaSinCantidades
                  key={p.id}
                  nombre={p.nombre}
                  marca={p.marca}
                  codigo={p.codigoPropio ?? ''}
                  imageUrl={p.imageUrl}
                  chip={chip ? <StatusChip estado={chip.estado} label={chip.label} /> : null}
                />
              )
            })}
            {Array.from({ length: columnas - b.items.length }).map((_, i) => <Hueco key={i} />)}
          </View>
        ) : null
      }
    />
  )
}

function StockConCantidades({ busqueda, tablet }: { busqueda: string; tablet: boolean }) {
  const insetInferior = useInsetInferior()
  const c = useColors()
  const veCostos = hasCapability(useAuthStore((st) => st.user?.permissions), 'CAP_VER_COSTOS')
  const s = useStockPorDeposito({ conCantidades: true, busqueda })
  const [vista, setVista] = React.useState<VistaDeStock>('tarjetas')
  const [hojaFiltros, setHojaFiltros] = React.useState(false)
  const [detalle, setDetalle] = React.useState<StockItem | null>(null)
  const [desplegadas, setDesplegadas] = React.useState<ReadonlySet<string>>(new Set())
  const alternar = (id: string) =>
    setDesplegadas((prev) => {
      const sig = new Set(prev)
      if (sig.has(id)) sig.delete(id)
      else sig.add(id)
      return sig
    })

  const sinRed = s.isError && esFallaDeRed(s.error)
  // En "Todos" hay una fila por producto y depósito: cada una dice de cuál es.
  const conDeposito = s.depositoId === TODOS_LOS_DEPOSITOS
  const lista = vista === 'lista'
  const columnas = lista ? 1 : tablet ? 4 : 2
  const bloques = enBloques(s.filas, columnas, (f) => f.esPadreDeVariantes && desplegadas.has(f.id))

  const pieza = (f: StockItem) => {
    const linea = f.esPadreDeVariantes ? { abierta: desplegadas.has(f.id), onAlternar: () => alternar(f.id) } : undefined
    if (lista) {
      const Fila = tablet ? FilaDeTabla : FilaDeLista
      return <Fila item={f} onPress={setDetalle} conDeposito={conDeposito} linea={linea} />
    }
    return linea ? (
      <TarjetaDeLinea item={f} onPress={setDetalle} abierta={linea.abierta} onAlternar={linea.onAlternar} />
    ) : (
      <TarjetaDeProducto item={f} onPress={setDetalle} />
    )
  }

  return (
    <View style={{ flex: 1 }}>
      {s.depositos.length > 1 || (s.puedeVerTodos && s.depositos.length > 0) ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2], paddingHorizontal: space[4], paddingTop: space[3] }} style={{ flexGrow: 0 }}>
          {s.puedeVerTodos ? <FiltroChip label="Todos los depósitos" activo={s.depositoId === TODOS_LOS_DEPOSITOS} onPress={() => s.setDeposito(TODOS_LOS_DEPOSITOS)} /> : null}
          {s.depositos.map((d) => (
            <FiltroChip key={d.id} label={d.nombre} activo={d.id === s.depositoId} onPress={() => s.setDeposito(d.id)} />
          ))}
        </ScrollView>
      ) : null}
      <TotalesDeStock resumen={s.resumen} conError={s.resumenConError} vista={vista} valorCosto={veCostos ? { depositoId: s.depositoId } : null} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2], paddingHorizontal: space[4], paddingTop: space[3] }}>
        <BotonFiltros filtros={s.filtros} onPress={() => setHojaFiltros(true)} />
        <SelectorDeVista vista={vista} onCambiar={setVista} />
      </View>
      {s.isLoading ? (
        <Esqueletos columnas={columnas} />
      ) : s.isError && !(sinRed && s.filas.length > 0) ? (
        sinRed ? (
          <EstadoDePantalla tipo="sinConexion" titulo="No pudimos cargar el stock" accion={{ label: 'Reintentar', onPress: () => void s.refetch() }} />
        ) : (
          <View style={{ padding: space[4] }}><Notice tone="peligro">No se pudo cargar el stock. Revisá la conexión y volvé a intentar.</Notice></View>
        )
      ) : (
        <FlatList
          data={bloques}
          keyExtractor={(b) => b.key}
          onEndReached={s.cargarMas}
          onEndReachedThreshold={0.5}
          contentContainerStyle={{ padding: space[4], gap: space[2], paddingBottom: space[12] + insetInferior }}
          ListHeaderComponent={
            <>
              {sinRed ? <Notice tone="advertencia">{textoSinConexion(s.dataUpdatedAt || undefined)}</Notice> : null}
              {lista && tablet ? <CabeceraDeTabla /> : null}
            </>
          }
          ListEmptyComponent={<EstadoDePantalla tipo="vacio" titulo={textoVacio(s.filtros, busqueda)} />}
          ListFooterComponent={s.isFetchingNextPage ? <ActivityIndicator color={c.brandInk} /> : undefined}
          renderItem={({ item: b }) =>
            b.tipo === 'fragancias' ? (
              <FraganciasDeLinea linea={b.linea} onAbrirDetalle={setDetalle} />
            ) : (
              <View style={{ flexDirection: 'row', gap: space[2] }}>
                {b.items.map((f) => <View key={f.id} style={{ flex: 1, minWidth: 0 }}>{pieza(f)}</View>)}
                {Array.from({ length: columnas - b.items.length }).map((_, i) => <Hueco key={i} />)}
              </View>
            )
          }
        />
      )}
      <HojaDeFiltros visible={hojaFiltros} onCerrar={() => setHojaFiltros(false)} resumen={s.resumen} filtros={s.filtros} onCambiar={s.setFiltros} />
      <DetalleDeStock item={detalle} onCerrar={() => setDetalle(null)} veCostos={veCostos} />
    </View>
  )
}

/**
 * Stock, solo ver (S16): la estructura de "Inventario & Stock" de la web. Con CAP_VER_CANTIDADES_STOCK, Tarjetas (de
 * entrada) o Lista, totales, filtros, líneas con sus fragancias, detalle y movimientos; sin ella, solo "Hay stock /
 * Sin stock". Ninguna acción cambia datos. La capacidad decide acá, no el rol (X3).
 */
export function StockPorDeposito({ busqueda, tablet }: { busqueda: string; tablet: boolean }) {
  const veCantidades = hasCapability(useAuthStore((s) => s.user?.permissions), 'CAP_VER_CANTIDADES_STOCK')
  return veCantidades ? <StockConCantidades busqueda={busqueda} tablet={tablet} /> : <StockSinCantidades busqueda={busqueda} columnas={tablet ? 4 : 2} />
}
