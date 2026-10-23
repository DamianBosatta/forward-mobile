import React, { useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { ScanBarcode, Search } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { Notice } from '@/core/ui/fw'
import { FiltroChip } from '@/core/ui/fw/FiltroChip'
import { useResponsive } from '@/libs/useResponsive'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { hasCapability } from '@/features/auth/lib/capabilities'
import { EscanerCodigo } from '@/features/catalogo/components/EscanerCodigo'
import { useCatalogoVenta } from '../hooks/useCatalogoVenta'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import { cantidadEn, type LineaCarrito } from '../lib/carrito'
import { resolverCodigo } from '../lib/escaneo'
import { FILTROS_VACIOS, filtrarCatalogo } from '../lib/filtrosCatalogo'
import { ProductoCatalogoCard } from './ProductoCatalogoCard'
import { CarritoFlotante, CarritoPanel } from './CarritoVenta'
import { CantidadSheet } from './CantidadSheet'
import { EditarLineaSheet } from './EditarLineaSheet'
import { FraganciasSheet } from './FraganciasSheet'
import { cantidadDeFragancias } from '../lib/fragancias'

interface CatalogoVentaProps {
  onVerVenta: () => void
  /** Lo que el cliente llevó en su último pedido (producto → cantidad); sin él no se ofrece ese filtro. */
  llevo?: Map<string, number> | null
  /** Arrancar con el escáner abierto ("Escanear en la góndola"). */
  escanearAlAbrir?: boolean
}

/**
 * Catálogo rápido (V4 CalleCatalogo / TV3 TabCalleCatalogo). Teléfono: una columna y el carrito flotante.
 * Tablet vertical: dos columnas. Tablet horizontal (≥ 900): grilla de 3 con la venta en curso fija a la derecha.
 * Filtros con lo que ya manda el servidor (oferta, stock) y con el último pedido; escáner de código de barras.
 */
export function CatalogoVenta({ onVerVenta, llevo = null, escanearAlAbrir = false }: CatalogoVentaProps) {
  const c = useColors()
  const { formFactor, isTabletLandscape } = useResponsive()
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const { productos: todos, isLoading } = useCatalogoVenta(busqueda)
  const { productos: completo } = useCatalogoVenta('')
  const idsDelUltimo = useMemo(() => new Set(llevo?.keys() ?? []), [llevo])
  // Las variantes (productoPadreId) vienen para resolverlas por id al elegir fragancias; no se venden sueltas.
  const productos = useMemo(
    () => filtrarCatalogo(todos, filtros, idsDelUltimo).filter((p) => !p.productoPadreId),
    [todos, filtros, idsDelUltimo],
  )
  const { lineas, agregar, sumar, restar, quitar, reemplazar } = useCarritoVenta()
  const [editando, setEditando] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<LineaCarrito | null>(null)
  const [fragancias, setFragancias] = useState<string | null>(null)
  const [escaneando, setEscaneando] = useState(escanearAlAbrir)
  const [avisoEscaneo, setAvisoEscaneo] = useState<string | null>(null)
  const verCantidades = hasCapability(useAuthStore((s) => s.user?.permissions), 'CAP_VER_CANTIDADES_STOCK')
  const columnas = formFactor === 'tabletLandscape' ? 3 : formFactor === 'tabletPortrait' ? 2 : 1
  const alternar = (k: keyof typeof filtros) => setFiltros((f) => ({ ...f, [k]: !f[k] }))

  const alLeer = (codigo: string) => {
    setEscaneando(false)
    const r = resolverCodigo(completo, codigo)
    if (!r) {
      setBusqueda(codigo)
      setAvisoEscaneo('No encontramos ese código en el catálogo: probá buscarlo por nombre.')
    } else if (r.tipo === 'fragancias') {
      setAvisoEscaneo(null)
      setFragancias(r.padreId)
    } else {
      agregar(r.producto)
      setAvisoEscaneo(`Sumaste ${r.producto.nombre}.`)
    }
  }

  const lista = (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ padding: space[4], gap: space[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], height: 48, borderRadius: radii.campo, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, paddingLeft: space[3] }}>
          <Search size={20} color={c.textSecondary} />
          <TextInput
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar por código o nombre"
            placeholderTextColor={c.textSecondary}
            accessibilityLabel="Buscar por código o nombre"
            autoCorrect={false}
            style={{ ...typeScale.cuerpo, flex: 1, color: c.text, paddingVertical: 0 }}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Escanear código de barras" onPress={() => setEscaneando(true)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <ScanBarcode size={22} color={c.text} />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2] }} style={{ flexGrow: 0 }}>
          {llevo ? <FiltroChip label="Del último pedido" activo={filtros.delUltimo} onPress={() => alternar('delUltimo')} /> : null}
          <FiltroChip label="Con oferta" activo={filtros.conOferta} onPress={() => alternar('conOferta')} />
          <FiltroChip label="Hay stock" activo={filtros.hayStock} onPress={() => alternar('hayStock')} />
        </ScrollView>
        {avisoEscaneo ? <Notice tone="advertencia">{avisoEscaneo}</Notice> : null}
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`${productos.length} resultados`}</Text>
      </View>
      <FlatList
        key={columnas}
        data={productos}
        numColumns={columnas}
        keyExtractor={(p) => p.id}
        columnWrapperStyle={columnas > 1 ? { gap: space[3] } : undefined}
        contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: space[4], gap: space[3] }}
        ListEmptyComponent={
          isLoading ? <ActivityIndicator color={c.brand} /> : <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>No hay productos que coincidan.</Text>
        }
        renderItem={({ item }) => (
          <ProductoCatalogoCard
            producto={item}
            cantidad={item.esPadreDeVariantes ? cantidadDeFragancias(lineas, item.id) : cantidadEn(lineas, item.id)}
            verCantidades={verCantidades}
            llevoAntes={llevo?.get(item.id)}
            onAgregar={() => agregar(item)}
            onSumar={() => sumar(item.id)}
            onRestar={() => restar(item.id)}
            onElegirFragancias={() => setFragancias(item.id)}
            onEditar={item.esPadreDeVariantes ? undefined : () => setEditando(item.id)}
          />
        )}
      />
      {!isTabletLandscape && (
        <View style={{ padding: space[4], paddingTop: 0 }}>
          <CarritoFlotante lineas={lineas} onVerVenta={onVerVenta} />
        </View>
      )}
    </View>
  )

  const linea = lineas.find((l) => l.productoId === editando) ?? null
  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      {lista}
      {isTabletLandscape && <CarritoPanel lineas={lineas} onVerVenta={onVerVenta} />}
      <CantidadSheet
        linea={linea}
        onClose={() => setEditando(null)}
        onConfirm={(l) => { reemplazar(l); setEditando(null) }}
        onQuitar={(id) => { quitar(id); setEditando(null) }}
        onDetalle={(l) => { setEditando(null); setDetalle(l) }}
      />
      <EditarLineaSheet
        linea={detalle}
        onClose={() => setDetalle(null)}
        onConfirm={(l) => { reemplazar(l); setDetalle(null) }}
        onQuitar={(id) => { quitar(id); setDetalle(null) }}
      />
      <FraganciasSheet padreId={fragancias} onClose={() => setFragancias(null)} llevo={llevo} />
      {escaneando ? <EscanerCodigo visible onClose={() => setEscaneando(false)} onLeido={alLeer} /> : null}
    </View>
  )
}
