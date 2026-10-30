import React, { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { Notice, Segmented, Field, formatImporte } from '@/core/ui/fw'
import { Redondo } from '@/features/venta-nueva/components/ProductoCatalogoCard'
import { useProducto } from '@/libs/api-client/productos'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { leerNumero, mostrarNumero, numeroCompleto } from '@/src/utils/numero'
import {
  cambioDeCosto, nombreDeEmpaque, opcionesDeCompra, sinCosto, subtotalDe, textoDeEmpaque, textoDeCambioDeCosto,
  type LineaCompra, type UnidadCompra,
} from '../lib/lineaCompra'

interface Props {
  linea: LineaCompra
  /** Llega una línea válida cada vez que lo tipeado alcanza para una; un costo inválido llega como "sin costo". */
  onCambiar: (linea: LineaCompra) => void
  /** Abre la hoja de la línea (edición avanzada y quitar). */
  onEditar: (linea: LineaCompra) => void
}

/**
 * Tarjeta de producto del paso 2 de la compra nueva (mockup compras-nueva-2-productos): nombre y subtotal, "Bulto ×12 = 240 u",
 * selector de unidad, −/cantidad/+ y "Costo por unidad ($)". Sin costo la tarjeta se marca en rojo con la palabra "obligatorio":
 * el color nunca va solo. Misma validación que la hoja de la línea (CompraLineaSheet), que sigue para la edición avanzada.
 */
export function LineaCompraCard(props: Props) {
  return <Contenido key={props.linea.productoId} {...props} />
}

function Contenido({ linea, onCambiar, onEditar }: Props) {
  const c = useColors()
  const { data: ficha } = useProducto(linea.productoId)
  const [cantidadTexto, setCantidadTexto] = useState(numeroCompleto(linea.cantidad))
  const [costoTexto, setCostoTexto] = useState(linea.costoUnitario === null ? '' : numeroCompleto(linea.costoUnitario))
  const [unidad, setUnidad] = useState<UnidadCompra>(linea.unidad)

  const opciones = opcionesDeCompra(ficha, linea)
  const porUnidadDe = (u: UnidadCompra) => (u === linea.unidad && !ficha ? linea.unidadesPorUnidad : opciones.find((o) => o.unidad === u)?.unidades ?? 1)
  const cantidad = leerNumero(cantidadTexto)
  // En bulto y bulto madre la cantidad es entera: el servidor no compra una fracción de bulto.
  const cantidadInvalida = cantidad === null || cantidad <= 0 || (unidad !== 'Unidad' && !Number.isInteger(cantidad))
  const costo = costoTexto.trim() === '' ? null : leerNumero(costoTexto)
  const costoInvalido = costoTexto.trim() !== '' && (costo === null || costo <= 0)
  const ultimo = ficha?.precioCompraBase ?? null
  const cambio = cambioDeCosto(costo, ultimo)

  const aplicar = (u: UnidadCompra, cantTexto: string, cosTexto: string) => {
    const cant = leerNumero(cantTexto)
    if (cant === null || cant <= 0 || (u !== 'Unidad' && !Number.isInteger(cant))) return
    const cos = cosTexto.trim() === '' ? null : leerNumero(cosTexto)
    onCambiar({ ...linea, unidad: u, cantidad: cant, unidadesPorUnidad: porUnidadDe(u), costoUnitario: cos !== null && cos > 0 ? cos : null })
  }
  const cambiarCantidad = (t: string) => { setCantidadTexto(t); aplicar(unidad, t, costoTexto) }
  const cambiarCosto = (t: string) => { setCostoTexto(t); aplicar(unidad, cantidadTexto, t) }
  const cambiarUnidad = (u: UnidadCompra) => {
    // Pasar a bulto con una cantidad con decimales la redondea: el bulto es entero.
    const t = u !== 'Unidad' && cantidad !== null && !Number.isInteger(cantidad) ? mostrarNumero(Math.max(1, Math.round(cantidad))) : cantidadTexto
    setUnidad(u)
    setCantidadTexto(t)
    aplicar(u, t, costoTexto)
  }
  const sumar = (d: number) => cambiarCantidad(mostrarNumero(Math.max(1, Math.floor((cantidad ?? 0) + d))))

  const actual: LineaCompra = { ...linea, unidad, cantidad: cantidadInvalida ? linea.cantidad : cantidad!, unidadesPorUnidad: porUnidadDe(unidad), costoUnitario: costoInvalido ? null : costo }
  const falta = sinCosto(actual)
  const borde = falta ? c.danger : c.brand
  const nombrePlural = nombreDeEmpaque(unidad, true)

  return (
    <View testID={`linea-${linea.productoId}`} style={{ gap: space[3], padding: space[4], borderRadius: radii.tarjeta, backgroundColor: c.surface, borderWidth: 2, borderColor: borde }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Editar ${linea.nombre}`} onPress={() => onEditar(actual)}
        style={{ minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space[2] }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>{linea.nombre}</Text>
          <Text style={[typeScale.secundario, { color: c.textSecondary }]}>{cantidadInvalida ? '—' : textoDeEmpaque(actual)}</Text>
        </View>
        <Text style={[typeScale.cuerpoDestacado, importe, { color: falta ? c.danger : c.text }]}>{falta ? 'Sin costo' : formatImporte(subtotalDe(actual))}</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space[2] }}>
        {opciones.length > 1 ? (
          <Segmented accessibilityLabel="Unidad de compra" value={unidad} onChange={cambiarUnidad}
            options={opciones.map((o) => ({ value: o.unidad, label: nombreDeEmpaque(o.unidad) }))} />
        ) : <Text style={[typeScale.secundario, { color: c.textSecondary }]}>{nombrePlural}</Text>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
          <Redondo c={c} label="−" a11y={`Restar un ${nombreDeEmpaque(unidad).toLowerCase()} de ${linea.nombre}`} onPress={() => sumar(-1)} />
          <TextInput accessibilityLabel={`${nombrePlural} de ${linea.nombre}`} keyboardType="decimal-pad" value={cantidadTexto} onChangeText={cambiarCantidad}
            style={{ ...typeScale.cuerpoDestacado, ...importe, minWidth: 48, minHeight: 44, textAlign: 'center', paddingVertical: 0, borderRadius: radii.campo, borderWidth: 1, borderColor: cantidadInvalida ? c.danger : c.border, backgroundColor: c.surface2, color: c.text }} />
          <Redondo c={c} label="+" a11y={`Sumar un ${nombreDeEmpaque(unidad).toLowerCase()} de ${linea.nombre}`} onPress={() => sumar(1)} />
        </View>
      </View>
      {cantidadInvalida ? <Notice tone="peligro">{unidad === 'Unidad' ? 'La cantidad tiene que ser mayor a 0.' : 'Se compran bultos enteros: escribí un número sin decimales.'}</Notice> : null}
      <Field label="Costo por unidad ($)" labelSuffix={falta ? 'obligatorio' : undefined} invalid={falta} placeholder={falta ? 'Falta el costo' : undefined}
        keyboardType="decimal-pad" alignRight value={costoTexto} onChangeText={cambiarCosto}
        error={costoInvalido ? 'Escribí un costo mayor a 0, por ejemplo 1.150,50.' : undefined}
        help={ultimo ? `Último costo: ${formatImporte(ultimo)}. El costo es siempre por unidad, aunque compres por bulto.` : 'El costo es siempre por unidad, aunque compres por bulto.'} />
      {cambio ? <Notice tone="advertencia">{textoDeCambioDeCosto(cambio, formatImporte(ultimo))}</Notice> : null}
    </View>
  )
}
