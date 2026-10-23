import React from 'react'
import { Text, View } from 'react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, formatImporte } from '@/core/ui/fw'
import { MOTIVO_SIN_PERMISO_DE_TRANSFERENCIA, MotivoDeshabilitado } from '@/core/ui/fw/MotivoDeshabilitado'

interface Props {
  /** Suma de todo el filtro que da el servidor (solo en la página 1); sin ella no hay resumen: no se suma en el teléfono. */
  saldoTotal?: number
  puedeTransferir: boolean
  onTransferir: () => void
}

/** Encabezado de Cuentas corrientes (lámina ResCuentas): lo que te deben y la transferencia entre cuentas propias. */
export function ResumenDeCuentas({ saldoTotal, puedeTransferir, onTransferir }: Props) {
  const c = useColors()
  return (
    <View style={{ backgroundColor: c.topBar, paddingHorizontal: space[4], paddingBottom: space[3], gap: space[2] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        {saldoTotal !== undefined ? (
          <View
            accessible
            accessibilityLabel={`Te deben: ${formatImporte(saldoTotal)}`}
            style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radii.tarjeta, padding: space[3] }}
          >
            <Text style={{ ...typeScale.secundario, color: c.onTopBar }}>Te deben</Text>
            <Text style={[typeScale.titulo, importe, { color: c.onTopBarStrong }]}>{formatImporte(saldoTotal)}</Text>
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <View style={{ minWidth: 150 }}>
          <Button label="Transferencia" variant="secundario" disabled={!puedeTransferir} onPress={onTransferir} />
        </View>
      </View>
      {!puedeTransferir ? <MotivoDeshabilitado>{MOTIVO_SIN_PERMISO_DE_TRANSFERENCIA}</MotivoDeshabilitado> : null}
    </View>
  )
}
