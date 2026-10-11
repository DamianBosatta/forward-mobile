import React, { useState } from 'react'
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { Trash2 } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { Button, Field, Notice, Segmented, formatImporte } from '@/core/ui/fw'
import { useProducto } from '@/libs/api-client/productos'
import { leerNumero, mostrarNumero, numeroCompleto } from '@/src/utils/numero'
import { cambioDeCosto, unidadesDisponibles, type LineaCompra, type UnidadCompra } from '../lib/lineaCompra'

const NOMBRE: Record<UnidadCompra, [string, string]> = { Unidad: ['Unidad', 'Unidades'], Bulto: ['Bulto', 'Bultos'], BultoMadre: ['Bulto madre', 'Bultos madre'] }

interface Props {
  /** Línea a editar; null = cerrado. */
  linea: LineaCompra | null
  onClose: () => void
  onConfirm: (linea: LineaCompra) => void
  onQuitar: (productoId: string) => void
}

/**
 * Línea de compra (láminas CompraLinea y TabCompraLinea). Teléfono: pantalla completa; tablet:
 * panel a la derecha. Se compra por unidad, bulto o bulto madre; el costo es siempre por unidad.
 * El último costo sale de la ficha (`precioCompraBase`, solo con CAP_VER_COSTOS): sin él no hay
 * precarga ni aviso, y nunca se inventa uno.
 */
export function CompraLineaSheet(props: Props) {
  if (!props.linea) return null
  return <Contenido key={props.linea.productoId} {...props} linea={props.linea} />
}

function Contenido({ linea, onClose, onConfirm, onQuitar }: Props & { linea: LineaCompra }) {
  const c = useColors()
  const { isTablet } = useResponsive()
  const { data: ficha } = useProducto(linea.productoId)
  const [unidad, setUnidad] = useState(linea.unidad)
  const [cantidadTexto, setCantidadTexto] = useState(numeroCompleto(linea.cantidad))
  const [costoTexto, setCostoTexto] = useState(linea.costoUnitario === null ? '' : numeroCompleto(linea.costoUnitario))

  const opciones = unidadesDisponibles(ficha)
  if (!opciones.some((o) => o.unidad === linea.unidad)) opciones.push({ unidad: linea.unidad, unidades: linea.unidadesPorUnidad })
  const porUnidad = unidad === linea.unidad && !ficha ? linea.unidadesPorUnidad : opciones.find((o) => o.unidad === unidad)!.unidades
  const cantidad = leerNumero(cantidadTexto)
  // En bulto y bulto madre la cantidad es entera: el servidor no compra una fracción de bulto.
  const cantidadInvalida = cantidad === null || cantidad <= 0 || (unidad !== 'Unidad' && !Number.isInteger(cantidad))
  const costo = costoTexto.trim() === '' ? null : leerNumero(costoTexto)
  const costoInvalido = costo === null || costo <= 0
  const ultimo = ficha?.precioCompraBase ?? null
  const cambio = cambioDeCosto(costo, ultimo)
  const unidades = cantidadInvalida ? null : cantidad! * porUnidad
  const texto = (extra = {}) => ({ ...typeScale.cuerpoDestacado, color: c.text, ...extra })
  const sumar = (d: number) => setCantidadTexto(mostrarNumero(Math.max(1, Math.floor((cantidad ?? 0) + d))))

  return (
    <Modal visible transparent={isTablet} animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: isTablet ? c.veil : c.bg }}>
        {isTablet && <Pressable accessibilityRole="button" accessibilityLabel="Cerrar y volver a la compra" onPress={onClose} style={{ flex: 1 }} />}
        <View accessibilityLabel="Línea de compra" style={{ flex: isTablet ? undefined : 1, width: isTablet ? 440 : undefined, backgroundColor: c.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], padding: space[4], backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border }}>
            <View style={{ flex: 1 }}>
              {ficha?.codigoPropio ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{ficha.codigoPropio}</Text> : null}
              <Text style={texto()}>{linea.nombre}</Text>
              <Text style={{ ...typeScale.titulo, ...importe, color: c.text }}>
                {`Subtotal ${formatImporte(unidades !== null && !costoInvalido ? unidades * costo! : null)}`}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Quitar la línea" onPress={() => onQuitar(linea.productoId)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Trash2 size={22} color={c.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4] }}>
            {opciones.length > 1 ? (
              <View style={{ gap: space[1] }}>
                <Text style={{ ...typeScale.secundario, color: c.text }}>Se compra por</Text>
                <Segmented accessibilityLabel="Unidad de compra" value={unidad} onChange={setUnidad}
                  options={opciones.map((o) => ({ value: o.unidad, label: o.unidad === 'Unidad' ? 'Unidad' : `${NOMBRE[o.unidad][0]} × ${o.unidades}` }))} />
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] }}>
              <View style={{ flexShrink: 1 }}>
                <Text style={texto()}>{NOMBRE[unidad][1]}</Text>
                {unidad !== 'Unidad' && unidades !== null ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`= ${mostrarNumero(unidades)} unidades`}</Text> : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                <Redondo label="−" a11y="Restar" onPress={() => sumar(-1)} />
                <TextInput accessibilityLabel={NOMBRE[unidad][1]} keyboardType="decimal-pad" value={cantidadTexto} onChangeText={setCantidadTexto}
                  style={{ ...typeScale.cuerpoDestacado, ...importe, width: 72, height: 48, textAlign: 'center', borderRadius: radii.campo, borderWidth: 1, borderColor: cantidadInvalida ? c.chip.anulado.text : c.border, backgroundColor: c.surface2, color: c.text }} />
                <Redondo label="+" a11y="Sumar" onPress={() => sumar(1)} />
              </View>
            </View>
            {cantidadInvalida ? <Notice tone="peligro">{unidad === 'Unidad' ? 'La cantidad tiene que ser mayor a 0.' : 'Se compran bultos enteros: escribí un número sin decimales.'}</Notice> : null}
            <Field label="Costo por unidad ($)" keyboardType="decimal-pad" alignRight value={costoTexto} onChangeText={setCostoTexto}
              error={costoTexto.trim() !== '' && costoInvalido ? 'Escribí un costo mayor a 0, por ejemplo 1.150,50.' : undefined}
              help={`${ultimo ? `Último costo: ${formatImporte(ultimo)}. ` : ''}El costo es siempre por unidad, aunque compres por bulto.`} />
            {costo === null ? <Notice tone="advertencia">Falta el costo: el sistema nunca lo inventa. Sin costo no se puede confirmar la compra.</Notice> : null}
            {cambio ? (
              <Notice tone={cambio.fuerte ? 'advertencia' : 'info'} title={`${cambio.pct > 0 ? 'Sube' : 'Baja'} ${mostrarNumero(Math.abs(cambio.pct))} % respecto del último costo.`}>
                {`${cambio.fuerte ? 'Cambia más del 50 %: revisalo. ' : ''}Al confirmar la compra, este pasa a ser el costo del producto.`}
              </Notice>
            ) : null}
          </ScrollView>
          <View style={{ padding: space[4], borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface }}>
            <Button label="Confirmar" disabled={cantidadInvalida || costoInvalido}
              onPress={() => onConfirm({ ...linea, unidad, cantidad: cantidad!, unidadesPorUnidad: porUnidad, costoUnitario: costo })} />
          </View>
        </View>
      </View>
    </Modal>
  )
}

function Redondo({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  const c = useColors()
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress}
      style={{ width: 44, height: 44, borderRadius: radii.pastilla, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ ...typeScale.titulo, color: c.text }}>{label}</Text>
    </Pressable>
  )
}
