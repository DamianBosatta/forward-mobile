import React from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import { Package } from 'lucide-react-native'
import { radii, space, typeScale, importe, useColors, type ForwardColors } from '@/libs/theme'
import { formatImporte } from '@/core/ui/fw'
import type { CatalogoStockItem } from '@/libs/api-client'
import { cantidadEnPresentacion, multiploDe, precioServidor, stockDeTarjeta, vendePorBulto } from '../lib/carrito'
import { presentacionDe, rotuloPresentacion } from '../lib/presentacion'

interface ProductoCatalogoCardProps {
  producto: CatalogoStockItem
  /** Cantidad en el carrito, en unidades (0 = no está). */
  cantidad: number
  /** Ve cantidades de stock (capacidad CAP_VER_CANTIDADES_STOCK); si no, solo "Hay stock / Sin stock". */
  verCantidades: boolean
  /** Lo que llevó la última vez (unidades), si la última venta lo tenía. */
  llevoAntes?: number
  /** Hay conexión al stock en vivo: la línea de stock agrega "· ahora". */
  enVivo?: boolean
  onElegirFragancias?: () => void
  /** Abre la pantalla de cantidad y oferta: "Agregar" y, si ya está en el carrito, el chip de edición. */
  onAbrirOferta: (producto: CatalogoStockItem) => void
}

/**
 * Tarjeta del catálogo de venta (propuesta Catálogo): foto, marca, nombre, presentación, oferta, stock en vivo,
 * precio (por bulto y por unidad) y "Agregar" o el chip de edición. Sin stock se puede pedir: queda por autorizar.
 */
export function ProductoCatalogoCard({
  producto: p, cantidad, verCantidades, llevoAntes, enVivo, onElegirFragancias, onAbrirOferta,
}: ProductoCatalogoCardProps) {
  const c = useColors()
  const stock = stockDeTarjeta(p, verCantidades, enVivo)
  const colorStock = stock.nivel === 'hay' ? c.success : stock.nivel === 'poco' ? c.warning : c.danger
  const porBulto = vendePorBulto(p)
  const unitario = precioServidor(p)
  const pistas = [llevoAntes ? `Llevó ${llevoAntes} la última vez` : null].filter((t): t is string => !!t)
  const abrir = () => onAbrirOferta(p)

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
        {pistas.map((t) => <Text key={t} style={{ ...typeScale.secundario, color: c.textSecondary }}>{t}</Text>)}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2], marginTop: space[1] }}>
          <View>
            <Text style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.text }}>{formatImporte(unitario * multiploDe(p))}</Text>
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
