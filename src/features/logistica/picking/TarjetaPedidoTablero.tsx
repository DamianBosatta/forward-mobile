import React, { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { CalendarDays, Clock, History, Package, Route, UserRound, type LucideIcon } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { diaCorto, estaAtrasado, textoPaso, textoUltimoCambio, type VentaTablero } from './tablero'
import { etiquetaMetodo } from '@/core/utils/metodoEntrega'
import { pesoSemibold } from '@/core/ui/fw'


export interface OpcionesTarjeta {
  /** "Entrega" en el flujo normal, "Entrega fallida" en No entregado. */
  etiquetaFecha?: string
  /** No entregado lo apaga: ahí la fecha ya es la fallida. */
  marcarAtraso?: boolean
  /** "N ítems · M unidades", solo donde todavía se arma. */
  mostrarItems?: boolean
  /** "En hoja …" cuando ya tiene camión (Empacados). */
  mostrarHoja?: boolean
  /** Las piezas del paquete (Empacados). */
  mostrarPiezas?: boolean
  /** Receta "hecho" (Empacados): tarjeta teal con texto `ink`, etiquetas lima o tinta y el bloque de piezas en tinta con lima. */
  hecho?: boolean
  /** Quién y cuándo lo cambió por última vez. */
  mostrarUltimoCambio?: boolean
}

type TonoEtiqueta = 'neutra' | 'atencion' | 'clave'

function Etiqueta({ texto, icono: Icono, tono = 'neutra', hecho = false }: { texto: string; icono?: LucideIcon; tono?: TonoEtiqueta; hecho?: boolean }) {
  const c = useColors()
  // Sobre la tarjeta teal: la etiqueta neutra pasa a tinta con lima y la de clave a lima con tinta.
  const colores =
    tono === 'atencion' ? { bg: c.warning, text: c.onState }
    : tono === 'clave' ? { bg: c.lime, text: c.ink }
    : hecho ? { bg: c.ink, text: c.lime }
    : { bg: c.surfaceAlt, text: c.text }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1], height: 28, borderRadius: radii.pastilla, paddingHorizontal: space[3], backgroundColor: colores.bg }}>
      {Icono ? <Icono size={14} color={colores.text} strokeWidth={2.5} /> : null}
      <Text maxFontSizeMultiplier={1.3} style={{ ...typeScale.etiquetaChip, color: colores.text }}>{texto}</Text>
    </View>
  )
}

function Dato({ icono: Icono, children, hecho = false, unaLinea = false }: { icono: LucideIcon; children: React.ReactNode; hecho?: boolean; unaLinea?: boolean }) {
  const c = useColors()
  const color = hecho ? c.ink : c.textSecondary
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
      <Icono size={16} color={color} />
      <Text numberOfLines={unaLinea ? 1 : undefined} style={{ ...typeScale.secundario, color, opacity: hecho ? 0.78 : 1, flex: 1 }}>{children}</Text>
    </View>
  )
}

const PASOS_VISIBLES = 1

