import React from 'react'
import { ScrollView, View } from 'react-native'
import { useRouter } from 'expo-router'
import { TopBar } from '@/core/ui/fw'
import { space, useColors } from '@/libs/theme'
import { useAuthStore } from '@/libs/store/auth.store'
import { CambiarContrasena } from '@/features/cuenta/components/CambiarContrasena'

/** Pantalla propia de "Cambiar contraseña" (lámina perfil--clave): barra con vuelta y el formulario de siempre. */
export function CambiarClavePantalla() {
  const c = useColors()
  const router = useRouter()
  const email = useAuthStore((s) => s.user?.email)
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Cambiar contraseña" leading={{ kind: 'atras', onPress: () => router.back() }} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space[4], paddingBottom: space[12], width: '100%', maxWidth: 640, alignSelf: 'center' }}>
        <CambiarContrasena email={email} />
      </ScrollView>
    </View>
  )
}
