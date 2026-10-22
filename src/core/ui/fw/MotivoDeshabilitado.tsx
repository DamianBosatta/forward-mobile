import React from 'react'
import { Text, View } from 'react-native'
import { Lock } from 'lucide-react-native'
import { space, useColors } from '@/libs/theme'

/** Por qué no hay permiso para registrar cobros: la web lo dice en el panel y el lienzo (PermPatrones, panel 2) lo muestra bajo el botón. */
export const MOTIVO_SIN_PERMISO_DE_COBRO = 'Para registrar cobros necesitás el permiso de Pagos. Pedíselo a quien administra los usuarios.'
/** Idem para la transferencia entre cuentas propias (movimiento interno). */
export const MOTIVO_SIN_PERMISO_DE_TRANSFERENCIA = 'Para registrar transferencias necesitás el permiso de Pagos. Pedíselo a quien administra los usuarios.'

/** Motivo de un botón deshabilitado (patrón 2 de PermPatrones): candado y texto 13/18 en color secundario, justo debajo del botón. */
export function MotivoDeshabilitado({ children, testID }: { children: string; testID?: string }) {
  const c = useColors()
  return (
    <View testID={testID} accessibilityRole="text" style={{ flexDirection: 'row', gap: space[2] }}>
      <Lock size={16} color={c.textSecondary} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: c.textSecondary }}>{children}</Text>
    </View>
  )
}
