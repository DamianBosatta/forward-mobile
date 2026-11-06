import React from 'react'
import { Text } from 'react-native'
import { BottomSheet, Button } from '@/core/ui/fw'
import { typeScale, useColors } from '@/libs/theme'

interface Props {
  visible: boolean
  onAceptar: () => void
  onRechazar: () => void
}

/** Antes del pedido del sistema: para qué se usa la ubicación. Cerrarla es "Ahora no": el viaje sigue igual. */
export function PermisoGps({ visible, onAceptar, onRechazar }: Props) {
  const c = useColors()
  return (
    <BottomSheet visible={visible} onClose={onRechazar} accessibilityLabel="Ubicación del viaje">
      <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>¿Activamos la ubicación?</Text>
      <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>
        Mientras dure el viaje, la oficina ve por dónde va el camión. Si no querés, el viaje sigue igual.
      </Text>
      <Button label="Activar ubicación" onPress={onAceptar} />
      <Button label="Ahora no" variant="secundario" onPress={onRechazar} />
    </BottomSheet>
  )
}
