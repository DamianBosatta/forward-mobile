import React, { useState } from 'react'
import { Text, View } from 'react-native'
import { BottomSheet, Button, Field, Notice } from '@/core/ui/fw'
import { space, typeScale, useColors } from '@/libs/theme'
import { useAutorizarVenta, useRechazarAutorizacion } from '@/libs/api-client/ventas'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'

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
  onClose: () => void
  onHecho?: () => void
}

/**
 * Confirmación de la decisión. Rechazar pide el motivo (obligatorio: vuelve al vendedor).
 * Autorizar pide confirmación y una razón, obligatoria solo con margen en amarillo.
 */
export function DecisionSheet({ decision, ventaId, cliente, version, fechaPendiente, razonObligatoria = false, onClose, onHecho }: Props) {
  const c = useColors()
  const [texto, setTexto] = useState('')
  const autorizar = useAutorizarVenta()
  const rechazar = useRechazarAutorizacion()
  const m = decision === 'rechazar' ? rechazar : autorizar
  const obligatorio = decision === 'rechazar' || razonObligatoria
  const falta = obligatorio && texto.trim().length === 0

  const cerrar = () => {
    setTexto('')
    autorizar.reset()
    rechazar.reset()
    onClose()
  }
  const listo = { onSuccess: () => { cerrar(); onHecho?.() } }
  const confirmar = () => {
    if (falta) return
    if (decision === 'rechazar') rechazar.mutate({ id: ventaId, version, fechaPendiente, motivo: texto }, listo)
    else autorizar.mutate({ id: ventaId, version, fechaPendiente, razon: texto }, listo)
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
      <Field
        label={esRechazo ? 'Motivo del rechazo · obligatorio' : razonObligatoria ? 'Razón para autorizar · obligatoria' : 'Razón para autorizar (opcional)'}
        help={razonObligatoria && !esRechazo ? 'Se pide porque hay margen en amarillo. Queda guardada en la venta.' : undefined}
        value={texto}
        onChangeText={setTexto}
        maxLength={500}
      />
      {m.isError ? <Notice tone="peligro">{mensajeDelServidor(m.error, 'No se pudo guardar la decisión.')}</Notice> : null}
      <View style={{ flexDirection: 'row', gap: space[3] }}>
        <View style={{ flex: 1 }}><Button label="Cancelar" variant="secundario" onPress={cerrar} /></View>
        <View style={{ flex: 1 }}>
          <Button
            label={esRechazo ? 'Rechazar' : 'Autorizar'}
            variant={esRechazo ? 'peligro' : 'primario'}
            disabled={falta}
            loading={m.isPending}
            onPress={confirmar}
          />
        </View>
      </View>
    </BottomSheet>
  )
}
