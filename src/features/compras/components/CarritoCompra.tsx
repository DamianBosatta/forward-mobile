import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Plus } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors, useSombraTarjeta } from '@/libs/theme'
import { Field, Notice, TotalsRow, formatImporte } from '@/core/ui/fw'
import { ProductoIdentidad } from '@/core/ui/fw/ProductoIdentidad'
import { useProducto } from '@/libs/api-client/productos'
import { sinCosto, subtotalDe, textoDeLinea, type LineaCompra } from '../lib/lineaCompra'

/** Aviso de las líneas sin costo: lo usan el carrito y la recepción. */
export function textoFaltaCosto(faltan: number): string {
  return `${faltan === 1 ? 'Una línea no tiene' : `${faltan} líneas no tienen`} costo. El sistema nunca lo inventa: cargalo en los productos antes de confirmar.`
}

/** Marca y código del producto de la línea: salen de la ficha (la misma consulta cacheada que usa "Cantidad y costo"). */
function IdentidadDeLinea({ productoId, nombre }: { productoId: string; nombre: string }) {
  const { data: ficha } = useProducto(productoId)
  return <ProductoIdentidad nombre={nombre} marca={ficha?.marca} codigo={ficha?.codigoPropio} />
}

interface Props {
  lineas: LineaCompra[]
  /** Vuelve al catálogo (paso 2). */
  onEditarProductos: () => void
  /** Abre "Cantidad y costo" de la línea. */
  onAbrirLinea: (linea: LineaCompra) => void
  gastosTexto: string
  onGastos: (texto: string) => void
  gastosInvalidos: boolean
  subtotal: number
  gastos: number
  /** Lo que va abajo de los totales (en edición, el depósito). */
  extra?: React.ReactNode
}

/**
 * Paso 3 de la compra nueva (maqueta "Compras como venta", frames 10 y 11; copia el carrito de la venta): cada línea con
 * su subtotal, la cantidad y el costo por unidad; tocarla abre "Cantidad y costo". Los gastos operativos quedan acá, donde
 * la venta pone el descuento a toda la venta. Con un costo faltante se puede seguir al paso 4, pero ahí no se confirma.
 */
export function CarritoCompra({ lineas, onEditarProductos, onAbrirLinea, gastosTexto, onGastos, gastosInvalidos, subtotal, gastos, extra }: Props) {
  const c = useColors()
  const sombra = useSombraTarjeta()
  const faltan = lineas.filter(sinCosto).length
  const secundario = { ...typeScale.secundario, color: c.textSecondary }
  const tarjeta = { padding: space[4], borderRadius: radii.tarjeta, borderWidth: 1, borderColor: c.border, ...sombra, backgroundColor: c.surface }

  return (
    <View style={{ gap: space[3] }}>
      {faltan > 0 ? <Notice tone="peligro" title="Falta el costo.">{textoFaltaCosto(faltan)}</Notice> : null}
      <View style={{ ...tarjeta, paddingVertical: space[2] }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>Productos</Text>
          <Pressable accessibilityRole="link" accessibilityLabel="Editar los productos" onPress={onEditarProductos} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ ...typeScale.cuerpoDestacado, color: c.brandInk }}>Editar</Text>
          </Pressable>
        </View>
        {lineas.length === 0 ? <Text style={{ ...secundario, paddingVertical: space[3] }}>Todavía no hay productos.</Text> : null}
        {lineas.map((l, i) => {
          const falta = sinCosto(l)
          return (
            <Pressable key={l.productoId} accessibilityRole="button" accessibilityLabel={`Cantidad y costo de ${l.nombre}`} onPress={() => onAbrirLinea(l)}
              android_ripple={{ color: c.surface2 }}
              style={{ gap: space[1], paddingVertical: space[3], borderTopWidth: 1, borderTopColor: c.border, borderBottomWidth: i === lineas.length - 1 ? 0 : 0 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space[2] }}>
                <View style={{ flex: 1, minWidth: 0 }}><IdentidadDeLinea productoId={l.productoId} nombre={l.nombre} /></View>
                <Text style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.text }}>{falta ? '—' : formatImporte(subtotalDe(l))}</Text>
              </View>
              <Text style={secundario}>{textoDeLinea(l)}</Text>
              {falta ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.danger }} />
                    <Text style={{ ...typeScale.secundario, color: c.chip.anulado.text }}>Falta el costo</Text>
                  </View>
                  <Text style={{ ...typeScale.cuerpoDestacado, color: c.brandInk }}>Cargar el costo</Text>
                </View>
              ) : <Text style={{ ...secundario, ...importe }}>{`${formatImporte(l.costoUnitario)} por unidad`}</Text>}
            </Pressable>
          )
        })}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Agregar productos" onPress={onEditarProductos}
        android_ripple={{ color: c.surface2 }}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2], borderRadius: radii.campo, borderWidth: 1, borderStyle: 'dashed', borderColor: c.textSecondary }}>
        <Plus size={20} color={c.text} />
        <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>Agregar productos</Text>
      </Pressable>
      <View style={{ ...tarjeta, gap: space[2] }}>
        <Field label="Gastos operativos ($)" keyboardType="decimal-pad" alignRight value={gastosTexto} placeholder="0,00"
          error={gastosInvalidos ? 'Escribí un importe válido, por ejemplo 1.500,50.' : undefined} onChangeText={onGastos} />
        <TotalsRow label={faltan > 0 ? 'Subtotal (falta un costo)' : 'Subtotal'} importe={subtotal} />
        <TotalsRow label="Gastos operativos" importe={gastos} />
      </View>
      {extra}
    </View>
  )
}
