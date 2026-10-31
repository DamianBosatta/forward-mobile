import React from 'react'
import { Text, View } from 'react-native'
import { Lock } from 'lucide-react-native'
import { space, useColors } from '@/libs/theme'

/** Por qué no hay permiso para registrar cobros: el mismo texto de la web (finanzas/_components/cobro-pago-panel.tsx). */
export const MOTIVO_SIN_PERMISO_DE_COBRO =
  'No tenés permiso para registrar cobros ni pagos. Pedile a un administrador que te asigne el permiso de alta en el módulo Pagos.'
/** Idem para la transferencia entre cuentas propias (finanzas/_components/movimiento-interno-tab.tsx). */
export const MOTIVO_SIN_PERMISO_DE_TRANSFERENCIA =
  'No tenés permiso para registrar movimientos entre cuentas. Pedile a un administrador que te asigne el permiso de alta en el módulo Pagos.'

/** Idem para pagar un servicio (`POST /gastos`: alta en el módulo Pagos; los conceptos piden además ver Tesorería). */
export const MOTIVO_SIN_PERMISO_DE_SERVICIO =
  'No tenés permiso para registrar pagos de servicios. Pedile a un administrador que te asigne el permiso de alta en el módulo Pagos y el de ver Tesorería.'

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
