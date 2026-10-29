import React, { useMemo } from 'react'
import { Pressable, Switch, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/core/api/client'
import { ventasKeys } from '@/libs/api-client/ventas'
import type { components } from '@/libs/api-client/generated/schema'
import { space, typeScale, useColors } from '@/libs/theme'
import { Notice } from '@/core/ui/fw'
import type { LineaCarrito } from '../lib/carrito'

/** Por qué no se puede guardar un presupuesto con un descuento sobre el tope (lámina CalleConfirmar). */
export const MOTIVO_PRESUPUESTO_SOBRE_TOPE = 'Un presupuesto no puede pasar tu tope de descuento'

/** Misma regla que la web (con-factura.ts, cuentaDeLaVenta): con factura la deuda va a la cuenta Normal, sin factura a la TST. */
const cuentaDeLaVenta = (conFactura: boolean) => (conFactura ? 'Normal' : 'TST')

type FaltanteStockFiscal = components['schemas']['FaltanteStockFiscalDto']

/** Los renglones que se consultan (itemsParaVerificar de la web): sin producto o sin cantidad no hay nada que verificar. */
const itemsParaVerificar = (lineas: LineaCarrito[]) =>
  lineas.filter((l) => Boolean(l.productoId) && l.cantidad > 0).map((l) => ({ productoId: l.productoId, cantidad: l.cantidad }))

/** describirFaltanteFiscal de la web (con-factura.ts): sin los números (quien no ve el stock) va solo el nombre. */
const describirFaltanteFiscal = (f: FaltanteStockFiscal) =>
  f.cantidad == null || f.stockFiscal == null
    ? `${f.nombre}: no alcanza el stock fiscal`
    : `${f.nombre}: pide ${f.cantidad}, hay ${f.stockFiscal} en stock fiscal`

/**
 * Interruptor "Con factura" (CalleConfirmar) con el aviso de stock fiscal de la web (ConFacturaField, regla F5): solo con el
 * tilde puesto consulta POST /Ventas/stock-fiscal/verificar y avisa; nunca bloquea (K12). Sin valor (el default no llegó)
 * queda apagado y deshabilitado.
 */
export function ConFactura({ conFactura, onChange, lineas }: { conFactura: boolean | undefined; onChange: (v: boolean) => void; lineas: LineaCarrito[] }) {
  const c = useColors()
  const valor = conFactura ?? false
  const items = useMemo(() => itemsParaVerificar(lineas), [lineas])
  const verificacion = useQuery({
    queryKey: [...ventasKeys.all, 'stock-fiscal', items] as const,
    queryFn: () => api.post<FaltanteStockFiscal[]>('/api/v1/Ventas/stock-fiscal/verificar', { items }),
    enabled: conFactura === true && items.length > 0,
    staleTime: 15_000,
  })
  const faltantes = conFactura === true && Array.isArray(verificacion.data) ? verificacion.data : []
  return (
    <View style={{ gap: space[2] }}>
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel="Con factura"
      accessibilityState={{ checked: valor, disabled: conFactura === undefined }}
      disabled={conFactura === undefined}
      onPress={() => onChange(!valor)}
      style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space[3], borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.border }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>Con factura</Text>
        {conFactura !== undefined ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`La deuda va a la cuenta ${cuentaDeLaVenta(conFactura)} del cliente.`}</Text> : null}
      </View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
        <Switch value={valor} disabled={conFactura === undefined} trackColor={{ false: c.border, true: c.action }} />
      </View>
    </Pressable>
    {faltantes.length > 0 ? (
      <Notice tone="advertencia" title="El stock fiscal no alcanza:">
        {[...faltantes.map(describirFaltanteFiscal), 'Podés confirmar igual: el stock fiscal queda negativo y sale la alerta.'].join('\n')}
      </Notice>
    ) : null}
    </View>
  )
}
