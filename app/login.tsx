import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, type TextInputInstance } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNetworkStatus } from '@/core/utils/useNetworkStatus'
import { useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, Fingerprint } from 'lucide-react-native'
import { useColors, space, typeScale } from '../libs/theme'
import { useResponsive } from '../libs/useResponsive'
import { Button, Notice, PieFijo, Segmented, type SegmentedOption } from '@/core/ui/fw'
import { safeHaptics } from '@/core/utils/haptics'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { LogoForward } from '@/features/auth/components/LogoForward'
import { useTecladoVisible } from '@/core/utils/useTecladoVisible'
import {
  authenticateWithBiometrics,
  getBiometricChoice,
  getBiometricChoiceFor,
  hasSavedCredentials,
  isBiometricsAvailable,
  saveCredentials,
} from '@/features/auth/utils/biometrics'
import { useOfertaDeHuella } from '@/features/auth/store/ofertaDeHuella.store'
import { API_URL, setApiUrl, ENV_PROD, ENV_LOCAL } from '@/libs/api-client'

/** El mismo tope que aplica `useAuth` antes de bloquear el ingreso. */
const INTENTOS_ANTES_DEL_BLOQUEO = 5

const ENTORNOS: SegmentedOption<string>[] = [
  { value: ENV_PROD, label: 'Producción' },
  { value: ENV_LOCAL, label: 'Local' },
]

/**
 * Ingreso (variante A de la maqueta del login; reglas mobile §15): usuario y contraseña o huella.
 * Sigue el tema del sistema; en teléfono el botón queda fijo sobre el teclado (`PieFijo`).
 * Las builds que van a los teléfonos entran siempre a producción; el selector de servidor queda
 * solo en la build de desarrollo.
 */
