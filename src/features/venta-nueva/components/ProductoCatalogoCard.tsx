import React, { useState } from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import { Package } from 'lucide-react-native'
import { radii, space, typeScale, importe, useColors, type ForwardColors } from '@/libs/theme'
import { formatImporte } from '@/core/ui/fw'
import type { CatalogoStockItem } from '@/libs/api-client'
import { cantidadEnPresentacion, multiploDe, precioServidor, stockDeTarjeta, subtotalLinea, unidadesPorBultoDe, vendePorBulto, type LineaCarrito } from '../lib/carrito'
import { mostrarNumero } from '../lib/linea'
import { convertirModo, modoDeCantidad, presentacionDe, rotuloPresentacion, unidadesDe, valorEn, type ModoCantidad } from '../lib/presentacion'
import { TOPE_CANTIDAD } from '../lib/teclado'
import { SeVendePor } from './SeVendePor'

interface ProductoCatalogoCardProps {
  producto: CatalogoStockItem
  /** Cantidad en el carrito, en unidades (0 = no está). */
  cantidad: number
  /** Ve cantidades de stock (capacidad CAP_VER_CANTIDADES_STOCK); si no, solo "Hay stock / Sin stock". */
  verCantidades: boolean
  /** La línea del carrito de este producto: la tarjeta dice cuántas unidades lleva, cuánto suma y el descuento. */
  linea?: LineaCarrito
  /** Lo que llevó la última vez (unidades), si la última venta lo tenía. */
  llevoAntes?: number
  /** Hay conexión al stock en vivo: la línea de stock agrega "· ahora". */
  enVivo?: boolean
  onElegirFragancias?: () => void
  /** Cambia la cantidad de la línea (en unidades) desde la tarjeta: selector "Se vende por" y "−" / "+". */
  onCambiarCantidad?: (unidades: number) => void
  /** Abre la pantalla de cantidad y oferta: "Agregar" y, si ya está en el carrito, el chip de edición. */
  onAbrirOferta: (producto: CatalogoStockItem) => void
}

/**
 * Tarjeta del catálogo de venta (propuesta Catálogo): foto, marca, nombre, presentación, oferta, stock en vivo,
 * precio (por bulto y por unidad) y "Agregar" o el chip de edición. Sin stock se puede pedir: queda por autorizar.
 */
