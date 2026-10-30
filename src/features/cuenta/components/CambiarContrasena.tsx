import React, { useState } from 'react'
import { Text, View } from 'react-native'
import { Check, X } from 'lucide-react-native'
import { Button, Field, Notice } from '@/core/ui/fw'
import { evaluarClave, type CodigoRequisitoClave } from '@/libs/reglas'
import { space, typeScale, useColors } from '@/libs/theme'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { useCambiarContrasena } from '../api/cuenta'

/**
 * Cambiar la contraseña propia (lámina perfil--clave; la pantalla es `perfil/clave`). Las reglas las valida el servidor.
 * La lista viva de reglas sale de `evaluarClave` (`@forward/reglas`, forward-system #1046, S6): acá solo se rotula.
 */
// Rótulos cortos de la lámina, en su orden; el estado (cumple) lo da `evaluarClave`.
const RULES: { codigo: CodigoRequisitoClave; texto: string }[] = [
  { codigo: 'largo', texto: 'Mínimo 10 caracteres' },
  { codigo: 'mayuscula', texto: 'Una mayúscula' },
  { codigo: 'minuscula', texto: 'Una minúscula' },
  { codigo: 'numero', texto: 'Un número' },
  { codigo: 'simbolo', texto: 'Un símbolo' },
]

function ReglasDeClave({ clave }: { clave: string }) {
  const c = useColors()
  const estado = new Map(evaluarClave(clave).map((r) => [r.codigo, r.cumple]))
  return (
    <View style={{ gap: space[1] }}>
      {RULES.map(({ codigo, texto }) => {
        const cumple = estado.get(codigo) === true
        const Icono = cumple ? Check : X
        const etiqueta = `${texto} · ${cumple ? 'cumple' : 'falta'}`
        return (
          <View key={codigo} accessible accessibilityLabel={etiqueta} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <Icono size={16} color={cumple ? c.success : c.danger} />
            <Text style={[typeScale.secundario, { color: c.textSecondary }]}>{etiqueta}</Text>
          </View>
        )
      })}
    </View>
  )
}

export function CambiarContrasena({ email }: { email: string | undefined }) {
  const c = useColors()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetida, setRepetida] = useState('')
  const m = useCambiarContrasena()
  const noCoinciden = repetida.length > 0 && repetida !== nueva
  const claveValida = evaluarClave(nueva).every((r) => r.cumple)
  const completo = !!email && actual.length > 0 && claveValida && repetida === nueva

  const cambiar = () => {
    if (!completo || !email) return
    m.mutate(
      { email, currentPassword: actual, newPassword: nueva, confirmNewPassword: repetida },
      { onSuccess: () => { setActual(''); setNueva(''); setRepetida('') } },
    )
  }

  return (
    <View style={{ gap: space[3] }}>
      {!email ? <Notice tone="info">No tenemos tu correo en este teléfono. Cerrá sesión y volvé a entrar para cambiar la contraseña.</Notice> : null}
      <Field label="Contraseña actual" value={actual} onChangeText={(t) => { setActual(t); m.reset() }} secureTextEntry verOcultar autoCapitalize="none" autoComplete="current-password" />
      <Field
        label="Contraseña nueva"
        value={nueva}
        onChangeText={(t) => { setNueva(t); m.reset() }}
        secureTextEntry
        verOcultar
        autoCapitalize="none"
        autoComplete="new-password"
      />
      <ReglasDeClave clave={nueva} />
      <Field
        label="Repetir la contraseña nueva"
        error={noCoinciden ? 'Las contraseñas no coinciden.' : undefined}
        value={repetida}
        onChangeText={(t) => { setRepetida(t); m.reset() }}
        secureTextEntry
        verOcultar
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
