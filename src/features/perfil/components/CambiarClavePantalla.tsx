import React from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { TopBar } from '@/core/ui/fw'
import { useColors } from '@/libs/theme'
import { useAuthStore } from '@/libs/store/auth.store'
import { CambiarContrasena } from '@/features/cuenta/components/CambiarContrasena'

/** Pantalla propia de "Cambiar contraseña" (lámina perfil--clave): barra con vuelta y el formulario de siempre, con su pie fijo. */
export function CambiarClavePantalla() {
  const c = useColors()
  const router = useRouter()
  const email = useAuthStore((s) => s.user?.email)
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Cambiar contraseña" leading={{ kind: 'atras', onPress: () => router.back() }} />
      {/* El formulario trae su propio scroll y el pie fijo con el botón (propuesta Cuenta, frame 4). */}
      <CambiarContrasena email={email} />
    </View>
  )
}
