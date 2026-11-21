import { iniciales } from '@/core/utils/texto'
import React from 'react'
import { Text, View } from 'react-native'
import { importe as cifras, maxFontScale, radii, space, typeScale, useColors } from '@/libs/theme'
import { PressableFx } from './PressableFx'
import { StatusChip } from './StatusChip'
import { formatImporte } from './formatImporte'
import type { ChipInfo } from './estadoChip'
import { pesoSemibold } from './tipografia'

interface DocumentCardProps {
  numero: string
  vendedor: string
  /** Nombre del que salen las iniciales del avatar; por defecto, el vendedor (en compras, el proveedor). */
  avatar?: string
  /** Dirección de entrega: identifica al cliente y va como título. */
  direccion: string
  /** Nombre del cliente: línea aparte, nunca sufijo de la dirección. */
  nombre?: string | null
  hora: string
  /** Texto después de la hora, p. ej. "Entrega jue 8". */
  detalle?: string | null
  importe: number | null | undefined
  chip: ChipInfo | null
  onPress: () => void
  /**
   * Formato de las láminas de compras: sin avatar; título, una línea secundaria (el nombre, o el
   * encabezado si no hay) y el pie con el chip, la hora y el importe.
   */
  plano?: boolean
  /** Solo `plano`: "Pedido 12/11/2026 10:30". Va en su propia línea, con el día y la hora argentinos. */
  fechaHora?: string | null
  /** Solo `plano`: "Último cambio 12/11/2026 15:42". Sin dato (el servidor no lo manda), no se muestra la línea. */
  ultimoCambio?: string | null
}

/** Iniciales (dos letras) para el avatar: la misma regla que las del cliente (`core/utils/texto`). */
export { iniciales }

/** Tarjeta de documento FWD (lista de ventas y compras): radio de fila, `surface` sin borde ni sombra. En compras el título es el proveedor. */
export function DocumentCard(p: DocumentCardProps) {
  const c = useColors()
  const encabezado = `${p.numero} · ${p.vendedor}`
  const pie = p.detalle ? `${p.hora} · ${p.detalle}` : p.hora
  const total = formatImporte(p.importe)
  const etiqueta = [encabezado, p.direccion, p.nombre, p.chip?.label, pie, total].filter(Boolean).join(', ')
  const secundario = [typeScale.secundario, { color: c.textSecondary }]

  if (p.plano) {
    const fechas = [p.fechaHora ? `Pedido ${p.fechaHora}` : null, p.ultimoCambio ? `Último cambio ${p.ultimoCambio}` : null].filter(Boolean) as string[]
    const etiquetaPlana = [p.direccion, p.nombre || encabezado, p.chip?.label, p.detalle || p.hora, ...fechas, total].filter(Boolean).join(', ')
    return (
      <PressableFx
        accessibilityRole="button"
        accessibilityLabel={etiquetaPlana}
        onPress={p.onPress}
        android_ripple={{ color: c.surfaceAlt }}
        style={{ minHeight: 68, padding: space[4], gap: space[1], borderRadius: radii.fila, backgroundColor: c.surface }}
      >
        {/* Título y importe en la misma fila: el importe no se parte ni se corre (cifras tabulares, a la derecha, ancho propio). */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
          <Text numberOfLines={2} style={[typeScale.cuerpoDestacado, { color: c.text, flex: 1, minWidth: 0 }]}>{p.direccion}</Text>
          <Text numberOfLines={1} testID="documento-importe" style={[typeScale.titulo, cifras, { color: c.text, flexShrink: 0, textAlign: 'right' }]}>{total}</Text>
        </View>
        <Text numberOfLines={2} style={secundario}>{p.nombre || encabezado}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space[2], paddingTop: space[1] }}>
          {p.chip && <StatusChip estado={p.chip.estado} label={p.chip.label} />}
          <Text numberOfLines={1} style={[secundario, { flexShrink: 1 }]}>{p.detalle || p.hora}</Text>
        </View>
        {fechas.map((f) => <Text key={f} numberOfLines={1} style={[secundario, cifras]}>{f}</Text>)}
      </PressableFx>
    )
  }

  return (
    <PressableFx
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={p.onPress}
      android_ripple={{ color: c.surfaceAlt }}
      style={{
          flexDirection: 'row',
          gap: space[3],
          minHeight: 68,
          padding: space[4],
          borderRadius: radii.fila,
          backgroundColor: c.surface,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: radii.pastilla,
          backgroundColor: c.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text maxFontSizeMultiplier={maxFontScale} style={[typeScale.secundario, { ...pesoSemibold, color: c.accentText }]}>
          {iniciales(p.avatar ?? p.vendedor)}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: space[1] }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2] }}>
          <Text numberOfLines={1} style={[secundario, { flexShrink: 1 }]}>{encabezado}</Text>
          {p.chip && <StatusChip estado={p.chip.estado} label={p.chip.label} />}
        </View>
        <Text numberOfLines={1} style={[typeScale.cuerpoDestacado, { color: c.text }]}>{p.direccion}</Text>
        {p.nombre ? (
          <Text numberOfLines={1} style={[typeScale.secundario, { color: c.text }]}>{p.nombre}</Text>
        ) : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space[2] }}>
          <Text numberOfLines={1} style={[secundario, { flexShrink: 1 }]}>{pie}</Text>
          <Text style={[typeScale.titulo, cifras, { color: c.text, textAlign: 'right' }]}>{total}</Text>
        </View>
      </View>
    </PressableFx>
  )
}
