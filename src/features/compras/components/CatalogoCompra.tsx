import React, { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { Field, FormContainer, Notice, StatusChip, useInsetInferior } from '@/core/ui/fw'
import { useInfiniteCatalogoStock } from '@/libs/api-client'
import { usePermissions } from '@/core/auth/RequirePermission'
import { useNetworkStatus } from '@/core/utils/useNetworkStatus'
import { useComprasDelProveedor } from '@/features/proveedores/hooks/useProveedores'
import { numeroDeCompra } from '../lib/numero'
import { sinCosto, type LineaCompra } from '../lib/lineaCompra'
import { ProductoCompraCard, type ProductoComprable } from './ProductoCompraCard'

type Filtro = 'todos' | 'sinCosto'
const FILTROS: { value: Filtro; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'sinCosto', label: 'Sin costo cargado' },
]

interface Props {
  proveedor: { id: string; condicion: string | null }
  lineas: LineaCompra[]
  onAgregar: (producto: ProductoComprable) => void
  onCambiar: (linea: LineaCompra) => void
  onQuitar: (productoId: string) => void
  onAbrir: (linea: LineaCompra) => void
}

/**
 * Paso 2 de la compra nueva (maqueta "Compras como venta", frames 5 y 6; copia el catálogo de la venta): las condiciones
 * del proveedor donde la venta pone crédito y deuda, buscador, filtros y tarjetas. Lo comprable sale del catálogo por
 * depósito (comunes y fragancias, sin la línea, que el servidor no deja comprar): `GET /Productos` no filtra por depósito
 * y a un usuario limitado le mostraría productos ajenos. Sin conexión se sigue cargando: el borrador se guarda al volver.
 */
export function CatalogoCompra({ proveedor, lineas, onAgregar, onCambiar, onQuitar, onAbrir }: Props) {
  const insetInferior = useInsetInferior()
  const c = useColors()
  const [busqueda, setBusqueda] = useState('')
  const [enviada, setEnviada] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const { isConnected } = useNetworkStatus({ desconocidoCuentaComoSinRed: false })
  const puedeVerCompras = usePermissions().canDo('MOD_COMPRAS', 'read')
  const ultimas = useComprasDelProveedor(proveedor.id, puedeVerCompras, 1)
  useEffect(() => {
    const t = setTimeout(() => setEnviada(busqueda.trim()), 300)
    return () => clearTimeout(t)
  }, [busqueda])
  const productos = useInfiniteCatalogoStock({ pageSize: 30, search: enviada, soloComprables: true, familiasCompletas: false })
  const todos = (productos.data?.pages.flatMap((p) => p.items ?? []) ?? []) as ProductoComprable[]
  const total = productos.data?.pages[0]?.totalCount ?? todos.length
  const porId = new Map(lineas.map((l) => [l.productoId, l]))
  const visibles = filtro === 'sinCosto' ? todos.filter((p) => { const l = porId.get(p.id); return !!l && sinCosto(l) }) : todos
  const secundario = { ...typeScale.secundario, color: c.textSecondary }
  const ultima = ultimas.data?.items?.[0]
  const textoUltima = ultimas.isLoading ? 'Cargando…' : ultimas.isError ? 'No se pudo cargar' : ultima ? numeroDeCompra(ultima) : 'Sin compras'

  const condicion = (k: string, v: string) => (
    <View accessible accessibilityLabel={`${k}: ${v}`} style={{ flex: 1, gap: 2, padding: space[3], borderRadius: radii.tarjeta, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
      <Text style={{ ...typeScale.etiqueta, color: c.textSecondary }}>{k}</Text>
      <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{v}</Text>
    </View>
  )

  return (
    <FlatList
      style={{ flex: 1 }}
      data={visibles}
      keyExtractor={(p) => p.id}
      extraData={lineas}
      contentContainerStyle={{ padding: space[4], paddingBottom: space[4] + insetInferior, gap: space[3] }}
      keyboardShouldPersistTaps="handled"
      onEndReached={() => { if (productos.hasNextPage && !productos.isFetchingNextPage) void productos.fetchNextPage() }}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={
        <FormContainer style={{ gap: space[3] }}>
          <View style={{ flexDirection: 'row', gap: space[3] }}>
            {condicion('Plazo de pago', proveedor.condicion ?? '—')}
            {puedeVerCompras ? condicion('Última compra', textoUltima) : null}
          </View>
          <Field label="Buscar producto" placeholder="Producto, marca o código" value={busqueda} onChangeText={setBusqueda} autoCorrect={false} />
          <View accessibilityRole="radiogroup" accessibilityLabel="Filtrar productos" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {FILTROS.map((f) => {
              const sel = f.value === filtro
              return (
                <Pressable key={f.value} accessibilityRole="radio" accessibilityLabel={f.label} accessibilityState={{ checked: sel, selected: sel }} onPress={() => setFiltro(f.value)}
                  android_ripple={{ color: c.surface2 }}
                  style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: space[4], borderRadius: radii.pastilla, borderWidth: 1, borderColor: sel ? c.brand : c.border, backgroundColor: sel ? c.brandSoft : c.surface }}>
                  <Text style={{ ...typeScale.secundario, color: sel ? c.brandInk : c.text }}>{f.label}</Text>
                </Pressable>
              )
            })}
          </View>
          {isConnected === false ? <View style={{ flexDirection: 'row' }}><StatusChip estado="pendiente" label="Sin conexión" /></View> : null}
        </FormContainer>
      }
      renderItem={({ item }) => (
        <FormContainer>
          <ProductoCompraCard producto={item} linea={porId.get(item.id)} onAgregar={onAgregar} onCambiar={onCambiar} onQuitar={onQuitar} onAbrir={onAbrir} />
        </FormContainer>
      )}
      ListEmptyComponent={
        productos.isLoading ? <ActivityIndicator color={c.brand} />
          : productos.isError ? <Notice tone="peligro">No se pudieron cargar los productos.</Notice>
          : <Text style={{ ...secundario, textAlign: 'center' }}>{filtro === 'sinCosto' ? 'No hay productos sin costo cargado.' : 'No hay productos con esa búsqueda.'}</Text>
      }
      ListFooterComponent={
        productos.isFetchingNextPage ? <ActivityIndicator color={c.brand} />
          : visibles.length > 0 && filtro === 'todos' ? <Text style={{ ...secundario, textAlign: 'center' }}>{`Mostrando ${visibles.length} de ${total}`}</Text>
          : undefined
      }
    />
  )
}
