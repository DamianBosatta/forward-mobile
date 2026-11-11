import React from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import { AlertTriangle, Package } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { StatusChip } from '@/core/ui/fw'
import { ProductoIdentidad } from '@/core/ui/fw/ProductoIdentidad'
import { mostrarNumero } from '@/core/utils/numero'
import { getFullImageUrl } from '@/libs/api-client/media'
import type { StockItem } from '@/libs/api-client/types'
import { chipDeFilaStock, textoReservadas, textoStockReal } from '../lib/stock-presentacion'

/** Foto del producto o, sin foto, el ícono de paquete (web ProductoCard). */
export function FotoDeProducto({ imageUrl, alto }: { imageUrl?: string | null; alto: number }) {
  const c = useColors()
  const foto = getFullImageUrl(imageUrl)
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ height: alto, borderRadius: radii.campo, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
    >
      {foto ? <Image source={{ uri: foto }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Package size={28} color={c.textSecondary} strokeWidth={1.6} />}
    </View>
  )
}

interface TarjetaProps {
  item: StockItem
  onPress: (item: StockItem) => void
}

/**
 * Tarjeta de producto de la web (ProductoCard): foto, marca, nombre y código, el disponible para vender grande con
 * "disponible", o en ámbar con "En alerta" (ícono y texto, nunca solo el color). Tocarla abre el detalle. Sin el menú
 * de acciones de la web: mobile solo mira.
 */
export function TarjetaDeProducto({ item, onPress }: TarjetaProps) {
  const c = useColors()
  const alerta = item.enAlerta === true
  const disponible = mostrarNumero(item.cantidadDisponible ?? 0)
  const ambar = c.chip.porAutorizar.text
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.producto}, disponible: ${disponible}${alerta ? ', en alerta de stock' : ''}`}
      onPress={() => onPress(item)}
      android_ripple={{ color: c.border }}
      style={{
        flex: 1,
        minWidth: 0,
        gap: space[2],
        padding: space[3],
        borderRadius: radii.tarjeta,
        backgroundColor: c.surface,
        borderWidth: alerta ? 2 : 0,
        borderColor: alerta ? c.chip.porAutorizar.bg : 'transparent',
      }}
    >
      <FotoDeProducto imageUrl={item.imageUrl} alto={72} />
      <ProductoIdentidad nombre={item.producto} marca={item.marca} codigo={item.codigoPropio} />
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: space[1] }}>
        <Text style={[typeScale.titulo, importe, { color: alerta ? ambar : c.text }]}>{disponible}</Text>
        {alerta ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
            <AlertTriangle size={14} color={ambar} />
            <Text style={[typeScale.etiqueta, { color: ambar }]}>En alerta</Text>
          </View>
        ) : (
          <Text style={[typeScale.secundario, { color: c.textSecondary }]}>disponible</Text>
        )}
      </View>
    </Pressable>
  )
}

interface TarjetaLineaProps extends TarjetaProps {
  abierta: boolean
  onAlternar: () => void
}

/**
 * Línea con fragancias (web LineaCard): una sola tarjeta con el total de la línea "en stock (línea)" (lo suma el
 * servidor) y "Ver fragancias", que despliega el panel de la línea debajo. Tocar la tarjeta abre su detalle.
 */
export function TarjetaDeLinea({ item, onPress, abierta, onAlternar }: TarjetaLineaProps) {
  const c = useColors()
  const disponible = mostrarNumero(item.cantidadDisponible ?? 0)
  return (
    <View style={{ flex: 1, minWidth: 0, borderRadius: radii.tarjeta, backgroundColor: c.surface, padding: space[3], gap: space[2] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.producto}, total en stock: ${disponible}`}
        onPress={() => onPress(item)}
        android_ripple={{ color: c.border }}
        style={{ gap: space[2] }}
      >
        <FotoDeProducto imageUrl={item.imageUrl} alto={72} />
        <ProductoIdentidad nombre={item.producto} marca={item.marca} codigo={item.codigoPropio} />
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: space[1] }}>
          <Text style={[typeScale.titulo, importe, { color: c.text }]}>{disponible}</Text>
          <Text style={[typeScale.secundario, { color: c.textSecondary }]}>en stock (línea)</Text>
        </View>
      </Pressable>
      <BotonFragancias abierta={abierta} onPress={onAlternar} />
    </View>
  )
}

/** "Ver fragancias" / "Ocultar fragancias", con el estado plegado o desplegado para el lector de pantalla. */
export function BotonFragancias({ abierta, onPress }: { abierta: boolean; onPress: () => void }) {
  const c = useColors()
  const label = abierta ? 'Ocultar fragancias' : 'Ver fragancias'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded: abierta }}
      onPress={onPress}
      android_ripple={{ color: c.border }}
      style={{ minHeight: 44, justifyContent: 'center' }}
    >
      <Text style={[typeScale.cuerpoDestacado, { color: c.brandInk }]}>{label}</Text>
    </Pressable>
  )
}

interface FilaListaProps extends TarjetaProps {
  conDeposito: boolean
  linea?: { abierta: boolean; onAlternar: () => void }
}