export function ProductoCatalogoCard({
  producto: p, cantidad, verCantidades, linea, llevoAntes, enVivo, onElegirFragancias, onCambiarCantidad, onAbrirOferta,
}: ProductoCatalogoCardProps) {
  const c = useColors()
  const stock = stockDeTarjeta(p, verCantidades, enVivo)
  const colorStock = stock.nivel === 'hay' ? c.success : stock.nivel === 'poco' ? c.warning : c.danger
  const porBulto = vendePorBulto(p)
  const unitario = precioServidor(p)
  const pistas = [llevoAntes ? `Llevó ${llevoAntes} la última vez` : null].filter((t): t is string => !!t)
  const abrir = () => onAbrirOferta(p)
  const pr = presentacionDe(p)
  const enCarrito = !p.esPadreDeVariantes && !!linea && linea.cantidad > 0 && !!onCambiarCantidad
  const [modoElegido, setModoElegido] = useState<ModoCantidad | null>(null)
  const modo = modoElegido && pr.modos.includes(modoElegido) ? modoElegido : modoDeCantidad(pr, linea?.cantidad ?? 0)
  // Lo que suma el "+" en este modo, en unidades (paso está en las unidades del modo).
  const paso = unidadesDe(pr, modo, pr.paso[modo])

  return (
    <View
      testID={`producto-${p.id}`}
      style={{
        flex: 1, flexDirection: 'row', gap: space[3], padding: space[3], borderRadius: radii.tarjeta,
        backgroundColor: cantidad > 0 ? c.brandSoft : c.surface, borderWidth: 2, borderColor: cantidad > 0 ? c.brand : c.surface,
      }}
    >
      <View style={{ width: 76, height: 76, borderRadius: radii.campo, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {p.imageUrl ? (
          <Image source={{ uri: p.imageUrl }} style={{ width: 76, height: 76 }} accessibilityIgnoresInvertColors />
        ) : (
          <Package size={28} color={c.textSecondary} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: space[1] }}>
        {p.marca ? <Text style={{ ...typeScale.etiqueta, color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 }}>{p.marca}</Text> : null}
        <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{p.nombre}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], flexWrap: 'wrap' }}>
          <Chip c={c} texto={rotuloPresentacion(presentacionDe(p))} />
          {p.precioConOferta != null ? <Chip c={c} texto="Oferta" tono="oferta" /> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <View testID={`stock-punto-${p.id}`} style={{ width: 8, height: 8, borderRadius: radii.pastilla, backgroundColor: colorStock }} />
          <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{stock.texto}</Text>
        </View>
        {linea && linea.cantidad > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], flexWrap: 'wrap' }}>
            <Text testID={`linea-resumen-${p.id}`} style={{ ...typeScale.secundario, ...importe, color: c.text }}>
              {`${mostrarNumero(linea.cantidad)} ${linea.cantidad === 1 ? 'unidad' : 'unidades'} · ${formatImporte(subtotalLinea(linea))}`}
            </Text>
            {linea.descuentoPct > 0 ? <Chip c={c} texto={`Descuento ${mostrarNumero(linea.descuentoPct)} %`} tono="oferta" /> : null}
          </View>
        ) : null}
        {enCarrito && linea ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2], flexWrap: 'wrap' }}>
            <SeVendePor compacto presentacion={pr} modo={modo}
              onCambiar={(m) => { setModoElegido(m); onCambiarCantidad?.(convertirModo(pr, m, linea.cantidad)) }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <Redondo c={c} label="−" a11y={`Restar ${p.nombre}`} disabled={linea.cantidad - paso < multiploDe(p)} onPress={() => onCambiarCantidad?.(linea.cantidad - paso)} />
              <Text accessibilityLabel={`${modo === 'bultos' ? 'Bultos' : 'Unidades'}: ${valorEn(pr, modo, linea.cantidad)}`} style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.text, minWidth: 28, textAlign: 'center' }}>
                {mostrarNumero(valorEn(pr, modo, linea.cantidad))}
              </Text>
              <Redondo c={c} label="+" a11y={`Sumar ${p.nombre}`} disabled={linea.cantidad + paso > TOPE_CANTIDAD} onPress={() => onCambiarCantidad?.(linea.cantidad + paso)} />
            </View>
          </View>
        ) : null}
        {pistas.map((t) => <Text key={t} style={{ ...typeScale.secundario, color: c.textSecondary }}>{t}</Text>)}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2], marginTop: space[1] }}>
          <View>
            <Text style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.text }}>{formatImporte(unitario * unidadesPorBultoDe(p))}</Text>
            {porBulto ? <Text style={{ ...typeScale.etiqueta, color: c.textSecondary }}>{`${formatImporte(unitario)} por unidad`}</Text> : null}
          </View>
          {p.esPadreDeVariantes ? (
            <Accion c={c} label="Elegir fragancias" onPress={onElegirFragancias} />
          ) : cantidad > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Editar ${p.nombre}`}
              onPress={abrir}
              style={{ minHeight: 44, paddingHorizontal: space[4], borderRadius: radii.campo, backgroundColor: c.brandSoft, borderWidth: 1, borderColor: c.brand, justifyContent: 'center' }}
            >
              <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{`${cantidadEnPresentacion(p, cantidad)} ✎`}</Text>
            </Pressable>
          ) : (
            <Accion c={c} label={stock.nivel === 'sin' ? 'Sin stock' : 'Agregar'} a11y={`Añadir ${p.nombre}`} onPress={abrir} />
          )}
        </View>
      </View>
    </View>
  )
}

function Chip({ c, texto, tono }: { c: ForwardColors; texto: string; tono?: 'oferta' }) {
  const colores = tono === 'oferta' ? c.chip.porAutorizar : { bg: c.surface2, text: c.text }
  return (
    <View style={{ paddingHorizontal: space[2], paddingVertical: 2, borderRadius: radii.campo, backgroundColor: colores.bg }}>
      <Text style={{ ...typeScale.etiqueta, color: colores.text }}>{texto}</Text>
    </View>
  )
}

function Accion({ c, label, a11y, onPress }: { c: ForwardColors; label: string; a11y?: string; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      onPress={onPress}
      style={{ minHeight: 44, paddingHorizontal: space[4], borderRadius: radii.campo, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, justifyContent: 'center' }}
    >
      <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{label}</Text>
    </Pressable>
  )
}

export function Redondo({ c, label, a11y, onPress, disabled = false }: { c: ForwardColors; label: string; a11y: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ width: 44, height: 44, borderRadius: radii.pastilla, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ ...typeScale.titulo, color: disabled ? c.textSecondary : c.text }}>{label}</Text>
    </Pressable>
  )
}
