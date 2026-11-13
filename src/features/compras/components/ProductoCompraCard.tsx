import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Package } from 'lucide-react-native'
import { Image as ExpoImage } from 'expo-image'
import { FONT, importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, Segmented, formatImporte } from '@/core/ui/fw'
import { ProductoIdentidad } from '@/core/ui/fw/ProductoIdentidad'
import { Redondo } from '@/features/venta-nueva/components/ProductoCatalogoCard'
import { getFullImageUrl } from '@/libs/api-client'
import { mostrarNumero } from '@/core/utils/numero'
import { presentacionEmpaque, type EmpaqueProducto } from '@/core/utils/empaque'
import { ajustarAlPaso, opcionesDeCompra, pasoDeCantidad, sinCosto, textoDeLinea, type LineaCompra, type UnidadCompra } from '../lib/lineaCompra'

export interface ProductoComprable extends EmpaqueProducto {
  id: string
  nombre: string
  marca?: string | null
  codigoPropio?: string | null
  imageUrl?: string | null
  /** Stock real actual (catalogo-stock). */
  stockActual?: number | null
  /** Unidades vendidas desde la última compra del producto; sin valor si nunca se compró. */
  vendidoDesdeUltimaCompra?: number | null
}

interface Props {
  producto: ProductoComprable
  /** La línea del producto en la compra; sin línea, la tarjeta ofrece "Agregar". */
  linea?: LineaCompra
  onAgregar: (producto: ProductoComprable) => void
  /** Cambio de nivel o de cantidad desde la tarjeta (siempre una cantidad válida para su nivel). */
  onCambiar: (linea: LineaCompra) => void
  onQuitar: (productoId: string) => void
  /** Abre "Cantidad y costo" con la línea. */
  onAbrir: (linea: LineaCompra) => void
}

const corto = (o: { unidad: UnidadCompra; unidades: number }) =>
  o.unidad === 'Unidad' ? 'Unid.' : `${o.unidad === 'Bulto' ? 'Bulto' : 'B. madre'} · ${mostrarNumero(o.unidades)}`

/** "Stock actual" y "Vendido desde la última compra", como en la web; sin dato (o sin compra previa) se dice con un guion. */
export function StockYVentas({ producto: p }: { producto: ProductoComprable }) {
  const c = useColors()
  const celda = (k: string, v: number | null | undefined) => (
    <View accessible accessibilityLabel={`${k}: ${typeof v === 'number' ? mostrarNumero(v) : 'sin dato'}`}
      style={{ flex: 1, minWidth: 0, gap: 2, paddingVertical: space[2], paddingHorizontal: space[3], borderRadius: radii.campo, backgroundColor: c.surface2 }}>
      <Text style={{ ...typeScale.etiqueta, color: c.textSecondary }}>{k}</Text>
      <Text style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.text }}>{typeof v === 'number' ? mostrarNumero(v) : '—'}</Text>
    </View>
  )
  return (
    <View testID={`stock-${p.id}`} style={{ flexDirection: 'row', alignItems: 'stretch', gap: space[2] }}>
      {celda('Stock actual', p.stockActual)}
      {celda('Vendido desde la última compra', p.vendidoDesdeUltimaCompra)}
    </View>
  )
}

/**
 * Tarjeta del catálogo de la compra (maqueta "Compras como venta", frames 5 y 6; copia la tarjeta del catálogo de la venta):
 * foto, marca y código, cómo viene el producto y, si ya está en la compra, cuánto se pide, a qué costo por unidad (o
 * "Falta el costo") y el nivel con −/+. El costo se carga en "Cantidad y costo": tocar la tarjeta la abre.
 */
