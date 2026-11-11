import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { CalendarDays, Clock, History, Package, Route, UserRound, type LucideIcon } from 'lucide-react-native'
import { FONT, importe, radii, shadowMd, space, typeScale, useColors, useIsDark, type ChipEstado } from '@/libs/theme'
import { diaCorto, estaAtrasado, etiquetaMetodo, textoUltimoCambio, type VentaTablero } from './tablero'

const semibold = { fontFamily: FONT.semibold, fontWeight: '600' as const }

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
  /** Quién y cuándo lo cambió por última vez. */
  mostrarUltimoCambio?: boolean
}

function Etiqueta({ texto, icono: Icono, tono }: { texto: string; icono?: LucideIcon; tono?: ChipEstado }) {
  const c = useColors()
  const colores = tono ? c.chip[tono] : { bg: c.surface2, text: c.text }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1], borderRadius: radii.pastilla, paddingHorizontal: space[2], paddingVertical: 2, backgroundColor: colores.bg }}>
      {Icono ? <Icono size={12} color={colores.text} /> : null}
      <Text maxFontSizeMultiplier={1.3} style={{ ...typeScale.etiqueta, color: colores.text }}>{texto}</Text>
    </View>
  )
}

function Dato({ icono: Icono, children }: { icono: LucideIcon; children: React.ReactNode }) {
  const c = useColors()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
      <Icono size={16} color={c.textSecondary} />
      <Text style={{ ...typeScale.secundario, color: c.textSecondary, flex: 1 }}>{children}</Text>
    </View>
  )
}

/**
 * Tarjeta del tablero, la `TarjetaPedido` de la web sin casilla ni botones (solo ver): código y etiquetas (Atrasado,
 * En hoja, método) arriba, la dirección en negrita y el cliente debajo, y un renglón con ícono por dato. Tocarla
 * abre el detalle del pedido.
 */
export function TarjetaPedidoTablero({ venta, hoy, opciones = {}, onAbrir }: { venta: VentaTablero; hoy: string; opciones?: OpcionesTarjeta; onAbrir: () => void }) {
  const c = useColors()
  const sombra = shadowMd[useIsDark() ? 'dark' : 'light']
  const { etiquetaFecha = 'Entrega', marcarAtraso = true, mostrarItems, mostrarHoja, mostrarPiezas, mostrarUltimoCambio } = opciones
  const codigo = venta.codigoPedido ?? venta.id.slice(0, 8).toUpperCase()
  const atrasado = marcarAtraso && estaAtrasado(venta.fechaEntrega, hoy)
  const dia = venta.fechaEntrega ? diaCorto(venta.fechaEntrega) : null
  const ultimoCambio = mostrarUltimoCambio ? textoUltimoCambio(venta) : null
  return (
    <Pressable
      testID={`tarjeta-${venta.id}`}
      onPress={onAbrir}
      android_ripple={{ color: c.surface2 }}
      accessibilityRole="button"
      accessibilityLabel={`Pedido ${codigo}: ${venta.direccion}`}
      accessibilityHint="Abre el detalle del pedido"
      style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[3], gap: space[2], ...sombra }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}>
        <Text style={{ ...typeScale.secundario, ...semibold, color: c.textSecondary, flex: 1 }} numberOfLines={1}>{codigo}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: space[1], flexShrink: 1 }}>
          {atrasado ? <Etiqueta texto="Atrasado" icono={Clock} tono="porAutorizar" /> : null}
          {mostrarHoja && venta.hojaRutaCodigo ? <Etiqueta texto={`En hoja ${venta.hojaRutaCodigo}`} icono={Route} tono="enCurso" /> : null}
          <Etiqueta texto={etiquetaMetodo(venta.metodoEntrega, venta.metodoEntregaNombre)} />
        </View>
      </View>
      <View>
        {/* El cliente se identifica por la dirección; el nombre va aparte. */}
        <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }} numberOfLines={2}>{venta.direccion}</Text>
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{venta.clienteNombre}</Text>
      </View>
      <View style={{ gap: space[1] }}>
        {dia ? <Dato icono={CalendarDays}>{`${etiquetaFecha} ${dia}`}</Dato> : null}
        <Dato icono={UserRound}>{venta.vendedorNombre}</Dato>
        {mostrarItems ? <Dato icono={Package}>{`${venta.itemsCount} ítems · ${venta.unidadesCount ?? 0} unidades`}</Dato> : null}
        {ultimoCambio ? <Dato icono={History}>{ultimoCambio}</Dato> : null}
      </View>
      {mostrarPiezas ? (
        <Text style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.text }}>{`${venta.piezasCount} ${venta.piezasCount === 1 ? 'pieza' : 'piezas'}`}</Text>
      ) : null}
    </Pressable>
  )
}
