import React from 'react'
import { Pressable, Switch, Text, View } from 'react-native'
import { importe, space, typeScale, useColors } from '@/libs/theme'
import { BottomSheet, Button, Field, Notice, formatImporte } from '@/core/ui/fw'
import { MotivoDeshabilitado } from '@/core/ui/fw/MotivoDeshabilitado'
import { METODO_ENTREGA } from '@/features/ventas/lib/venta-form-retiro'
import type { CabeceraVentaEstado } from '../hooks/useCabeceraVenta'
import { TiraDeDias } from './TiraDeDias'

/** Por qué no se puede guardar un presupuesto con un descuento sobre el tope (lámina CalleConfirmar). */
export const MOTIVO_PRESUPUESTO_SOBRE_TOPE = 'Un presupuesto no puede pasar tu tope de descuento'

interface Props {
  visible: boolean
  onClose: () => void
  tipo: 'Pedido' | 'Presupuesto'
  /** Editar una venta ya guardada: el botón guarda cambios. */
  edicion: boolean
  cab: CabeceraVentaEstado
  productos: number
  unidades: number
  total: number
  /** Qué va a quedar por autorizar (los motivos que ya se muestran en Líneas). */
  porAutorizar: string[]
  rechazos: string[]
  /** Algún descuento de la venta supera el tope del vendedor. */
  superaTope: boolean
  descuentoValido: boolean
  error: string | null
  enviando: boolean
  onConfirmar: () => void
}

/**
 * V7 "Confirmar pedido" (CalleConfirmar / TabCalleConfirmar): cuándo se entrega, nota para el depósito y el chofer,
 * qué va a quedar por autorizar, el resumen y el botón. La fecha y la nota son las de la pestaña Cabecera. Un
 * presupuesto con un descuento sobre el tope no se puede guardar (el servidor lo rechaza): el botón queda
 * deshabilitado y dice por qué. "Con factura" (solo al crear, como la web): nace con el default del servidor y se manda lo que quede elegido.
 */
export function ConfirmarVentaSheet(p: Props) {
  const c = useColors()
  const { cabecera } = p.cab
  const esPedido = p.tipo === 'Pedido'
  const titulo = p.edicion ? 'Guardar cambios' : esPedido ? 'Confirmar pedido' : 'Guardar presupuesto'
  const presupuestoSobreTope = !esPedido && p.superaTope
  const deshabilitado = p.productos === 0 || !p.descuentoValido || p.cab.fleteInvalido || !!p.cab.cesionError || p.enviando || presupuestoSobreTope
  const secundario = { ...typeScale.secundario, color: c.textSecondary }

  return (
    <BottomSheet visible={p.visible} onClose={p.onClose} accessibilityLabel="Confirmar venta">
      <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>{titulo}</Text>
      {cabecera.metodoEntrega !== METODO_ENTREGA.RetiroEnLocal ? (
        <View style={{ gap: space[2] }}>
          <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>¿Cuándo se entrega?</Text>
          {p.cab.calendarioError ? <Notice tone="peligro">No se pudo traer el calendario de entregas.</Notice> : null}
          {cabecera.fecha ? null : <Text style={secundario}>Sin fecha: elegí el día de entrega.</Text>}
          <TiraDeDias cab={p.cab} />
          {cabecera.flete > 0 ? <Text style={{ ...secundario, ...importe }}>{`Logística propia · flete ${formatImporte(cabecera.flete)}`}</Text> : null}
        </View>
      ) : <Text style={secundario}>Retira en el local: sin flete.</Text>}
      <Field label="Nota para el depósito y el chofer" multiline maxLength={500} value={p.cab.observaciones} onChangeText={p.cab.setObservaciones}
        placeholder="Ej.: entrar por el portón de atrás." />
      {!p.edicion ? <ConFactura conFactura={cabecera.conFactura} onChange={p.cab.setConFactura} /> : null}
      {p.rechazos.map((r) => <Notice key={r} tone="peligro">{r}</Notice>)}
      {esPedido && p.porAutorizar.length > 0 ? (
        <Notice tone="advertencia" title="Queda por autorizar">
          {`Porque ${p.porAutorizar.join(', ')}. Te avisamos cuando gestión lo resuelva.`}
        </Notice>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={secundario}>{`${p.productos} ${p.productos === 1 ? 'producto' : 'productos'} · ${p.unidades} ${p.unidades === 1 ? 'unidad' : 'unidades'}`}</Text>
        <Text testID="confirmar-total" style={{ ...typeScale.titulo, ...importe, color: c.text }}>{formatImporte(p.total)}</Text>
      </View>
      {p.error ? <Notice tone="peligro">{p.error}</Notice> : null}
      <Button label={titulo} onPress={p.onConfirmar} loading={p.enviando} disabled={deshabilitado} />
      {presupuestoSobreTope ? <MotivoDeshabilitado>{MOTIVO_PRESUPUESTO_SOBRE_TOPE}</MotivoDeshabilitado> : null}
    </BottomSheet>
  )
}

/** Misma regla que la web (con-factura.ts, cuentaDeLaVenta): con factura la deuda va a la cuenta Normal, sin factura a la TST. */
const cuentaDeLaVenta = (conFactura: boolean) => (conFactura ? 'Normal' : 'TST')

/** Interruptor "Con factura" (CalleConfirmar). Sin valor (el default no llegó) queda apagado y deshabilitado. */
function ConFactura({ conFactura, onChange }: { conFactura: boolean | undefined; onChange: (v: boolean) => void }) {
  const c = useColors()
  const valor = conFactura ?? false
  return (
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
  )
}
