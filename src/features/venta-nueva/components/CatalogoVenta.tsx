import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { ScanBarcode, Search } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { Notice, StatusChip } from '@/core/ui/fw'
import { FiltroChip } from '@/core/ui/fw/FiltroChip'
import { useResponsive } from '@/libs/useResponsive'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { hasCapability } from '@/features/auth/lib/capabilities'
import { EscanerCodigo } from '@/features/catalogo/components/EscanerCodigo'
import { useCatalogoVenta } from '../hooks/useCatalogoVenta'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import type { CatalogoStockItem } from '@/libs/api-client'
import { cantidadEn } from '../lib/carrito'
import { resolverCodigo } from '../lib/escaneo'
import { FILTROS_VACIOS, filtrarCatalogo } from '../lib/filtrosCatalogo'
import { ProductoCatalogoCard } from './ProductoCatalogoCard'
import { CarritoFlotante, CarritoPanel } from './CarritoVenta'
import { FraganciasSheet } from './FraganciasSheet'
import { cantidadDeFragancias } from '../lib/fragancias'

interface CatalogoVentaProps {
  onVerVenta: () => void
  /** Lo que el cliente llevó en su último pedido (producto → cantidad); sin él no se ofrece ese filtro. */
  llevo?: Map<string, number> | null
  /** Arrancar con el escáner abierto ("Escanear en la góndola"). */
  escanearAlAbrir?: boolean
  /** Arrancar con "Del último pedido" prendido ("Repetir el último pedido" del paso 1). */
  filtroInicialDelUltimo?: boolean
  /** Señal del stock en vivo (`useStockVivoVenta`): chip "Stock en vivo" / "Sin conexión"; sin ella no hay chip. */
  enVivo?: boolean
  /** Abre la pantalla de cantidad y oferta del producto ("Agregar" y el chip de edición de la tarjeta). */
  onAbrirOferta: (producto: CatalogoStockItem) => void
}

/**
 * Catálogo rápido (V4 CalleCatalogo / TV3 TabCalleCatalogo). Teléfono: una columna y el carrito flotante.
 * Tablet vertical: dos columnas. Tablet horizontal (≥ 900): grilla de 3 con la venta en curso fija a la derecha.
 * Filtros con lo que ya manda el servidor (oferta, stock) y con el último pedido; escáner de código de barras.
 */
