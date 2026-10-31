import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useNetworkStatus } from '@/core/utils/useNetworkStatus'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Eye, EyeOff, Fingerprint } from 'lucide-react-native'
import { useColors, space, typeScale } from '../libs/theme'
import { useResponsive } from '../libs/useResponsive'
import { Button, Notice, Segmented, type SegmentedOption } from '@/core/ui/fw'
import { safeHaptics } from '@/core/utils/haptics'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useTecladoVisible } from '@/features/auth/hooks/useTecladoVisible'
import {
  authenticateWithBiometrics,
  getSavedCredentials,
  isBiometricLoginEnabled,
  isBiometricsAvailable,
  saveCredentials,
} from '@/features/auth/utils/biometrics'
import { API_URL, setApiUrl, ENV_PROD, ENV_LOCAL } from '@/libs/api-client'

/** El mismo tope que aplica `useAuth` antes de bloquear el ingreso. */
const INTENTOS_ANTES_DEL_BLOQUEO = 5

/** Campos sobre el fondo oscuro del ingreso (lienzo M1 y TM13): siempre oscuro, con o sin tema claro. */
const CAMPO = { fondo: '#18211F', borde: '#33403D' } as const

const ENTORNOS: SegmentedOption<string>[] = [
  { value: ENV_PROD, label: 'Producción' },
  { value: ENV_LOCAL, label: 'Local' },
]

/**
 * Ingreso (bloque 12, T2: lienzo M1 y TM13; reglas mobile §15): usuario y contraseña o huella.
 * Las builds que van a los teléfonos entran siempre a producción; el selector de servidor queda
 * solo en la build de desarrollo.
 */
