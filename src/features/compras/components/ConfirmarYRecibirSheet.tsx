import React, { useState } from 'react'
import { Text } from 'react-native'
import { BottomSheet, Button, Field, Notice } from '@/core/ui/fw'
import { typeScale, useColors } from '@/libs/theme'
import { fechaIso, hoyTexto } from '../lib/fecha'

interface Props {
  visible: boolean
  onClose: () => void
  /** La condición de pago se cuenta desde la factura: hay que mandar su fecha. */
  pideFactura: boolean
  /** Mientras está en curso la hoja no se cierra: el resultado se tiene que ver. */
  ocupado: boolean
  /** La fecha (dd/mm/aaaa) vive en quien abre la hoja: sobrevive a una recarga que la desmonte. */
  fecha: string
  onFecha: (texto: string) => void
  /** Motivo del servidor cuando no se hizo. */
  error: string | null
  /** Recibe la fecha de la factura (yyyy-MM-dd) solo si se pide. */
  onConfirmar: (fechaFacturaProveedor?: string) => void
}

/** Hoja de "Confirmar y recibir" (compra nueva y detalle en nota de pedido): una sola llamada al servidor. */
export function ConfirmarYRecibirSheet({ visible, onClose, pideFactura, ocupado, error, onConfirmar }: Props) {
  const c = useColors()
  const [fecha, onFecha] = useState(hoyTexto)
  console.log('MONTA', fecha)
  const leida = fechaIso(fecha)
  return (
    <BottomSheet visible={visible} onClose={() => { if (!ocupado) onClose() }} accessibilityLabel="Confirmar y recibir la compra">
      <Text style={[typeScale.titulo, { color: c.text }]}>Confirmar y recibir</Text>
      <Text style={[typeScale.secundario, { color: c.textSecondary }]}>
        Confirma la compra e ingresa el stock real en un solo paso, y genera la deuda con el proveedor.
      </Text>
      {pideFactura ? (
        <Field label="Fecha de la factura" placeholder="dd/mm/aaaa" value={fecha} onChangeText={onFecha} keyboardType="numbers-and-punctuation"
          help="La condición de pago se cuenta desde la factura." error={leida ? undefined : 'Escribí la fecha como dd/mm/aaaa.'} />
      ) : null}
      {error ? <Notice tone="peligro">{error}</Notice> : null}
      <Button label="Confirmar y recibir" loading={ocupado} disabled={pideFactura && !leida}
        onPress={() => onConfirmar(pideFactura ? leida! : undefined)} />
    </BottomSheet>
  )
}
