import React, { useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { importe, space, typeScale, useColors } from '@/libs/theme'
import { BottomSheet, Button, Field, Notice, StatusChip, formatImporte } from '@/core/ui/fw'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { useVariantesProducto } from '@/libs/api-client/productos'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { hasCapability } from '@/features/auth/lib/capabilities'
import { useCatalogoVenta } from '../hooks/useCatalogoVenta'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import { leyendaMultiplo, multiploDe, precioServidor, subtotalLinea } from '../lib/carrito'
import { descuentoDeFragancias, nombreFragancia, stockDeFragancia } from '../lib/fragancias'
import { MENSAJE_TOPE_SIN_CONFIGURAR, avisoTope, leerNumero, mostrarNumero } from '../lib/linea'
import { limitarDigitos } from '../lib/teclado'

interface Props {
  /** Línea padre a repartir; null = cerrada. */
  padreId: string | null
  onClose: () => void
  /** Lo que el cliente llevó en su último pedido (producto → cantidad): habilita "Como la última vez". */
  llevo?: Map<string, number> | null
}

/**
 * "Elegir fragancias" (plan 9 §2.1, PR 2.4): reparte una línea padre en sus variantes, de a la
 * venta mínima de cada una. Las variantes salen del catálogo de venta (traen precio, piso y venta
 * mínima); la disponibilidad, de GET /Productos/{id}/variantes en el depósito de la venta. Como en
 * la web (DistribucionFraganciasModal): no se pide más que el stock disponible de cada fragancia y
 * el descuento es UNO para toda la línea.
 */
export function FraganciasSheet({ padreId, onClose, llevo = null }: Props) {
  if (!padreId) return null
  return <Contenido key={padreId} padreId={padreId} onClose={onClose} llevo={llevo} />
}

function Contenido({ padreId, onClose, llevo }: { padreId: string; onClose: () => void; llevo: Map<string, number> | null }) {
  const c = useColors()
  const { productos, isLoading } = useCatalogoVenta('')
  const { lineas, repartirFragancias } = useCarritoVenta()
  const user = useAuthStore((s) => s.user)
  const verCantidades = hasCapability(user?.permissions, 'CAP_VER_CANTIDADES_STOCK')
  const servidor = useVariantesProducto(padreId, true, DEPOSITO_CENTRAL_ID)
  const padre = productos.find((p) => p.id === padreId)
  const variantes = useMemo(() => productos.filter((p) => p.productoPadreId === padreId), [productos, padreId])
  // Lo que el vendedor tipea en cada fragancia (vacío = 0). La cantidad sale de acá; nunca se baja sola.
  const [textos, setTextos] = useState<Record<string, string>>(() =>
    Object.fromEntries(lineas.filter((l) => l.producto.productoPadreId === padreId).map((l) => [l.productoId, mostrarNumero(l.cantidad)])))
  const cantidades = useMemo(() => Object.fromEntries(Object.entries(textos).map(([id, t]) => [id, t === '' ? 0 : Number(t)])) as Record<string, number>, [textos])
  const disponibleDe = (v: (typeof variantes)[number]) => stockDeFragancia(v, servidor.data?.find((s) => s.id === v.id), verCantidades)
  // S9: el multiplo gana; si no, lo que supera el stock avisa. Nunca se baja lo que escribio el vendedor: se avisa y no deja confirmar.
  const errorDeCantidad = (v: (typeof variantes)[number]) => {
    const m = multiploDe(v)
    const n = cantidades[v.id] ?? 0
    if (m > 1 && n % m !== 0) return `Se vende de a ${m}`
    const disponible = disponibleDe(v)
    if (n > disponible) return verCantidades ? `Solo hay ${disponible}` : 'No hay tanto stock'
    return undefined
  }
  const hayErrorDeCantidad = variantes.some((v) => errorDeCantidad(v) !== undefined)
  const [pctTexto, setPctTexto] = useState(() => mostrarNumero(descuentoDeFragancias(lineas, padreId)))
  const pctLeido = leerNumero(pctTexto)
  const pctInvalido = pctLeido === null || pctLeido < 0 || pctLeido > 100
  const tope = avisoTope(pctInvalido ? 0 : pctLeido, user?.maxDescuentoPorcentaje ?? 0, hasCapability(user?.permissions, 'CAP_EXENTO_TOPE_DESCUENTO'))
  const total = Object.values(cantidades).reduce((a, n) => a + n, 0)
  const escribir = (id: string, texto: string) => setTextos((s) => ({ ...s, [id]: limitarDigitos(texto.replace(/\D/g, '')) }))
  // "Como la última vez": lo que llevó de cada fragancia, acotado al stock (en múltiplos) al llenar los campos: el
  // vendedor ve el valor acotado en el campo antes de confirmar, no cambia al confirmar.
  const delUltimo = Object.fromEntries(variantes.flatMap((v) => {
    const llevado = llevo?.get(v.id)
    if (!llevado) return []
    const m = multiploDe(v)
    const n = Math.min(llevado, Math.floor(disponibleDe(v) / m) * m)
    return n > 0 ? [[v.id, n]] : []
  }))
  const hayUltimo = Object.keys(delUltimo).length > 0
  const subtotal = variantes.reduce((a, v) => a + subtotalLinea({ productoId: v.id, producto: v, cantidad: cantidades[v.id] ?? 0, descuentoPct: pctInvalido ? 0 : pctLeido }), 0)

  return (
    <BottomSheet visible onClose={onClose} accessibilityLabel="Elegir fragancias">
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space[2] }}>
        <View style={{ flex: 1, gap: space[1] }}>
          <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>{padre?.nombre ?? 'Fragancias'}</Text>
          <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
            {padre ? `${formatImporte(precioServidor(padre))} c/u · ${variantes.length} fragancias` : 'Elegí cuántas de cada fragancia.'}
          </Text>
        </View>
        {hayUltimo ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Como la última vez" onPress={() => setTextos(Object.fromEntries(Object.entries(delUltimo).map(([id, n]) => [id, mostrarNumero(n)])))} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ ...typeScale.cuerpoDestacado, color: c.brandInk }}>Como la última vez</Text>
          </Pressable>
        ) : null}
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
          const leyenda = leyendaMultiplo(v)
          return (
            <View key={v.id} testID={`fragancia-${v.id}`} style={{ gap: space[1] }}>
              <Text style={{ ...typeScale.secundario, ...importe, color: c.textSecondary }}>
                {leyenda ? `${formatImporte(precioServidor(v))} · ${leyenda}` : formatImporte(precioServidor(v))}
              </Text>
              <View style={{ alignItems: 'flex-start' }}>
                <StatusChip estado={hay ? 'entregado' : 'anulado'} label={!hay ? 'Sin stock' : verCantidades ? `Stock: ${disponible}` : 'Hay stock'} />
              </View>
              <Field label={nombre} keyboardType="number-pad" alignRight selectTextOnFocus placeholder="0"
                value={textos[v.id] ?? ''} onChangeText={(t) => escribir(v.id, t)} error={errorDeCantidad(v)} />
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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`${total} ${total === 1 ? 'unidad' : 'unidades'}`}</Text>
        <Text testID="fragancias-subtotal" style={{ ...typeScale.titulo, ...importe, color: c.text }}>{formatImporte(subtotal)}</Text>
      </View>
      <Button
        label={total > 0 ? 'Agregar a la venta' : 'Listo'}
        disabled={variantes.length === 0 || pctInvalido || hayErrorDeCantidad}
        onPress={() => { repartirFragancias(padreId, variantes, Object.fromEntries(variantes.map((v) => [v.id, cantidades[v.id] ?? 0])), pctLeido ?? 0); onClose() }}
      />
    </BottomSheet>
  )
}
