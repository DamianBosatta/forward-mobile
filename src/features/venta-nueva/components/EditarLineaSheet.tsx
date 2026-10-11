import React, { useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { Trash2 } from 'lucide-react-native'
import { radii, space, typeScale, importe, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { Button, Field, Notice, StatusChip, formatImporte } from '@/core/ui/fw'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { hasCapability } from '@/features/auth/lib/capabilities'
import { calcularSubtotalConDescuento, canViewCost, canViewStock, pctFromPrecio, precioFromPct } from '@/features/ventas/lib/descuentos'
import { calcularRentabilidadVenta } from '@/features/ventas/lib/rentabilidad-venta'
import { multiploDe, precioServidor, type LineaCarrito } from '../lib/carrito'
import { MENSAJE_TOPE_SIN_CONFIGURAR, avisoPiso, avisoTope, leerNumero, mostrarNumero } from '../lib/linea'
import { Redondo } from './ProductoCatalogoCard'

interface EditarLineaSheetProps {
  /** Línea a editar; null = cerrado. */
  linea: LineaCarrito | null
  onClose: () => void
  onConfirm: (linea: LineaCarrito) => void
  onQuitar: (productoId: string) => void
}

const BANDA = { rojo: 'en rojo', amarillo: 'en amarillo', verde: 'en verde' } as const

/**
 * Editar línea (lámina Linea, plan 9 §2.1). Teléfono: pantalla completa. Tablet: panel
 * lateral a la derecha (plan §8). El precio de lista es del servidor; el descuento % y el
 * precio con descuento se calculan uno del otro con descuentos.ts. Costo y margen solo con
 * CAP_VER_COSTOS: sin la capacidad no se dibuja nada de eso.
 */
export function EditarLineaSheet({ linea, onClose, onConfirm, onQuitar }: EditarLineaSheetProps) {
  const c = useColors()
  const { isTablet } = useResponsive()
  const user = useAuthStore((s) => s.user)
  const [cantidad, setCantidad] = useState(0)
  const [pctTexto, setPctTexto] = useState('0')
  const [precioTexto, setPrecioTexto] = useState('')

  const p = linea?.producto
  const base = p ? precioServidor(p) : 0
  useEffect(() => {
    if (!linea) return
    setCantidad(linea.cantidad)
    setPctTexto(mostrarNumero(linea.descuentoPct))
    setPrecioTexto(mostrarNumero(precioFromPct(precioServidor(linea.producto), linea.descuentoPct)))
  }, [linea])
  if (!linea || !p) return null

  const m = multiploDe(p)
  const pct = leerNumero(pctTexto)
  const precioFinal = precioFromPct(base, pct)
  const tope = avisoTope(pct, user?.maxDescuentoPorcentaje ?? 0, hasCapability(user?.permissions, 'CAP_EXENTO_TOPE_DESCUENTO'))
  const piso = avisoPiso(p, base, pct)
  const verCosto = canViewCost(user?.permissions)
  const verStock = canViewStock((user?.roles ?? []) as string[])
  const margen = calcularRentabilidadVenta({
    detalles: [{ precioUnitario: precioFinal, precioCostoSnapshot: p.precioCompraBase, cantidad }],
    subtotalBruto: precioFinal * cantidad,
    montoDescuento: 0,
  })
  const texto = (extra = {}) => ({ ...typeScale.cuerpoDestacado, color: c.text, ...extra })

  return (
    <Modal visible transparent={isTablet} animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: isTablet ? c.veil : c.bg }}>
        {isTablet && <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} style={{ flex: 1 }} />}
        <View testID="editar-linea" accessibilityLabel="Editar línea" style={{ flex: isTablet ? undefined : 1, width: isTablet ? 440 : undefined, backgroundColor: c.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], padding: space[4], backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{p.codigoPropio ?? ''}</Text>
              <Text style={texto()}>{p.nombre}</Text>
              <Text style={{ ...typeScale.titulo, ...importe, color: c.text }}>
                {`Subtotal estimado ${formatImporte(calcularSubtotalConDescuento(base, cantidad, pct))}`}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Quitar la línea" onPress={() => onQuitar(p.id)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Trash2 size={22} color={c.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={texto()}>Unidades</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                <Redondo c={c} label="−" a11y="Restar" onPress={() => setCantidad((n) => Math.max(m, n - m))} />
                <Text accessibilityLabel={`Unidades: ${cantidad}`} style={texto({ ...importe, minWidth: 48, textAlign: 'center' })}>{cantidad}</Text>
                <Redondo c={c} label="+" a11y="Sumar" onPress={() => setCantidad((n) => n + m)} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: c.border, paddingBottom: space[3] }}>
              <Text style={texto()}>Precio de lista</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ ...typeScale.cuerpo, ...importe, color: c.text }}>{formatImporte(base)}</Text>
                <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Lo pone el sistema</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: space[3] }}>
              <View style={{ flex: 1 }}>
                <Field label="Descuento (%)" keyboardType="decimal-pad" alignRight value={pctTexto}
                  onChangeText={(t) => { setPctTexto(t); setPrecioTexto(mostrarNumero(precioFromPct(base, leerNumero(t)))) }} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Precio con descuento ($)" keyboardType="decimal-pad" alignRight value={precioTexto}
                  onChangeText={(t) => { setPrecioTexto(t); setPctTexto(mostrarNumero(pctFromPrecio(base, leerNumero(t)))) }} />
              </View>
            </View>
            <Text style={{ ...typeScale.secundario, color: c.textSecondary, marginTop: -space[2] }}>Cambiás uno y el otro se calcula solo.</Text>
            {tope === 'porAutorizar' && (
              <Notice tone="advertencia" title={`Tu tope de descuento es ${user?.maxDescuentoPorcentaje} %.`}>
                Podés guardar el pedido, pero va a quedar por autorizar.
              </Notice>
            )}
            {tope === 'sinConfigurar' && <Notice tone="peligro">{MENSAJE_TOPE_SIN_CONFIGURAR}</Notice>}
            {piso === 'rojo' && <Notice tone="peligro" title="Debajo del costo.">El sistema no deja guardar la venta con este precio.</Notice>}
            {piso === 'amarillo' && (
              <Notice tone="advertencia" title={`Debajo del precio mínimo (${formatImporte(p.precioMinimoRentable)}).`}>
                Va a quedar por autorizar.
              </Notice>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space[3], borderRadius: radii.tarjeta, backgroundColor: c.surface }}>
              <View>
                <Text style={texto()}>Stock</Text>
                {verStock && <Text style={{ ...typeScale.secundario, ...importe, color: c.textSecondary }}>{`Real ${p.real} · Virtual ${p.virtual}`}</Text>}
              </View>
              {verStock ? (
                <StatusChip estado={p.real >= cantidad ? 'entregado' : 'anulado'} label={p.real >= cantidad ? 'Alcanza' : 'No alcanza'} />
              ) : (
                <StatusChip estado={p.puedeVenderse ? 'entregado' : 'anulado'} label={p.puedeVenderse ? 'Hay stock' : 'Sin stock'} />
              )}
            </View>
            {verCosto && (
              <View testID="costos-linea" style={{ gap: space[1], padding: space[3], borderRadius: radii.tarjeta, backgroundColor: c.surface }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ ...typeScale.secundario, color: c.text }}>Precio de compra</Text>
                  <Text style={{ ...typeScale.secundario, ...importe, color: c.text }}>{formatImporte(p.precioCompraBase)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ ...typeScale.secundario, color: c.text }}>Margen de la línea</Text>
                  <Text style={{ ...typeScale.secundario, ...importe, color: c.text }}>
                    {margen ? `${mostrarNumero(margen.margenPct)} % · ${BANDA[piso ?? 'verde']}` : '—'}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
          <View style={{ padding: space[4], borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface }}>
            <Button label="Confirmar" onPress={() => onConfirm({ ...linea, cantidad, descuentoPct: pct })} />
          </View>
        </View>
      </View>
    </Modal>
  )
}
