import React, { useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { importe, space, typeScale, useColors } from '@/libs/theme'
import { BottomSheet, Button, Field, Notice, StatusChip, formatImporte } from '@/core/ui/fw'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { useVariantesProducto } from '@/libs/api-client/productos'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { hasCapability } from '@/features/auth/lib/capabilities'
import { canViewStock } from '@/features/ventas/lib/descuentos'
import { useCatalogoVenta } from '../hooks/useCatalogoVenta'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import { leyendaMultiplo, multiploDe, precioServidor } from '../lib/carrito'
import { descuentoDeFragancias, nombreFragancia, stockDeFragancia } from '../lib/fragancias'
import { MENSAJE_TOPE_SIN_CONFIGURAR, avisoTope, leerNumero, mostrarNumero } from '../lib/linea'
import { Redondo } from './ProductoCatalogoCard'

interface Props {
  /** Línea padre a repartir; null = cerrada. */
  padreId: string | null
  onClose: () => void
}

/**
 * "Elegir fragancias" (plan 9 §2.1, PR 2.4): reparte una línea padre en sus variantes, de a la
 * venta mínima de cada una. Las variantes salen del catálogo de venta (traen precio, piso y venta
 * mínima); la disponibilidad, de GET /Productos/{id}/variantes en el depósito de la venta. Como en
 * la web (DistribucionFraganciasModal): no se pide más que el stock disponible de cada fragancia y
 * el descuento es UNO para toda la línea.
 */
export function FraganciasSheet({ padreId, onClose }: Props) {
  if (!padreId) return null
  return <Contenido key={padreId} padreId={padreId} onClose={onClose} />
}

function Contenido({ padreId, onClose }: { padreId: string; onClose: () => void }) {
  const c = useColors()
  const { productos, isLoading } = useCatalogoVenta('')
  const { lineas, repartirFragancias } = useCarritoVenta()
  const user = useAuthStore((s) => s.user)
  const verCantidades = canViewStock((user?.roles ?? []) as string[])
  const servidor = useVariantesProducto(padreId, true, DEPOSITO_CENTRAL_ID)
  const padre = productos.find((p) => p.id === padreId)
  const variantes = useMemo(() => productos.filter((p) => p.productoPadreId === padreId), [productos, padreId])
  const [cantidades, setCantidades] = useState<Record<string, number>>(() =>
    Object.fromEntries(lineas.filter((l) => l.producto.productoPadreId === padreId).map((l) => [l.productoId, l.cantidad])))
  const [pctTexto, setPctTexto] = useState(() => mostrarNumero(descuentoDeFragancias(lineas, padreId)))
  const pctLeido = leerNumero(pctTexto)
  const pctInvalido = pctLeido === null || pctLeido < 0 || pctLeido > 100
  const tope = avisoTope(pctInvalido ? 0 : pctLeido, user?.maxDescuentoPorcentaje ?? 0, hasCapability(user?.permissions, 'CAP_EXENTO_TOPE_DESCUENTO'))
  const total = Object.values(cantidades).reduce((a, n) => a + n, 0)
  // Al confirmar se vuelve a acotar cada cantidad al stock disponible, en múltiplos de la venta mínima (como la web).
  const aDisponible = () => Object.fromEntries(variantes.map((v) => {
    const disponible = stockDeFragancia(v, servidor.data?.find((s) => s.id === v.id), verCantidades)
    const m = multiploDe(v)
    return [v.id, Math.min(cantidades[v.id] ?? 0, Math.floor(disponible / m) * m)]
  }))
  const cambiar = (id: string, n: number) => setCantidades((s) => ({ ...s, [id]: Math.max(0, n) }))

  return (
    <BottomSheet visible onClose={onClose} accessibilityLabel="Elegir fragancias">
      <View style={{ gap: space[1] }}>
        <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>{padre?.nombre ?? 'Fragancias'}</Text>
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Elegí cuántas de cada fragancia.</Text>
      </View>
      {isLoading ? <ActivityIndicator color={c.brand} /> : null}
      {!isLoading && variantes.length === 0 ? (
        <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>Esta línea no tiene fragancias a la venta.</Text>
      ) : null}
      <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: space[3] }}>
        {variantes.map((v) => {
          const delServidor = servidor.data?.find((s) => s.id === v.id)
          const disponible = stockDeFragancia(v, delServidor, verCantidades)
          const hay = disponible > 0
          const nombre = delServidor?.fraganciaNombre ?? nombreFragancia(v, padre?.nombre)
          const n = cantidades[v.id] ?? 0
          const m = multiploDe(v)
          const leyenda = leyendaMultiplo(v)
          return (
            <View key={v.id} testID={`fragancia-${v.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <View style={{ flex: 1, gap: space[1] }}>
                <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{nombre}</Text>
                <Text style={{ ...typeScale.secundario, ...importe, color: c.textSecondary }}>
                  {leyenda ? `${formatImporte(precioServidor(v))} · ${leyenda}` : formatImporte(precioServidor(v))}
                </Text>
                <StatusChip estado={hay ? 'entregado' : 'anulado'} label={!hay ? 'Sin stock' : verCantidades ? `Stock: ${disponible}` : 'Hay stock'} />
              </View>
              <Redondo c={c} label="−" a11y={`Restar ${nombre}`} onPress={() => cambiar(v.id, n - m)} />
              <Text accessibilityLabel={`${nombre}: ${n}`} style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.text, minWidth: 32, textAlign: 'center' }}>{n}</Text>
              <Redondo c={c} label="+" a11y={`Sumar ${nombre}`} disabled={n + m > disponible} onPress={() => cambiar(v.id, n + m)} />
            </View>
          )
        })}
      </ScrollView>
      <Field label="Descuento (%)" keyboardType="decimal-pad" alignRight value={pctTexto} onChangeText={setPctTexto}
        error={pctInvalido ? 'Ingresá un descuento entre 0 y 100.' : undefined} />
      <Text style={{ ...typeScale.secundario, color: c.textSecondary, marginTop: -space[2] }}>Se aplica a todas las fragancias de la línea.</Text>
      {tope === 'porAutorizar' ? (
        <Notice tone="advertencia" title={`Tu tope de descuento es ${user?.maxDescuentoPorcentaje} %.`}>Podés guardar el pedido, pero va a quedar por autorizar.</Notice>
      ) : null}
      {tope === 'sinConfigurar' ? <Notice tone="peligro">{MENSAJE_TOPE_SIN_CONFIGURAR}</Notice> : null}
      <Button
        label={total > 0 ? `Listo · ${total} unidades` : 'Listo'}
        disabled={variantes.length === 0 || pctInvalido}
        onPress={() => { repartirFragancias(padreId, variantes, aDisponible(), pctLeido ?? 0); onClose() }}
      />
    </BottomSheet>
  )
}