export default function LoginScreen() {
  const router = useRouter()
  const c = useColors()
  const { isTablet } = useResponsive()
  const teclado = useTecladoVisible()
  const queryClient = useQueryClient()
  const { login, isLoading, error, isLocked, failedAttempts } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [verContrasena, setVerContrasena] = useState(false)
  const [faltanDatos, setFaltanDatos] = useState(false)
  const [ofrecerHuella, setOfrecerHuella] = useState(false)
  const [currentUrl, setCurrentUrl] = useState(API_URL)
  const [foco, setFoco] = useState<'usuario' | 'contrasena' | null>(null)
  const contrasenaRef = useRef<TextInput>(null)
  // Alcanzabilidad desconocida no apaga el ingreso: solo "sin red" afirmado.
  const sinConexion = !useNetworkStatus({ desconocidoCuentaComoSinRed: false }).isConnected

  const entrar = () => {
    safeHaptics.notification('success')
    router.replace('/(tabs)')
  }

  const entrarConHuella = async () => {
    safeHaptics.impact('medium')
    const creds = await authenticateWithBiometrics()
    if (!creds) return
    if (await login(creds.username, creds.password)) entrar()
  }

  useEffect(() => {
    let vivo = true
    void (async () => {
      const [disponible, guardadas, prendida] = await Promise.all([
        isBiometricsAvailable(),
        getSavedCredentials(),
        isBiometricLoginEnabled(),
      ])
      if (!vivo) return
      const ofrecer = disponible && !!guardadas && prendida
      setOfrecerHuella(ofrecer)
      if (ofrecer) void entrarConHuella()
    })()
    return () => { vivo = false }
    // Solo al abrir la pantalla: la huella se ofrece una vez sola.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (error) safeHaptics.notification('error')
  }, [error])

  const ingresar = async () => {
    safeHaptics.impact('heavy')
    if (!username.trim() || !password.trim()) {
      setFaltanDatos(true)
      return
    }
    if (!(await login(username, password))) return
    if (await isBiometricLoginEnabled()) {
      await saveCredentials({ username: username.trim(), password: password.trim() })
    }
    entrar()
  }

  const cambiarEntorno = async (url: string) => {
    if (url === currentUrl) return
    safeHaptics.impact('medium')
    setCurrentUrl(url)
    await setApiUrl(url)
    // setApiUrl ya borró la copia guardada; esto vacía la de memoria para no mezclar servidores.
    queryClient.clear()
  }

  const quedan = INTENTOS_ANTES_DEL_BLOQUEO - failedAttempts
  const etiqueta = [typeScale.secundario, { fontWeight: '600' as const, color: c.onTopBar }]
  // Los dos campos se marcan en error: el servidor no distingue cuál falló.
  const conError = !!error && !faltanDatos
  const campo = (enfocado: boolean) => ({
    height: isTablet ? 56 : 52,
    borderRadius: 12,
    borderWidth: enfocado || conError ? 2 : 1,
    borderColor: conError ? c.chip.anulado.text : enfocado ? c.action : CAMPO.borde,
    backgroundColor: CAMPO.fondo,
    paddingHorizontal: space[4],
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  })
  const textoCampo = { flex: 1, minWidth: 0, ...typeScale.cuerpo, color: c.onTopBarStrong, paddingVertical: 0 }

  const formulario = (
    <View style={{ gap: space[3] + 2 }}>
      {isTablet ? (
        <Text accessibilityRole="header" style={{ fontSize: 28, lineHeight: 36, fontWeight: '700', color: c.onTopBarStrong, marginBottom: space[2] }}>
          Ingresá
        </Text>
      ) : null}

      <View style={{ gap: 6 }}>
        <Text style={etiqueta}>Usuario o email</Text>
        <View style={campo(foco === 'usuario')}>
          <TextInput
            accessibilityLabel="Usuario o email"
            value={username}
            onChangeText={(t) => { setUsername(t); setFaltanDatos(false) }}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => contrasenaRef.current?.focus()}
            onFocus={() => setFoco('usuario')}
            onBlur={() => setFoco(null)}
            style={textoCampo}
          />
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={etiqueta}>Contraseña</Text>
        <View style={[campo(foco === 'contrasena'), { paddingRight: space[1] }]}>
          <TextInput
            ref={contrasenaRef}
            accessibilityLabel="Contraseña"
            value={password}
            onChangeText={(t) => { setPassword(t); setFaltanDatos(false) }}
            secureTextEntry={!verContrasena}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => { void ingresar() }}
            onFocus={() => setFoco('contrasena')}
            onBlur={() => setFoco(null)}
            style={textoCampo}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            onPress={() => setVerContrasena((v) => !v)}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            {verContrasena ? <EyeOff size={22} color={c.onTopBar} /> : <Eye size={22} color={c.onTopBar} />}
          </Pressable>
        </View>
      </View>

      {/* PROPUESTA de la lámina: sin red el ingreso y la huella quedan apagados (ambos necesitan al servidor). */}
      {sinConexion ? <Notice tone="advertencia">Sin conexión. Conectate a internet para ingresar; se reintenta solo.</Notice> : null}
      {faltanDatos ? <Notice tone="advertencia">Completá tu usuario y tu contraseña.</Notice> : null}
      {error && !faltanDatos ? <Notice tone="peligro">{error}</Notice> : null}
      {!isLocked && failedAttempts > 0 && quedan > 0 ? (
        <Text style={[typeScale.secundario, { color: c.onTopBar }]}>
          {`Te quedan ${quedan} ${quedan === 1 ? 'intento' : 'intentos'} antes del bloqueo.`}
        </Text>
      ) : null}

      {__DEV__ ? (
        <View style={{ gap: 6 }}>
          <Text style={etiqueta}>Servidor (solo en desarrollo)</Text>
          <Segmented accessibilityLabel="Servidor" options={ENTORNOS} value={currentUrl} onChange={(url) => { void cambiarEntorno(url) }} />
        </View>
      ) : null}

      <View style={{ marginTop: space[2], gap: space[3] }}>
        <Button
          label={isLocked ? 'Acceso bloqueado' : 'Ingresar'}
          onPress={() => { void ingresar() }}
          loading={isLoading}
          disabled={isLocked || sinConexion}
        />
        {ofrecerHuella ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Entrar con huella"
            disabled={sinConexion}
            accessibilityState={{ disabled: sinConexion }}
            onPress={() => { void entrarConHuella() }}
            android_ripple={{ color: CAMPO.borde }}
            style={{
              height: 52,
              opacity: sinConexion ? 0.4 : 1,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: CAMPO.borde,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: space[2] + 2,
              overflow: 'hidden',
            }}
          >
            <Fingerprint size={22} color={c.onTopBarStrong} />
            <Text style={[typeScale.cuerpoDestacado, { color: c.onTopBarStrong }]}>Entrar con huella</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={[typeScale.secundario, { color: c.onTopBar, textAlign: 'center', marginTop: space[3] }]}>
        ¿Olvidaste la contraseña? Pedila a tu administrador.
      </Text>
    </View>
  )

  const logo = (tam: number) => (
    <View testID="login-marca" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: tam, height: tam, borderRadius: tam * 0.28, backgroundColor: c.action, alignItems: 'center', justifyContent: 'center' }}>
      <ArrowRight size={tam * 0.53} strokeWidth={2.4} color={c.onAction} />
    </View>
  )

  if (isTablet) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, flexDirection: 'row', backgroundColor: c.topBar }}>
        <View style={{ flex: 1, padding: 64, justifyContent: 'space-between', backgroundColor: CAMPO.fondo }}>
          {logo(72)}
          <View style={{ gap: space[3] }}>
            <Text accessibilityRole="header" style={{ fontSize: 48, lineHeight: 56, fontWeight: '700', color: c.onTopBarStrong }}>Forward</Text>
            <Text style={{ fontSize: 20, lineHeight: 30, color: c.onTopBar, maxWidth: 420 }}>
              Vendé, cobrá y seguí tus pedidos desde la calle, con los mismos datos que la web.
            </Text>
          </View>
          <Text style={[typeScale.secundario, { color: c.onTopBar }]}>Forward Distribuidora</Text>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 64, paddingHorizontal: 80 }} keyboardShouldPersistTaps="handled">
          {formulario}
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: c.topBar }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: space[6], paddingBottom: space[8], width: '100%', maxWidth: 480, alignSelf: 'center' }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flex: 1, justifyContent: 'center', gap: space[3], paddingVertical: teclado ? space[4] : space[8] }}>
          {logo(teclado ? 40 : 64)}
          <Text accessibilityRole="header" style={{ marginTop: space[3], fontSize: 32, lineHeight: 40, fontWeight: '700', color: c.onTopBarStrong }}>Forward</Text>
          {teclado ? null : <Text style={[typeScale.cuerpo, { color: c.onTopBar }]}>Entrá con el mismo usuario de la web.</Text>}
        </View>
        {formulario}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
