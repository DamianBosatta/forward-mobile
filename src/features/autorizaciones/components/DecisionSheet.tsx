import React, { useState } from 'react'
import { Text, View } from 'react-native'
import { BottomSheet, Button, Field, Notice } from '@/core/ui/fw'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { VentaCambioError, esConflictoDeVenta, useAutorizarVenta, useRechazarAutorizacion } from '@/libs/api-client/ventas'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { leerDescuentoAdicional } from '../lib/descuentoAdicional'
import { formatCantidad, type CambioDeLinea } from '../lib/ajustes'
import type { AjusteDeLinea } from '@/libs/api-client/autorizar-venta'

const MENSAJE_CONFLICTO = 'Otra persona modificó o resolvió esta venta mientras la veías. Se actualizó: revisala antes de decidir.'

export type Decision = 'autorizar' | 'rechazar'

interface Props {
  decision: Decision | null
  ventaId: string
  /** Dirección y nombre del cliente, para que se sepa sobre qué venta se decide. */
  cliente: string
  /** Versión del detalle que se está viendo; sin ella se pide al servidor. */
  version?: number
  /** Fecha de modificación de la bandeja: si la venta cambió después, el servidor no se toca. */
  fechaPendiente?: string
  /** Con margen en amarillo la razón es obligatoria (la exige el servidor). */
  razonObligatoria?: boolean
  /** Ofrece el descuento adicional al autorizar (el detalle; la bandeja solo confirma). */
  ofrecerDescuento?: boolean
  /** Mientras se vuelve a pedir la venta no se decide: la versión puede estar vieja. */
  bloqueado?: boolean
  /** La venta cambió desde que se cargó la bandeja: la hoja se cierra y se avisa por acá. */
  /** Solo el detalle edita líneas: bajar o quitar. Sin ellas la hoja autoriza igual que siempre. */
  ajustes?: AjusteDeLinea[]
  /** Lo que cambia, para mostrarlo antes de confirmar. */
  cambios?: CambioDeLinea[]
  /** Motivo por el que no se puede autorizar con esas cantidades (por ejemplo, quitó todas las líneas). */
  bloqueoDeAjustes?: string | null
  onConflicto?: (mensaje: string) => void
  onClose: () => void
  onHecho?: () => void
}

/**
 * Confirmación de la decisión. Rechazar pide el motivo (obligatorio: vuelve al vendedor).
 * Autorizar pide confirmación y una razón, obligatoria solo con margen en amarillo.
 */
export function DecisionSheet({ decision, ventaId, cliente, version, fechaPendiente, razonObligatoria = false, ofrecerDescuento = false, bloqueado = false, ajustes, cambios = [], bloqueoDeAjustes = null, onConflicto, onClose, onHecho }: Props) {
  const c = useColors()
  const [texto, setTexto] = useState('')
  const [descuento, setDescuento] = useState('')
  const conDescuento = ofrecerDescuento && decision === 'autorizar'
  const adicional = conDescuento ? leerDescuentoAdicional(descuento) : { valor: null }
  const autorizar = useAutorizarVenta()
  const rechazar = useRechazarAutorizacion()
  const m = decision === 'rechazar' ? rechazar : autorizar
  const obligatorio = decision === 'rechazar' || razonObligatoria
  const bloqueaAjustes = decision === 'autorizar' && !!bloqueoDeAjustes
  const falta = (obligatorio && texto.trim().length === 0) || !!adicional.error || bloqueaAjustes

  const cerrar = () => {
    setTexto('')
    setDescuento('')
    autorizar.reset()
    rechazar.reset()
    onClose()
  }
  const listo = {
    onSuccess: () => { cerrar(); onHecho?.() },
    onError: (e: unknown) => {
      if (!esConflictoDeVenta(e)) return
      cerrar()
      onConflicto?.(e instanceof VentaCambioError ? e.message : MENSAJE_CONFLICTO)
    },
  }
  const confirmar = () => {
    if (falta) return
    if (decision === 'rechazar') rechazar.mutate({ id: ventaId, version, fechaPendiente, motivo: texto }, listo)
    else autorizar.mutate({ id: ventaId, version, fechaPendiente, razon: texto, descuentoAdicionalPorcentaje: adicional.valor, ajustes }, listo)
  }

  const esRechazo = decision === 'rechazar'
  return (
    <BottomSheet visible={decision !== null} onClose={cerrar} accessibilityLabel={esRechazo ? 'Rechazar venta' : 'Autorizar venta'}>
      <Text accessibilityRole="header" style={[typeScale.seccion, { color: c.text }]}>{esRechazo ? 'Rechazar venta' : 'Autorizar venta'}</Text>
      <Text style={[typeScale.secundario, { color: c.textSecondary }]}>{cliente}</Text>
      <Text style={[typeScale.cuerpo, { color: c.text }]}>
        {esRechazo
          ? 'La venta vuelve al vendedor con el motivo a la vista y no reserva stock.'
          : 'La venta queda confirmada y reserva el stock.'}
      </Text>
      {!esRechazo && cambios.length > 0 ? (
        // Frame 21: los cambios del pedido en una tarjeta gris.
        <View accessible accessibilityLabel="Cambios en el pedido" style={{ gap: space[1], padding: space[3], borderRadius: radii.campo, backgroundColor: c.surface2 }}>
          <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>Cambios en el pedido</Text>
          {cambios.map((x) => (
            <Text key={x.id} style={[typeScale.secundario, { color: c.text }]}>
              {`${x.nombre}: ${x.despues === 0 ? 'quitado' : `${formatCantidad(x.antes)} → ${formatCantidad(x.despues)}`}`}
            </Text>
          ))}
        </View>
      ) : null}
      {bloqueaAjustes ? <Notice tone="peligro">{bloqueoDeAjustes}</Notice> : null}
      <Field
        label={esRechazo ? 'Motivo del rechazo · obligatorio' : razonObligatoria ? 'Razón para autorizar · obligatoria' : 'Razón para autorizar (opcional)'}
        help={esRechazo ? undefined
          : razonObligatoria ? 'Se pide porque hay margen en amarillo. Queda guardada en la venta.'
          // El servidor reevalúa el piso con el descuento: si deja líneas en amarillo, pide la razón.
          : adicional.valor !== null ? 'Si el descuento deja líneas por debajo del piso, la razón es obligatoria.'
          : undefined}
        value={texto}
        onChangeText={setTexto}
        maxLength={500}
      />
      {conDescuento ? (
        <Field
          label="Descuento adicional al autorizar (opcional)"
          help="No cambia la comisión del vendedor: se calcula sobre el precio previo."
          error={adicional.error}
          placeholder="%"
          keyboardType="decimal-pad"
          value={descuento}
          onChangeText={setDescuento}
          maxLength={6}
        />
      ) : null}
      {m.isError ? <Notice tone="peligro">{mensajeDelServidor(m.error, 'No se pudo guardar la decisión.')}</Notice> : null}
      <View style={{ flexDirection: 'row', gap: space[3] }}>
        <View style={{ flex: 1 }}><Button label="Cancelar" variant="secundario" onPress={cerrar} /></View>
        <View style={{ flex: 1 }}>
          <Button
            label={esRechazo ? 'Rechazar' : 'Autorizar'}
            variant={esRechazo ? 'peligro' : 'primario'}
            disabled={falta || bloqueado}
            loading={m.isPending}
            onPress={confirmar}
          />
        </View>
      </View>
    </BottomSheet>
  )
}