export default function LoginScreen() {
  const router = useRouter()
  const c = useColors()
  const { isTablet } = useResponsive()
  const teclado = useTecladoVisible()
  const insets = useSafeAreaInsets()
  // Con el teclado abierto la barra del sistema queda tapada: no se suma.
  const insetInferior = teclado ? 0 : insets.bottom
  const queryClient = useQueryClient()
  const { login, isLoading, error, isLocked, failedAttempts } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [verContrasena, setVerContrasena] = useState(false)
  const [faltanDatos, setFaltanDatos] = useState(false)
  const [ofrecerHuella, setOfrecerHuella] = useState(false)
  const [currentUrl, setCurrentUrl] = useState(API_URL)
  const [foco, setFoco] = useState<'usuario' | 'contrasena' | null>(null)
  const contrasenaRef = useRef<TextInputInstance>(null)
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
      const [disponible, guardadas, eleccion] = await Promise.all([
        isBiometricsAvailable(),
        hasSavedCredentials(),
        getBiometricChoice(),
      ])
      if (!vivo) return
      // Only the button: the fingerprint is asked when it is pressed, never on its own (S2).
      setOfrecerHuella(disponible && guardadas && eleccion === 'enabled')
    })()
    return () => { vivo = false }
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
    const creds = { username: username.trim(), password: password.trim() }
    // Bound to the username: if someone else had decided, their decision and credential are deleted first.
    const [eleccion, disponible] = await Promise.all([getBiometricChoiceFor(creds.username), isBiometricsAvailable()])
    if (eleccion === 'enabled') {
      // Turned on in Mi cuenta: saved now, behind device authentication. Cancelling it only skips the save.
      try {
        await saveCredentials(creds)
      } catch {
        // The person cancelled the device authentication: the session stays open, nothing is saved.
      }
    } else if (eleccion === null && disponible) {
      // Opt-in: asked once the session is open (`OfertaDeHuella`); nothing is saved until the person accepts.
      useOfertaDeHuella.getState().ofrecer(creds)
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
  const lineaIntentos =
    !isLocked && failedAttempts > 0 && quedan > 0 ? `Te quedan ${quedan} ${quedan === 1 ? 'intento' : 'intentos'} antes del bloqueo.` : null
  const etiqueta = [typeScale.secundario, { fontWeight: '600' as const, color: c.text }]
  // Los dos campos se marcan en error: el servidor no distingue cuál falló.
  const conError = !!error && !faltanDatos
  const campo = (enfocado: boolean) => ({
    height: isTablet ? 56 : 52,
    borderRadius: 12,
    borderWidth: enfocado || conError ? 2 : 1,
    borderColor: conError ? c.chip.anulado.text : enfocado ? c.brandInk : c.borderStrong,
    backgroundColor: c.surface,
    paddingHorizontal: space[4] - (enfocado || conError ? 1 : 0),
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    opacity: isLoading ? 0.55 : 1,
  })
  const textoCampo = { flex: 1, minWidth: 0, ...typeScale.cuerpo, color: c.text, paddingVertical: 0 }

  const botones = (
    <>
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
          disabled={sinConexion || isLoading}
          accessibilityState={{ disabled: sinConexion || isLoading }}
          onPress={() => { void entrarConHuella() }}
          android_ripple={{ color: c.borderStrong }}
          style={{
            height: 52,
            opacity: sinConexion ? 0.4 : isLoading ? 0.55 : 1,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: c.borderStrong,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: space[2] + 2,
            overflow: 'hidden',
          }}
        >
          <Fingerprint size={22} color={c.text} />
          <Text maxFontSizeMultiplier={1.3} style={[typeScale.cuerpoDestacado, { color: c.text }]}>Entrar con huella</Text>
        </Pressable>
      ) : null}
    </>
  )

  const formulario = (
    <View style={{ gap: space[3] + 2 }}>
      {isTablet ? (
        <Text accessibilityRole="header" style={{ fontSize: 28, lineHeight: 36, fontWeight: '700', color: c.text, marginBottom: space[2] }}>
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
            android_ripple={{ color: c.border, borderless: true }}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            {verContrasena ? <EyeOff size={22} color={c.textSecondary} /> : <Eye size={22} color={c.textSecondary} />}
          </Pressable>
        </View>
      </View>

      {/* PROPUESTA de la lámina: sin red el ingreso y la huella quedan apagados (ambos necesitan al servidor). */}
      {sinConexion ? <Notice tone="advertencia">Sin conexión. Conectate a internet para ingresar; se reintenta solo.</Notice> : null}
      {faltanDatos ? <Notice tone="advertencia">Completá tu usuario y tu contraseña.</Notice> : null}
      {/* Un solo aviso: el texto del servidor y, adentro, los intentos que quedan. */}
      {error && !faltanDatos ? (
        <Notice tone="peligro" testID="login-aviso-error" title={lineaIntentos ? error : undefined}>{lineaIntentos ?? error}</Notice>
      ) : lineaIntentos && !faltanDatos ? (
        <Notice tone="advertencia" testID="login-aviso-error">{lineaIntentos}</Notice>
      ) : null}

      {__DEV__ ? (
        <View style={{ gap: 6 }}>
          <Text style={etiqueta}>Servidor (solo en desarrollo)</Text>
          <Segmented accessibilityLabel="Servidor" options={ENTORNOS} value={currentUrl} onChange={(url) => { void cambiarEntorno(url) }} />
        </View>
      ) : null}

      {/* En tablet los botones van en el formulario; en teléfono quedan en el pie fijo sobre el teclado. */}
      {isTablet ? <View style={{ marginTop: space[2], gap: space[3] }}>{botones}</View> : null}

      <Text style={[typeScale.secundario, { color: c.textSecondary, textAlign: 'center', marginTop: space[3] }]}>
        ¿Olvidaste la contraseña? Pedila a tu administrador.
      </Text>
    </View>
  )

  // El logo FWD real (el de la web); el nombre "Forward" va al lado en texto, así que el logo es decorativo.
  const logo = (alto: number) => (
    <View testID="login-marca" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ alignSelf: 'flex-start' }}>
      <LogoForward alto={alto} />
    </View>
  )

  if (isTablet) {
    return (
      <KeyboardAvoidingView testID="login-raiz" behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, flexDirection: 'row', backgroundColor: c.bg }}>
        <View style={{ flex: 1, padding: 64, paddingTop: 64 + insets.top, paddingBottom: 64 + insetInferior, justifyContent: 'space-between', backgroundColor: c.topBar }}>
          {logo(72)}
          <View style={{ gap: space[3] }}>
            <Text accessibilityRole="header" style={{ fontSize: 48, lineHeight: 56, fontWeight: '700', color: c.onTopBarStrong }}>Forward</Text>
            <Text style={{ fontSize: 20, lineHeight: 30, color: c.onTopBar, maxWidth: 420 }}>
              Vendé, cobrá y seguí tus pedidos desde la calle, con los mismos datos que la web.
            </Text>
          </View>
          <Text style={[typeScale.secundario, { color: c.onTopBar }]}>Forward Distribuidora</Text>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingTop: 64 + insets.top, paddingBottom: 64 + insetInferior, paddingHorizontal: 80 }} keyboardShouldPersistTaps="handled">
          {formulario}
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  return (
    <View testID="login-raiz" style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: space[6], paddingTop: insets.top + (teclado ? space[4] : space[8]), paddingBottom: space[6], width: '100%', maxWidth: 480, alignSelf: 'center', gap: space[6] }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: space[2] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            {logo(teclado ? 40 : 56)}
            <Text maxFontSizeMultiplier={1.3} style={{ ...typeScale.titulo, color: c.text }}>Forward</Text>
          </View>
          {teclado ? null : (
            <View style={{ gap: space[1], marginTop: space[4] }}>
              <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} style={[typeScale.titulo, { color: c.text }]}>Ingresá a tu cuenta</Text>
              <Text style={[typeScale.cuerpo, { color: c.textSecondary }]}>Usá el mismo usuario y contraseña de la web.</Text>
            </View>
          )}
        </View>
        {formulario}
      </ScrollView>
      <PieFijo fondo="bg" testID="login-pie">{botones}</PieFijo>
    </View>
  )
}
