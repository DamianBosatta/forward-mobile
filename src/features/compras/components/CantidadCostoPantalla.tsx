import React, { useState } from 'react'
import { Modal, ScrollView, Text, TextInput, View } from 'react-native'
import { Package, Trash2 } from 'lucide-react-native'
import { Image as ExpoImage } from 'expo-image'
import { FONT, importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, Field, Notice, PieFijo, Segmented, TopBar, formatImporte } from '@/core/ui/fw'
import { Redondo } from '@/features/venta-nueva/components/ProductoCatalogoCard'
import { getFullImageUrl } from '@/libs/api-client'
import { useProducto } from '@/libs/api-client/productos'
import { leerNumero, mostrarNumero, numeroCompleto } from '@/core/utils/numero'
import { presentacionEmpaque } from '@/core/utils/empaque'
import {
  cambioDeCosto, cantidadValida, nombreDeEmpaque, opcionesDeCompra, pasoDeCantidad, textoDeCambioDeCosto,
  type LineaCompra, type UnidadCompra,
} from '../lib/lineaCompra'

interface Props {
  /** Línea a cargar o editar; null = cerrada. */
  linea: LineaCompra | null
  onClose: () => void
  onListo: (linea: LineaCompra) => void
  onQuitar: (productoId: string) => void
}

/** Rótulo de cada nivel en el selector: "Unidad", "Bulto × 12", "Bulto madre × 48" (las unidades que trae). */
const rotulo = (o: { unidad: UnidadCompra; unidades: number }) => (o.unidad === 'Unidad' ? 'Unidad' : `${nombreDeEmpaque(o.unidad)} × ${o.unidades}`)

/**
 * "Cantidad y costo" (maqueta "Compras como venta", frames 7 a 9; copia "Cantidad y oferta" de la venta): se compra por
 * unidad, bulto o bulto madre y el costo es SIEMPRE por unidad. Es también la pantalla de editar una línea (tacho en la
 * barra). El último costo sale de la ficha (`precioCompraBase`, solo con CAP_VER_COSTOS): sin él no hay aviso, y nunca se
 * inventa uno. Sin costo o con una cantidad inválida no se sigue.
 */
export function CantidadCostoPantalla(props: Props) {
  if (!props.linea) return null
  return <Contenido key={props.linea.productoId} {...props} linea={props.linea} />
}