export function ProductoCompraCard({ producto: p, linea, onAgregar, onCambiar, onQuitar, onAbrir }: Props) {
  const c = useColors()
  const img = getFullImageUrl(p.imageUrl ?? undefined)
  const empaque = presentacionEmpaque(p)
  const enCompra = !!linea
  const falta = linea ? sinCosto(linea) : false

  const cambiarUnidad = (u: UnidadCompra) => {
    if (!linea || u === linea.unidad) return
    const unidades = opcionesDeCompra(p, linea).find((o) => o.unidad === u)?.unidades ?? 1
    // Al cambiar de nivel se conserva el número (un bulto es entero) y se lleva al paso del nivel nuevo.
    onCambiar({ ...linea, unidad: u, unidadesPorUnidad: unidades, cantidad: ajustarAlPaso(u, Math.max(1, Math.round(linea.cantidad)), p) })
  }
  const sumar = (d: number) => {
    if (!linea) return
    const paso = pasoDeCantidad(linea.unidad, p)
    const nueva = Math.floor(linea.cantidad / paso) * paso + d * paso
    if (nueva <= 0) onQuitar(linea.productoId)
    else onCambiar({ ...linea, cantidad: nueva })
  }

  return (
    <View testID={`producto-${p.id}`} style={{ gap: space[3], padding: space[3], borderRadius: radii.tarjeta, borderWidth: enCompra ? 2 : 1, borderColor: enCompra ? (falta ? c.danger : c.brand) : c.border, backgroundColor: c.surface }}>
      <Pressable accessibilityRole="button" accessibilityLabel={linea ? `Cantidad y costo de ${p.nombre}` : p.nombre} disabled={!linea}
        onPress={() => { if (linea) onAbrir(linea) }} style={{ flexDirection: 'row', gap: space[3] }}>
        <View style={{ width: 56, height: 56, borderRadius: radii.campo, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {img ? <ExpoImage source={img} style={{ width: 56, height: 56 }} contentFit="cover" /> : <Package size={28} color={c.textSecondary} />}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: space[1] }}>
          <ProductoIdentidad nombre={p.nombre} marca={p.marca} codigo={p.codigoPropio} />
          {empaque.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[1] }}>
              {empaque.map((e) => (
                <Text key={e} style={{ ...typeScale.etiqueta, color: c.textSecondary, backgroundColor: c.surface2, borderRadius: radii.pastilla, paddingHorizontal: space[2], paddingVertical: 2 }}>{e}</Text>
              ))}
            </View>
          ) : null}
          {linea ? (
            <Text style={{ ...typeScale.secundario, ...importe, color: c.text }}>
              <Text style={{ fontFamily: FONT.semibold }}>{textoDeLinea(linea)}</Text>
              {falta ? null : ` · ${formatImporte(linea.costoUnitario)} por unidad`}
            </Text>
          ) : null}
          {falta ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.danger }} />
              <Text style={{ ...typeScale.secundario, color: c.chip.anulado.text }}>Falta el costo</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
      <StockYVentas producto={p} />
      {linea ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space[2] }}>
          <Segmented accessibilityLabel={`Unidad de compra de ${p.nombre}`} value={linea.unidad} onChange={cambiarUnidad}
            options={opcionesDeCompra(p, linea).map((o) => ({ value: o.unidad, label: corto(o) }))} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
            <Redondo c={c} label="−" a11y={`Restar ${p.nombre}`} onPress={() => sumar(-1)} />
            <Text accessibilityLabel={`Cantidad de ${p.nombre}: ${mostrarNumero(linea.cantidad)}`} style={{ ...typeScale.cuerpoDestacado, ...importe, minWidth: 32, textAlign: 'center', color: c.text }}>{mostrarNumero(linea.cantidad)}</Text>
            <Redondo c={c} label="+" a11y={`Sumar ${p.nombre}`} onPress={() => sumar(1)} />
          </View>
        </View>
      ) : (
        <Button label="Agregar" variant="secundario" accessibilityLabel={`Agregar ${p.nombre}`} onPress={() => onAgregar(p)} />
      )}
    </View>
  )
}
