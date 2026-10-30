import React, { useState } from 'react'
import { Text, View } from 'react-native'
import { Button, Field, Notice } from '@/core/ui/fw'
import { space, typeScale, useColors } from '@/libs/theme'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { useCambiarContrasena } from '../api/cuenta'

/**
 * Cambiar la contraseña propia (lámina MiCuenta). Las reglas las valida el servidor.
 * TODO: la lista viva de reglas (✓/✗ + cumple/falta) sale de `@forward/reglas` (forward-system #1046, S6): no se copia la regla acá.
 */
export function CambiarContrasena({ email }: { email: string | undefined }) {
  const c = useColors()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetida, setRepetida] = useState('')
  const m = useCambiarContrasena()
  const noCoinciden = repetida.length > 0 && repetida !== nueva
  const completo = !!email && actual.length > 0 && nueva.length > 0 && repetida === nueva

  const cambiar = () => {
    if (!completo || !email) return
    m.mutate(
      { email, currentPassword: actual, newPassword: nueva, confirmNewPassword: repetida },
      { onSuccess: () => { setActual(''); setNueva(''); setRepetida('') } },
    )
  }

  return (
    <View style={{ gap: space[3] }}>
      <Text accessibilityRole="header" style={[typeScale.seccion, { color: c.text }]}>Cambiar contraseña</Text>
      {!email ? <Notice tone="info">No tenemos tu correo en este teléfono. Cerrá sesión y volvé a entrar para cambiar la contraseña.</Notice> : null}
      <Field label="Contraseña actual" value={actual} onChangeText={(t) => { setActual(t); m.reset() }} secureTextEntry autoCapitalize="none" autoComplete="current-password" />
      <Field
        label="Contraseña nueva"
        help="Mínimo 10 caracteres, con mayúscula, minúscula, número y símbolo."
        value={nueva}
        onChangeText={(t) => { setNueva(t); m.reset() }}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
      />
      <Field
        label="Repetir la contraseña nueva"
        error={noCoinciden ? 'Las contraseñas no coinciden.' : undefined}
        value={repetida}
        onChangeText={(t) => { setRepetida(t); m.reset() }}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
      />
      {m.isError ? <Notice tone="peligro">{mensajeDelServidor(m.error, 'No se pudo cambiar la contraseña.')}</Notice> : null}
      {m.isSuccess ? <Notice tone="exito">Listo: la contraseña nueva ya vale para entrar.</Notice> : null}
      <Button label="Cambiar contraseña" onPress={cambiar} disabled={!completo} loading={m.isPending} />
      {completo ? null : <Text style={[typeScale.secundario, { color: c.textSecondary }]}>Se habilita cuando todo está completo y las dos nuevas coinciden.</Text>}
    </View>
  )
}