function Contenido({ linea, onClose, onListo, onQuitar }: Props & { linea: LineaCompra }) {
  const c = useColors()
  const { data: ficha } = useProducto(linea.productoId)
  const [unidad, setUnidad] = useState(linea.unidad)
  const [cantidadTexto, setCantidadTexto] = useState(numeroCompleto(linea.cantidad))
  const [costoTexto, setCostoTexto] = useState(linea.costoUnitario === null ? '' : numeroCompleto(linea.costoUnitario))

  const opciones = opcionesDeCompra(ficha, linea)
  const porUnidad = unidad === linea.unidad && !ficha ? linea.unidadesPorUnidad : opciones.find((o) => o.unidad === unidad)!.unidades
  const cantidad = leerNumero(cantidadTexto)
  const paso = pasoDeCantidad(unidad, ficha)
  // Bulto y bulto madre van enteros y Unidad de a pack, igual que venta.
  const cantidadInvalida = !cantidadValida(unidad, cantidad, ficha)
  const costo = costoTexto.trim() === '' ? null : leerNumero(costoTexto)
  const costoInvalido = costo === null || costo <= 0
  const ultimo = ficha?.precioCompraBase ?? null
  const cambio = cambioDeCosto(costo, ultimo)
  const unidades = cantidadInvalida ? null : cantidad! * porUnidad
  const subtotal = unidades !== null && !costoInvalido ? unidades * costo! : null
  const plural = nombreDeEmpaque(unidad, true)
  const sumar = (d: number) => setCantidadTexto(mostrarNumero(Math.max(paso, Math.floor((cantidad ?? 0) / paso) * paso + d * paso)))
  const errorCantidad = !cantidadInvalida ? null
    : cantidad === null || cantidad <= 0 ? 'La cantidad tiene que ser mayor a 0.'
    : unidad === 'Unidad' ? `Este producto se compra de a ${mostrarNumero(paso)} unidades: ${mostrarNumero(paso)}, ${mostrarNumero(paso * 2)}, ${mostrarNumero(paso * 3)}…`
    : 'Se compran bultos enteros: escribí un número sin decimales.'
  const marca = [ficha?.marca, ficha?.codigoPropio].filter(Boolean).join(' · ').toUpperCase()
  const empaque = presentacionEmpaque(ficha)
  const detalle = [...empaque, ultimo ? `último costo ${formatImporte(ultimo)}` : null].filter(Boolean).join(' · ')
  const img = getFullImageUrl(ficha?.imageUrl ?? undefined)
  const secundario = { ...typeScale.secundario, color: c.textSecondary }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View accessibilityLabel="Cantidad y costo" style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar title="Cantidad y costo" leading={{ kind: 'atras', onPress: onClose }}
          actions={[{ icon: Trash2, accessibilityLabel: 'Quitar la línea', onPress: () => onQuitar(linea.productoId) }]} />
        <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4] }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', gap: space[3] }}>
            <View style={{ width: 84, height: 84, borderRadius: radii.campo, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {img ? <ExpoImage source={img} style={{ width: 84, height: 84 }} contentFit="cover" /> : <Package size={32} color={c.textSecondary} />}
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: space[1] }}>
              {marca ? <Text style={{ ...typeScale.etiqueta, color: c.textSecondary }}>{marca}</Text> : null}
              <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>{linea.nombre}</Text>
              {detalle ? <Text style={secundario}>{detalle}</Text> : null}
            </View>
          </View>

          <Text style={{ ...typeScale.seccion, color: c.text }}>Cantidad</Text>
          <View style={{ gap: space[1] }}>
            <Text style={{ ...typeScale.secundario, fontFamily: FONT.semibold, color: c.text }}>Se compra por</Text>
            <Segmented accessibilityLabel="Unidad de compra" value={unidad} onChange={setUnidad}
              options={opciones.map((o) => ({ value: o.unidad, label: rotulo(o) }))} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <Redondo c={c} label="−" a11y="Restar" onPress={() => sumar(-1)} />
            <TextInput accessibilityLabel={plural} keyboardType="decimal-pad" value={cantidadTexto} onChangeText={setCantidadTexto}
              accessibilityHint={errorCantidad ?? undefined}
              style={{ ...typeScale.cuerpoDestacado, ...importe, flex: 1, height: 48, textAlign: 'center', borderRadius: radii.campo, borderWidth: cantidadInvalida ? 2 : 1, borderColor: cantidadInvalida ? c.danger : c.border, backgroundColor: c.surface2, color: c.text }} />
            <Redondo c={c} label="+" a11y="Sumar" onPress={() => sumar(1)} />
          </View>
          {errorCantidad ? <Text style={{ ...typeScale.secundario, color: c.chip.anulado.text, textAlign: 'center' }}>{errorCantidad}</Text>
            : unidad !== 'Unidad' && unidades !== null ? <Text style={{ ...secundario, textAlign: 'center' }}>{`= ${mostrarNumero(unidades)} unidades`}</Text> : null}

          <View style={{ gap: space[3], padding: space[4], borderRadius: radii.tarjeta, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
            <Text style={{ ...typeScale.seccion, color: c.text }}>Costo</Text>
            <Field label="Costo por unidad ($)" keyboardType="decimal-pad" alignRight value={costoTexto} onChangeText={setCostoTexto}
              placeholder="Falta el costo" invalid={costo === null}
              error={costoTexto.trim() !== '' && costoInvalido ? 'Escribí un costo mayor a 0, por ejemplo 1.150,50.' : undefined}
              help={`${ultimo ? `Último costo: ${formatImporte(ultimo)}. ` : ''}El costo es siempre por unidad, aunque compres por bulto.`} />
            {costo === null ? <Notice tone="peligro" title="Falta el costo.">Sin costo no se puede confirmar la compra. El sistema nunca lo inventa.</Notice> : null}
            {cambio ? (
              cambio.fuerte
                ? <Notice tone="advertencia">{textoDeCambioDeCosto(cambio, formatImporte(ultimo))}</Notice>
                : <Notice tone="advertencia">{`${cambio.pct > 0 ? 'Sube' : 'Baja'} ${mostrarNumero(Math.round(Math.abs(cambio.pct) * 10) / 10)} % respecto del último costo.`}</Notice>
            ) : null}
          </View>
        </ScrollView>
        <PieFijo conInsetInferior>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[3] }}>
            <Text style={{ ...secundario, ...importe }}>{subtotal !== null ? `${mostrarNumero(cantidad!)} × ${formatImporte(porUnidad * costo!)}` : 'Subtotal'}</Text>
            <Text style={{ ...typeScale.titulo, ...importe, color: c.text }}>{subtotal !== null ? formatImporte(subtotal) : costo === null ? 'Sin costo' : '$ —'}</Text>
          </View>
          <Button label="Listo, seguir cargando" disabled={cantidadInvalida || costoInvalido}
            onPress={() => onListo({ ...linea, unidad, cantidad: cantidad!, unidadesPorUnidad: porUnidad, costoUnitario: costo })} />
        </PieFijo>
      </View>
    </Modal>
  )
}
