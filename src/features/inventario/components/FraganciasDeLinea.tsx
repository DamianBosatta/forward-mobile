import React from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { AlertTriangle } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { useVariantesProducto, type VarianteProducto } from '@/libs/api-client/productos'
import type { StockItem } from '@/libs/api-client/types'
import { TODOS_LOS_DEPOSITOS } from '../hooks/useStockPorDeposito'
import { textoStockAroma, varianteComoFila } from '../lib/stock-presentacion'

interface Props {
  /** La tarjeta de la línea: su producto es el padre de las fragancias y su depósito, el de cada fragancia. */
  linea: StockItem
  onAbrirDetalle: (item: StockItem) => void
}

/**
 * Panel de fragancias de una línea desplegada (web LineaAromaCards), a todo el ancho debajo de su tarjeta. Usa el
 * endpoint de la web (GET /Productos/{id}/variantes) con el depósito de la tarjeta, así que lo disponible de las
 * activas suma lo de la línea. Una fragancia inactiva va atenuada y lo dice. Tocar una abre el mismo detalle que
 * cualquier artículo. Sin el menú de acciones de cada aroma.
 */
export function FraganciasDeLinea({ linea, onAbrirDetalle }: Props) {
  const c = useColors()
  const depositoId = linea.depositoId && linea.depositoId !== TODOS_LOS_DEPOSITOS ? linea.depositoId : undefined
  const { data: variantes = [], isLoading, isError } = useVariantesProducto(linea.productoId, true, depositoId)

  const aviso = (texto: string, icono?: boolean) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], padding: space[3] }}>
      {icono ? <AlertTriangle size={16} color={c.chip.anulado.text} /> : null}
      <Text style={[typeScale.secundario, { color: icono ? c.chip.anulado.text : c.textSecondary }]}>{texto}</Text>
    </View>
  )

  return (
    <View accessibilityLabel={`Fragancias de ${linea.producto}`} style={{ borderRadius: radii.tarjeta, backgroundColor: c.surface, overflow: 'hidden' }}>
      <Text style={[typeScale.cuerpoDestacado, { color: c.text, paddingHorizontal: space[3], paddingVertical: space[3] }]}>{linea.producto}</Text>
      {isLoading ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], padding: space[3] }}>
          <ActivityIndicator size="small" color={c.brandInk} />
          <Text style={[typeScale.secundario, { color: c.textSecondary }]}>Cargando aromas...</Text>
        </View>
      ) : isError ? (
        aviso('No se pudieron cargar los aromas de esta línea.', true)
      ) : variantes.length === 0 ? (
        aviso('Esta línea todavía no tiene aromas generados.')
      ) : (
        variantes.map((v) => <Fragancia key={v.id} v={v} onPress={() => onAbrirDetalle(varianteComoFila(v, linea))} />)
      )}
    </View>
  )
}

function Fragancia({ v, onPress }: { v: VarianteProducto; onPress: () => void }) {
  const c = useColors()
  const texto = textoStockAroma(v)
  const inactiva = v.activo === false
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${v.fraganciaNombre ?? v.nombre}, ${texto}`}
      onPress={onPress}
      android_ripple={{ color: c.border }}
      style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[3], paddingVertical: space[2], borderTopWidth: 1, borderTopColor: c.border, opacity: inactiva ? 0.6 : 1 }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={2} style={[typeScale.cuerpoDestacado, { color: inactiva ? c.textSecondary : c.text }]}>{v.fraganciaNombre ?? v.nombre}</Text>
        {inactiva ? <Text style={[typeScale.secundario, { color: c.textSecondary }]}>inactivo (no cuenta en la línea)</Text> : null}
      </View>
      <Text style={[typeScale.secundario, { color: c.textSecondary }]}>{texto}</Text>
    </Pressable>
  )
}
