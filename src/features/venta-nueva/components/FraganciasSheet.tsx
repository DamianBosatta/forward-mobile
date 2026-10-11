import React, { useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { importe, space, typeScale, useColors } from '@/libs/theme'
import { BottomSheet, Button, StatusChip, formatImporte } from '@/core/ui/fw'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { useVariantesProducto } from '@/libs/api-client/productos'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { canViewStock } from '@/features/ventas/lib/descuentos'
import { useCatalogoVenta } from '../hooks/useCatalogoVenta'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import { leyendaMultiplo, multiploDe, precioServidor } from '../lib/carrito'
import { nombreFragancia } from '../lib/fragancias'
import { Redondo } from './ProductoCatalogoCard'

interface Props {
  /** Línea padre a repartir; null = cerrada. */
  padreId: string | null
  onClose: () => void
}

/**
 * "Elegir fragancias" (plan 9 §2.1, PR 2.4): reparte una línea padre en sus variantes, de a la
 * venta mínima de cada una. Las variantes salen del catálogo de venta (traen precio, piso y venta
 * mínima); la disponibilidad, de GET /Productos/{id}/variantes en el depósito de la venta.
 */
export function FraganciasSheet({ padreId, onClose }: Props) {
  if (!padreId) return null
  return <Contenido key={padreId} padreId={padreId} onClose={onClose} />
}

function Contenido({ padreId, onClose }: { padreId: string; onClose: () => void }) {
  const c = useColors()
  const { productos, isLoading } = useCatalogoVenta('')
  const { lineas, repartirFragancias } = useCarritoVenta()
  const verCantidades = canViewStock((useAuthStore((s) => s.user?.roles) ?? []) as string[])
  const servidor = useVariantesProducto(padreId, true, DEPOSITO_CENTRAL_ID)
  const padre = productos.find((p) => p.id === padreId)
  const variantes = useMemo(() => productos.filter((p) => p.productoPadreId === padreId), [productos, padreId])
  const [cantidades, setCantidades] = useState<Record<string, number>>(() =>
    Object.fromEntries(lineas.filter((l) => l.producto.productoPadreId === padreId).map((l) => [l.productoId, l.cantidad])))
  const total = Object.values(cantidades).reduce((a, n) => a + n, 0)
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
          const hay = delServidor?.puedeVenderse ?? v.puedeVenderse
          const stock = delServidor?.stockDisponible ?? v.real
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
                <StatusChip estado={hay ? 'entregado' : 'anulado'} label={verCantidades ? `Stock: ${stock}` : hay ? 'Hay stock' : 'Sin stock'} />
              </View>
              <Redondo c={c} label="−" a11y={`Restar ${nombre}`} onPress={() => cambiar(v.id, n - m)} />
              <Text accessibilityLabel={`${nombre}: ${n}`} style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.text, minWidth: 32, textAlign: 'center' }}>{n}</Text>
              <Redondo c={c} label="+" a11y={`Sumar ${nombre}`} onPress={() => cambiar(v.id, n + m)} />
            </View>
          )
        })}
      </ScrollView>
      <Button
        label={total > 0 ? `Listo · ${total} unidades` : 'Listo'}
        disabled={variantes.length === 0}
        onPress={() => { repartirFragancias(padreId, variantes, cantidades); onClose() }}
      />
    </BottomSheet>
  )
}