/**
 * Renglón de la Lista del teléfono (web InventarioTableView): lo que la tabla tiene en columnas, en renglones:
 * disponible grande con su chip, stock real y mínimo, reservado y por entrar. Sin casillas de selección.
 */
export function FilaDeLista({ item, onPress, conDeposito, linea }: FilaListaProps) {
  const c = useColors()
  const chip = chipDeFilaStock(item)
  const color = item.cantidadDisponible > 0 && item.enAlerta ? c.chip.porAutorizar.text : c.text
  return (
    <View style={{ borderRadius: radii.tarjeta, backgroundColor: c.surface, padding: space[3], gap: space[1] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.producto}, ${item.codigoPropio}`}
        onPress={() => onPress(item)}
        android_ripple={{ color: c.border }}
        style={{ flexDirection: 'row', gap: space[3] }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: space[1] }}>
          <ProductoIdentidad nombre={item.producto} marca={item.marca} codigo={item.codigoPropio} />
          {conDeposito && item.deposito ? <Text numberOfLines={1} style={[typeScale.secundario, { color: c.textSecondary }]}>{item.deposito}</Text> : null}
          <Text style={[typeScale.secundario, { color: c.textSecondary }]}>{textoStockReal(item.cantidadActual, item.stockMinimo)}</Text>
          <Text style={[typeScale.secundario, { color: c.textSecondary }]}>{textoReservadas(item.cantidadReservada, item.cantidadVirtual)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: space[1] }}>
          <Text accessibilityLabel={`Disponible ${mostrarNumero(item.cantidadDisponible)}`} style={[typeScale.titulo, importe, { color }]}>
            {mostrarNumero(item.cantidadDisponible)}
          </Text>
          {chip ? <StatusChip estado={chip.estado} label={chip.label} /> : null}
        </View>
      </Pressable>
      {linea ? <BotonFragancias abierta={linea.abierta} onPress={linea.onAlternar} /> : null}
    </View>
  )
}

const COLUMNAS = ['Disponible', 'Stock real', 'Reservado', 'Por entrar', 'Mínimo'] as const

function CeldaNumero({ children, fuerte }: { children: string; fuerte?: boolean }) {
  const c = useColors()
  return <Text style={[fuerte ? typeScale.cuerpoDestacado : typeScale.cuerpo, importe, { width: 92, textAlign: 'right', color: c.text }]}>{children}</Text>
}

/** Renglón de la Lista en tablet: Producto · Disponible · Stock real · Reservado · Por entrar · Mínimo (columnas de la web). */
export function FilaDeTabla({ item, onPress, conDeposito, linea }: FilaListaProps) {
  const c = useColors()
  const chip = chipDeFilaStock(item)
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: radii.campo, paddingHorizontal: space[3] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.producto}, ${item.codigoPropio}`}
        onPress={() => onPress(item)}
        android_ripple={{ color: c.border }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 56 }}
      >
        <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <View style={{ flexShrink: 1 }}>
            <ProductoIdentidad nombre={item.producto} marca={item.marca} codigo={item.codigoPropio} lineasNombre={1} />
            {conDeposito && item.deposito ? <Text numberOfLines={1} style={[typeScale.secundario, { color: c.textSecondary }]}>{item.deposito}</Text> : null}
          </View>
          {chip ? <StatusChip estado={chip.estado} label={chip.label} /> : null}
        </View>
        <CeldaNumero fuerte>{mostrarNumero(item.cantidadDisponible)}</CeldaNumero>
        <CeldaNumero>{mostrarNumero(item.cantidadActual)}</CeldaNumero>
        <CeldaNumero>{mostrarNumero(item.cantidadReservada)}</CeldaNumero>
        <CeldaNumero>{mostrarNumero(item.cantidadVirtual)}</CeldaNumero>
        <CeldaNumero>{mostrarNumero(item.stockMinimo)}</CeldaNumero>
      </Pressable>
      {linea ? <BotonFragancias abierta={linea.abierta} onPress={linea.onAlternar} /> : null}
    </View>
  )
}

export function CabeceraDeTabla() {
  const c = useColors()
  return (
    <View style={{ flexDirection: 'row', gap: space[2], paddingHorizontal: space[3], paddingBottom: space[1] }}>
      <Text style={[typeScale.secundario, { flex: 1, color: c.textSecondary }]}>Producto</Text>
      {COLUMNAS.map((label) => (
        <Text key={label} style={[typeScale.secundario, { width: 92, textAlign: 'right', color: c.textSecondary }]}>{label}</Text>
      ))}
    </View>
  )
}

/** Sin cantidades: la tarjeta de la web sin número, con "Hay stock" o "Sin stock" como hoy (lámina 7). */
export function TarjetaSinCantidades({ nombre, marca, codigo, imageUrl, chip }: { nombre: string; marca?: string | null; codigo: string; imageUrl?: string | null; chip: React.ReactNode }) {
  const c = useColors()
  return (
    <View accessibilityLabel={`${nombre}, ${codigo}`} style={{ flex: 1, minWidth: 0, gap: space[2], padding: space[3], borderRadius: radii.tarjeta, backgroundColor: c.surface }}>
      <FotoDeProducto imageUrl={imageUrl} alto={72} />
      <ProductoIdentidad nombre={nombre} marca={marca} codigo={codigo} />
      {chip}
    </View>
  )
}