/** Pasos del pedido (estado · usuario · fecha y hora), del más viejo al más nuevo; plegado se ve solo el último, en una línea. */
function ListaDePasos({ pasos, hecho }: { pasos: NonNullable<VentaTablero['pasos']>; hecho: boolean }) {
  const c = useColors()
  const [todos, setTodos] = useState(false)
  const ordenados = [...pasos].sort((a, b) => Date.parse(a.fecha) - Date.parse(b.fecha))
  const visibles = todos ? ordenados : ordenados.slice(-PASOS_VISIBLES)
  return (
    <View testID="pasos-pedido" style={{ gap: space[1] }}>
      {visibles.map((p, i) => (
        <Dato key={`${p.fecha}-${i}`} icono={History} hecho={hecho} unaLinea={!todos}>{textoPaso(p)}</Dato>
      ))}
      {ordenados.length > PASOS_VISIBLES ? (
        <Pressable
          onPress={() => setTodos((v) => !v)}
          android_ripple={{ color: c.surfaceAlt }}
          accessibilityRole="button"
          accessibilityLabel={todos ? 'Ver menos pasos' : 'Ver todos los pasos'}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={{ ...typeScale.secundario, ...pesoSemibold, color: hecho ? c.ink : c.text }}>{todos ? 'Ver menos' : `Ver todos (${ordenados.length})`}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

/**
 * Tarjeta del tablero, la `TarjetaPedido` de la web sin casilla ni botones (solo ver): código y etiquetas (Atrasado,
 * En hoja, método) arriba, la dirección en negrita y el cliente debajo, y un renglón con ícono por dato. Tocarla
 * abre el detalle del pedido.
 */
export function TarjetaPedidoTablero({ venta, hoy, opciones = {}, onAbrir, children }: { venta: VentaTablero; hoy: string; opciones?: OpcionesTarjeta; onAbrir: () => void; children?: React.ReactNode }) {
  const c = useColors()
  const { etiquetaFecha = 'Entrega', marcarAtraso = true, mostrarItems, mostrarHoja, mostrarPiezas, mostrarUltimoCambio, hecho = false } = opciones
  const codigo = venta.codigoPedido ?? venta.id.slice(0, 8).toUpperCase()
  const atrasado = marcarAtraso && estaAtrasado(venta.fechaEntrega, hoy)
  const dia = venta.fechaEntrega ? diaCorto(venta.fechaEntrega) : null
  const pasos = venta.pasos ?? []
  // Con pasos, el último ya dice quién y cuándo: la línea suelta no se repite.
  const ultimoCambio = mostrarUltimoCambio && pasos.length === 0 ? textoUltimoCambio(venta) : null
  return (
    // Los pasos quedan fuera del Pressable: su "Ver todos" es un botón propio, no puede anidarse en otro accesible.
    <View testID={`tarjeta-${venta.id}`} style={{ backgroundColor: hecho ? c.teal : c.surface, borderRadius: radii.tarjetaGrande, padding: space[5], gap: space[2] }}>
    <Pressable
      onPress={onAbrir}
      android_ripple={{ color: c.surfaceAlt }}
      accessibilityRole="button"
      accessibilityLabel={`Pedido ${codigo}: ${venta.direccion}`}
      accessibilityHint="Abre el detalle del pedido"
      style={{ gap: space[2] }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}>
        <Text style={{ ...typeScale.secundario, ...pesoSemibold, color: hecho ? c.ink : c.textSecondary, flex: 1 }} numberOfLines={1}>{codigo}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: space[1], flexShrink: 1 }}>
          {atrasado ? <Etiqueta texto="Atrasado" icono={Clock} tono="atencion" /> : null}
          {mostrarHoja && venta.hojaRutaCodigo ? <Etiqueta texto={`En hoja ${venta.hojaRutaCodigo}`} icono={Route} tono="clave" /> : null}
          <Etiqueta texto={etiquetaMetodo(venta.metodoEntrega, venta.metodoEntregaNombre)} hecho={hecho} />
        </View>
      </View>
      <View>
        {/* El cliente se identifica por la dirección; el nombre va aparte. */}
        <Text style={{ ...typeScale.cuerpoDestacado, color: hecho ? c.ink : c.text }} numberOfLines={2}>{venta.direccion}</Text>
        <Text style={{ ...typeScale.secundario, color: hecho ? c.ink : c.textSecondary, opacity: hecho ? 0.78 : 1 }}>{venta.clienteNombre}</Text>
      </View>
      <View style={{ gap: space[1] }}>
        {dia ? <Dato icono={CalendarDays} hecho={hecho}>{`${etiquetaFecha} ${dia}`}</Dato> : null}
        <Dato icono={UserRound} hecho={hecho}>{venta.vendedorNombre}</Dato>
        {mostrarItems ? <Dato icono={Package} hecho={hecho}>{`${venta.itemsCount} ítems · ${venta.unidadesCount ?? 0} unidades`}</Dato> : null}
        {ultimoCambio ? <Dato icono={History} hecho={hecho}>{ultimoCambio}</Dato> : null}
      </View>
      {/* Lo que cada columna suma abajo (No entregado: motivo, observaciones y chofer). */}
      {children}
      {mostrarPiezas ? (
        <View style={{ alignSelf: 'flex-start', minHeight: 48, justifyContent: 'center', borderRadius: radii.cantidad, paddingHorizontal: space[4], backgroundColor: hecho ? c.ink : c.lime }}>
          <Text style={{ ...typeScale.seccion, ...importe, color: hecho ? c.lime : c.ink }}>{`${venta.piezasCount} ${venta.piezasCount === 1 ? 'pieza' : 'piezas'}`}</Text>
        </View>
      ) : null}
    </Pressable>
      {pasos.length > 0 ? <ListaDePasos pasos={pasos} hecho={hecho} /> : null}
    </View>
  )
}
