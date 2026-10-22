import React from 'react'
import { Text, View } from 'react-native'
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
 * deshabilitado y dice por qué. "Con factura" no está: el alta de venta del servidor no lo recibe.
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
