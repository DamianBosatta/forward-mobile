import React from 'react'
import { Text, View } from 'react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { COLUMNAS, subtotalDeColumna, type ColumnaId, type VentaTablero } from './tablero'
import { TarjetaPedidoTablero, type OpcionesTarjeta } from './TarjetaPedidoTablero'
import { DatosDeEntregaFallida } from '@/features/logistica/porPreparar/DatosDeEntregaFallida'


/** Lo que muestra cada columna en su tarjeta, como las cuatro columnas de la web (sin sus botones). */
const OPCIONES: Record<ColumnaId, OpcionesTarjeta> = {
  aPreparar: {},
  enPreparacion: { mostrarItems: true, mostrarUltimoCambio: true },
  empacados: { mostrarHoja: true, mostrarPiezas: true, mostrarUltimoCambio: true, hecho: true },
  noEntregado: { etiquetaFecha: 'Entrega fallida', marcarAtraso: false, mostrarUltimoCambio: true },
}

/**
 * Encabezado de columna (ColumnaHeader de la web) y única tarjeta protagonista de la pantalla: lima en las columnas
 * de trabajo, teal en Empacados ("hecho") y relleno de estado en No entregado; texto e ícono siempre `ink`.
 */
export function CabeceraColumna({ id, items }: { id: ColumnaId; items: readonly VentaTablero[] }) {
  const c = useColors()
  const col = COLUMNAS.find((x) => x.id === id)!
  const Icono = col.icono
  const n = items.length
  const fondo = id === 'empacados' ? c.teal : id === 'noEntregado' ? c.dangerFill : c.lime
  return (
    <View
      testID={`cabecera-${id}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], backgroundColor: fondo, borderRadius: radii.tarjetaGrande, padding: space[5] }}
    >
      <View style={{ flex: 1, gap: space[1] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Icono size={24} color={c.ink} strokeWidth={2.5} />
          <Text accessibilityRole="header" style={{ ...typeScale.tituloTarjeta, color: c.ink, flexShrink: 1 }}>{col.titulo}</Text>
        </View>
        <Text style={{ ...typeScale.secundario, ...importe, color: c.ink, opacity: 0.78 }}>{subtotalDeColumna(id, items)}</Text>
      </View>
      <View accessible accessibilityLabel={`${n} ${n === 1 ? 'pedido' : 'pedidos'}`}>
        <Text maxFontSizeMultiplier={1.3} style={{ ...typeScale.numeroProtagonista, ...importe, color: c.ink }}>{n}</Text>
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
        <View style={{ backgroundColor: c.surface, borderRadius: radii.tarjetaGrande, padding: space[5] }}>
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