export function CatalogoVenta({ onVerVenta, llevo = null, escanearAlAbrir = false, filtroInicialDelUltimo = false, enVivo, onAbrirOferta }: CatalogoVentaProps) {
  const c = useColors()
  const { formFactor, isTabletLandscape } = useResponsive()
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  // El último pedido llega después de abrir el catálogo: se prende una sola vez, cuando está.
  const prendido = useRef(false)
  useEffect(() => {
    if (!filtroInicialDelUltimo || !llevo || prendido.current) return
    prendido.current = true
    setFiltros((f) => ({ ...f, delUltimo: true }))
  }, [filtroInicialDelUltimo, llevo])
  const { productos: todos, isLoading } = useCatalogoVenta(busqueda)
  const { productos: completo } = useCatalogoVenta('')
  const idsDelUltimo = useMemo(() => new Set(llevo?.keys() ?? []), [llevo])
  // Las variantes (productoPadreId) vienen para resolverlas por id al elegir fragancias; no se venden sueltas.
  const productos = useMemo(
    () => filtrarCatalogo(todos, filtros, idsDelUltimo).filter((p) => !p.productoPadreId),
    [todos, filtros, idsDelUltimo],
  )
  const { lineas, agregar, reemplazar } = useCarritoVenta()
  const [fragancias, setFragancias] = useState<string | null>(null)
  const [escaneando, setEscaneando] = useState(escanearAlAbrir)
  const [avisoEscaneo, setAvisoEscaneo] = useState<string | null>(null)
  const verCantidades = hasCapability(useAuthStore((s) => s.user?.permissions), 'CAP_VER_CANTIDADES_STOCK')
  const columnas = formFactor === 'tabletLandscape' ? 3 : formFactor === 'tabletPortrait' ? 2 : 1
  // El pie cuenta lo vendible del catálogo: las variantes no se venden sueltas.
  const totalVendible = useMemo(() => completo.filter((p) => !p.productoPadreId).length, [completo])
  const sinFiltros = !filtros.delUltimo && !filtros.conOferta && !filtros.hayStock
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
      <View testID="catalogo-encabezado" style={{ paddingHorizontal: space[3], paddingTop: space[3], paddingBottom: space[2], gap: space[3], backgroundColor: c.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], height: 52, borderRadius: radii.campo, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, paddingLeft: space[3] }}>
          <Search size={20} color={c.textSecondary} />
          <TextInput
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Producto, marca o código"
            placeholderTextColor={c.textSecondary}
            accessibilityLabel="Producto, marca o código"
            autoCorrect={false}
            style={{ ...typeScale.cuerpo, flex: 1, color: c.text, paddingVertical: 0 }}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Escanear código de barras" onPress={() => setEscaneando(true)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <ScanBarcode size={22} color={c.text} />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2] }} style={{ flexGrow: 0 }}>
          <FiltroChip label="Todos" activo={sinFiltros} onPress={() => setFiltros(FILTROS_VACIOS)} />
          {llevo ? <FiltroChip label="Del último pedido" activo={filtros.delUltimo} onPress={() => alternar('delUltimo')} /> : null}
          <FiltroChip label="Con oferta" activo={filtros.conOferta} onPress={() => alternar('conOferta')} />
          <FiltroChip label="Hay stock" activo={filtros.hayStock} onPress={() => alternar('hayStock')} />
        </ScrollView>
        {enVivo === undefined ? null : (
          <View style={{ alignSelf: 'flex-start' }}>
            <StatusChip estado={enVivo ? 'entregado' : 'pendiente'} label={enVivo ? 'Stock en vivo' : 'Sin conexión'} />
          </View>
        )}
        {avisoEscaneo ? <Notice tone="advertencia">{avisoEscaneo}</Notice> : null}
      </View>
      <FlatList
        key={columnas}
        data={productos}
        numColumns={columnas}
        keyExtractor={(p) => p.id}
        columnWrapperStyle={columnas > 1 ? { gap: space[3] } : undefined}
        contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: space[4], gap: space[3] }}
        ListFooterComponent={
          <Text style={{ ...typeScale.secundario, color: c.textSecondary, textAlign: 'center' }}>{`Mostrando ${productos.length} de ${Math.max(totalVendible, productos.length)}`}</Text>
        }
        ListEmptyComponent={
          isLoading ? <ActivityIndicator color={c.brand} /> : <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>No hay productos que coincidan.</Text>
        }
        renderItem={({ item }) => (
          <ProductoCatalogoCard
            producto={item}
            linea={lineas.find((l) => l.productoId === item.id)}
            cantidad={item.esPadreDeVariantes ? cantidadDeFragancias(lineas, item.id) : cantidadEn(lineas, item.id)}
            verCantidades={verCantidades}
            enVivo={enVivo}
            onAbrirOferta={onAbrirOferta}
            onCambiarCantidad={(unidades) => {
              const l = lineas.find((x) => x.productoId === item.id)
              if (l) reemplazar({ ...l, cantidad: unidades })
            }}
            llevoAntes={llevo?.get(item.id)}
            onElegirFragancias={() => setFragancias(item.id)}
          />
        )}
      />
      {!isTabletLandscape && <CarritoFlotante lineas={lineas} onVerVenta={onVerVenta} />}
    </View>
  )

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      {lista}
      {isTabletLandscape && <CarritoPanel lineas={lineas} onVerVenta={onVerVenta} />}
      <FraganciasSheet padreId={fragancias} onClose={() => setFragancias(null)} llevo={llevo} />
      {escaneando ? <EscanerCodigo visible onClose={() => setEscaneando(false)} onLeido={alLeer} /> : null}
    </View>
  )
}
