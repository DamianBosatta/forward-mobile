import React from 'react'
import { Text, View } from 'react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { COLUMNAS, subtotalDeColumna, type ColumnaId, type VentaTablero } from './tablero'
import { TarjetaPedidoTablero, type OpcionesTarjeta } from './TarjetaPedidoTablero'
import { DatosDeEntregaFallida } from '@/features/logistica/porPreparar/DatosDeEntregaFallida'
import { pesoSemibold } from '@/core/ui/fw'


/** Lo que muestra cada columna en su tarjeta, como las cuatro columnas de la web (sin sus botones). */
const OPCIONES: Record<ColumnaId, OpcionesTarjeta> = {
  aPreparar: {},
  enPreparacion: { mostrarItems: true, mostrarUltimoCambio: true },
  empacados: { mostrarHoja: true, mostrarPiezas: true, mostrarUltimoCambio: true },
  noEntregado: { etiquetaFecha: 'Entrega fallida', marcarAtraso: false, mostrarUltimoCambio: true },
}

/** Encabezado de columna (ColumnaHeader de la web): franja y color del estado, ícono, título, subtotal y cantidad. */
export function CabeceraColumna({ id, items }: { id: ColumnaId; items: readonly VentaTablero[] }) {
  const c = useColors()
  const col = COLUMNAS.find((x) => x.id === id)!
  const tono = c.chip[col.tono]
  const Icono = col.icono
  const n = items.length
  return (
    <View
      testID={`cabecera-${id}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], backgroundColor: c.surface, borderRadius: radii.tarjeta, borderTopWidth: 4, borderTopColor: tono.text, padding: space[3] }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Icono size={20} color={tono.text} />
          <Text accessibilityRole="header" style={{ ...typeScale.cuerpoDestacado, color: c.text, flexShrink: 1 }}>{col.titulo}</Text>
        </View>
        <Text style={{ ...typeScale.secundario, ...importe, color: c.textSecondary }}>{subtotalDeColumna(id, items)}</Text>
      </View>
      <View
        accessible
        accessibilityLabel={`${n} ${n === 1 ? 'pedido' : 'pedidos'}`}
        style={{ minWidth: 36, height: 36, borderRadius: radii.pastilla, paddingHorizontal: space[2], alignItems: 'center', justifyContent: 'center', backgroundColor: tono.bg }}
      >
        <Text maxFontSizeMultiplier={1.3} style={{ ...typeScale.cuerpoDestacado, ...pesoSemibold, ...importe, color: tono.text }}>{n}</Text>
      </View>
    </View>
  )
}

/** Una columna del tablero: su encabezado, sus tarjetas y, vacía, el texto de la web. */
export function ColumnaTablero({ id, items, hoy, onAbrir }: { id: ColumnaId; items: readonly VentaTablero[]; hoy: string; onAbrir: (v: VentaTablero) => void }) {
  const c = useColors()
  const col = COLUMNAS.find((x) => x.id === id)!
  return (
    <View style={{ gap: space[3] }}>
      <CabeceraColumna id={id} items={items} />
      {items.length === 0 ? (
        <View style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[4] }}>
          <Text style={{ ...typeScale.secundario, color: c.textSecondary, textAlign: 'center' }}>{col.vacia}</Text>
        </View>
      ) : (
        items.map((v) => (
          <TarjetaPedidoTablero key={v.id} venta={v} hoy={hoy} opciones={OPCIONES[id]} onAbrir={() => onAbrir(v)}>
            {id === 'noEntregado' ? <DatosDeEntregaFallida pedido={v} /> : null}
          </TarjetaPedidoTablero>
        ))
      )}
    </View>
  )
}
