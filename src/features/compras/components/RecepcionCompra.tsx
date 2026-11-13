import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { ArrowLeft } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors, useSombraTarjeta } from '@/libs/theme'
import { Button, Field, FormContainer, FilaInterruptor, Notice, PieFijo, TotalsRow, formatImporte } from '@/core/ui/fw'
import { MarcaRadio } from '@/features/venta-nueva/components/MarcaRadio'
import { textoFaltaCosto } from './CarritoCompra'

/** Lo que dice el interruptor: es la consecuencia de confirmar y recibir en un solo paso. */
export const RECIBIR_AHORA = 'Confirma la compra e ingresa el stock real en un solo paso, y genera la deuda con el proveedor.'

/**
 * Depósito de la compra: con CAP_VER_TODOS_LOS_DEPOSITOS y más de uno, se elige (filas con radio, como la venta); si no,
 * se muestra "Depósito: X". Lo usan el paso 4 y el carrito de la edición (que no tiene paso 4).
 */
export function DepositoCompra({ depositos, depositoId, onDeposito, puedeElegir }: {
  depositos: { id: string; nombre: string }[]; depositoId: string; onDeposito: (id: string) => void; puedeElegir: boolean
}) {
  const c = useColors()
  const sombra = useSombraTarjeta()
  if (!(puedeElegir && depositos.length > 1)) {
    const nombre = depositos.find((d) => d.id === depositoId)?.nombre ?? 'el tuyo'
    return (
      <View style={{ padding: space[4], borderRadius: radii.tarjeta, borderWidth: 1, borderColor: c.border, ...sombra, backgroundColor: c.surface }}>
        <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{`Depósito: ${nombre}`}</Text>
      </View>
    )
  }
  return (
    <View style={{ gap: space[2] }}>
      <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>Depósito</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Depósito" style={{ borderRadius: radii.tarjeta, borderWidth: 1, borderColor: c.border, ...sombra, backgroundColor: c.surface, overflow: 'hidden' }}>
        {depositos.map((d, i) => {
          const sel = d.id === depositoId
          return (
            <Pressable key={d.id} accessibilityRole="radio" accessibilityLabel={d.nombre} accessibilityState={{ checked: sel, selected: sel }} onPress={() => onDeposito(d.id)}
              android_ripple={{ color: c.surface2 }}
              style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], borderTopWidth: i ? 1 : 0, borderTopColor: c.border, backgroundColor: sel ? c.brandSoft : c.surface }}>
              <MarcaRadio elegido={sel} />
              <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{d.nombre}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

interface Props {
  proveedor: { nombre: string; cuit?: string | null; condicion: string | null; franja: string | null }
  depositos: { id: string; nombre: string }[]
  depositoId: string
  onDeposito: (id: string) => void
  /** Sin CAP_VER_TODOS_LOS_DEPOSITOS la compra entra en el depósito del usuario: se muestra, no se elige. */
  puedeElegirDeposito: boolean
  /** Con permiso de modificar compras se puede recibir en el mismo paso; sin él no hay interruptor. */
  puedeRecibir: boolean
  recibirAhora: boolean
  onRecibirAhora: (v: boolean) => void
  /** La condición de pago se cuenta desde la factura: recibir pide su fecha. */
  pideFactura: boolean
  fecha: string
  onFecha: (texto: string) => void
  fechaValida: boolean
  /** "Vence el 12/12/2026", si se puede calcular. */
  vencimiento: string | null
  /** "Factura A 0004-00012345", si se cargó el comprobante; abre la pantalla del comprobante. */
  comprobante: string | null
  onComprobante: () => void
  faltanCostos: number
  onVolverAlCarrito: () => void
  error: string | null
  subtotal: number
  gastos: number
  total: number
  ocupado: boolean
  onConfirmar: () => void
  onGuardarNota: () => void
}

/**
 * Paso 4 de la compra nueva (maqueta "Compras como venta", frames 12 a 15; copia "Entrega y facturación" de la venta):
 * proveedor, depósito y el interruptor "Recibir ahora" donde la venta pone "Con factura". Apagado, "Confirmar compra" la
 * deja por recibir; prendido, aparecen la fecha de factura (solo si la condición la pide) y el comprobante, y el botón
 * pasa a "Confirmar y recibir". Con un costo faltante no se confirma ni se guarda la nota de pedido (como hasta ahora).
 */
export function RecepcionCompra(p: Props) {
  const c = useColors()
  const sombra = useSombraTarjeta()
  const secundario = { ...typeScale.secundario, color: c.textSecondary }
  const tarjeta = { gap: space[2], padding: space[4], borderRadius: radii.tarjeta, borderWidth: 1, borderColor: c.border, ...sombra, backgroundColor: c.surface }
  const bloqueado = p.ocupado || p.faltanCostos > 0
  const recibir = p.puedeRecibir && p.recibirAhora
  const fila = (k: string, v: string | null) => (v ? (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[3] }}>
      <Text style={secundario}>{k}</Text>
      <Text style={{ ...typeScale.secundario, color: c.text, flexShrink: 1, textAlign: 'right' }}>{v}</Text>
    </View>
  ) : null)
  const enlace = (label: string, onPress: () => void, a11y = label) => (
    <Pressable accessibilityRole="link" accessibilityLabel={a11y} onPress={onPress} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space[1], alignSelf: 'flex-start' }}>
      {label === 'Volver al carrito' ? <ArrowLeft size={16} color={c.brandInk} /> : null}
      <Text style={{ ...typeScale.cuerpoDestacado, color: c.brandInk }}>{label}</Text>
    </Pressable>
  )

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: space[4] }} keyboardShouldPersistTaps="handled">
        <FormContainer style={{ gap: space[3] }}>
        {enlace('Volver al carrito', p.onVolverAlCarrito)}
        {p.error ? <Notice tone="peligro">{p.error}</Notice> : null}
        {p.faltanCostos > 0 ? (
          <>
            <Notice tone="peligro" title="Falta el costo.">{textoFaltaCosto(p.faltanCostos)}</Notice>
            {enlace('Ir al carrito', p.onVolverAlCarrito)}
          </>
        ) : null}
        <View style={tarjeta}>
          <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>Proveedor</Text>
          <View>
            <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{p.proveedor.nombre}</Text>
            {p.proveedor.cuit ? <Text style={{ ...secundario, ...importe }}>{`CUIT ${p.proveedor.cuit}`}</Text> : null}
          </View>
          {fila('Plazo de pago', p.proveedor.condicion)}
          {fila('Franja horaria', p.proveedor.franja)}
        </View>
        <DepositoCompra depositos={p.depositos} depositoId={p.depositoId} onDeposito={p.onDeposito} puedeElegir={p.puedeElegirDeposito} />
        {p.puedeRecibir ? (
          <FilaInterruptor titulo="Recibir ahora" apoyo={RECIBIR_AHORA} prendido={p.recibirAhora} onChange={() => p.onRecibirAhora(!p.recibirAhora)} conDivisor />
        ) : null}
        {recibir ? (
          <View style={tarjeta}>
            <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>Factura del proveedor</Text>
            {p.pideFactura ? (
              <Field label="Fecha de la factura" placeholder="dd/mm/aaaa" value={p.fecha} onChangeText={p.onFecha} keyboardType="numbers-and-punctuation"
                error={p.fechaValida ? undefined : 'Escribí la fecha como dd/mm/aaaa.'}
                help={`La condición de pago se cuenta desde la factura.${p.vencimiento ? ` ${p.vencimiento}` : ''}`} />
            ) : null}
            {p.comprobante ? <Text style={{ ...typeScale.secundario, color: c.text }}>{p.comprobante}</Text> : null}
            <View style={{ gap: space[2] }}>
              <Button label="Sacar foto" variant="secundario" accessibilityLabel="Sacar foto de la factura" onPress={p.onComprobante} />
              <Button label={p.comprobante ? 'Cambiar datos' : 'Cargar datos'} variant="secundario" accessibilityLabel="Cargar los datos de la factura" onPress={p.onComprobante} />
            </View>
            <Text style={secundario}>Opcional. Se puede cargar después desde la compra.</Text>
          </View>
        ) : null}
        <View style={{ gap: space[1] }}>
          <TotalsRow label={p.faltanCostos > 0 ? 'Subtotal (falta un costo)' : 'Subtotal'} importe={p.subtotal} />
          {p.faltanCostos > 0 ? null : <TotalsRow label="Gastos operativos" importe={p.gastos} />}
        </View>
        </FormContainer>
      </ScrollView>
      <PieFijo>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>Total</Text>
          <Text accessibilityLabel={p.faltanCostos > 0 ? 'Total sin calcular' : undefined} style={{ ...typeScale.titulo, ...importe, color: c.text }}>
            {p.faltanCostos > 0 ? '—' : formatImporte(p.total)}
          </Text>
        </View>
        <Button label={recibir ? 'Confirmar y recibir' : 'Confirmar compra'} loading={p.ocupado}
          disabled={bloqueado || (recibir && p.pideFactura && !p.fechaValida)} onPress={p.onConfirmar} />
        <Pressable accessibilityRole="button" accessibilityLabel="Guardar nota de pedido" accessibilityState={{ disabled: bloqueado }} disabled={bloqueado} onPress={p.onGuardarNota}
          style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ ...typeScale.cuerpoDestacado, color: bloqueado ? c.textSecondary : c.brandInk }}>Guardar nota de pedido</Text>
        </Pressable>
      </PieFijo>
    </>
  )
}
