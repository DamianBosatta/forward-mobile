import React from 'react'
import { View } from 'react-native'
import { Lock } from 'lucide-react-native'
import { space, useColors } from '@/libs/theme'
import { Field } from '@/core/ui/fw'

type FieldProps = React.ComponentProps<typeof Field>

/**
 * Campo de los formularios de socios (clientes y proveedores). Con `bloqueado` queda de solo lectura,
 * atenuado y con candado (lámina Editar cliente): el aviso de por qué lo da el formulario.
 */
export function CampoDeSocio({ bloqueado = false, ...campo }: FieldProps & { bloqueado?: boolean }) {
  const c = useColors()
  if (!bloqueado) return <Field {...campo} />
  return (
    <View style={{ opacity: 0.75 }}>
      <Field {...campo} editable={false} readOnly accessibilityState={{ disabled: true }} />
      <View pointerEvents="none" style={{ position: 'absolute', right: space[3], bottom: space[3] }}>
        <Lock size={18} color={c.textSecondary} />
      </View>
    </View>
  )
}
