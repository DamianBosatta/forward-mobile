import React, { useEffect, useRef, useState } from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Bell, Fingerprint, Lock, LogOut } from 'lucide-react-native'
import { useAuthStore } from '../../../libs/store/auth.store'
import { useThemeStore, useColors, radii, space, typeScale, type ThemeMode } from '../../../libs/theme'
import { ConfirmModal } from '@/core/ui'
import { BottomSheet, Button, FilaDeAjuste, FilaInterruptor, Notice, Segmented, TopBar, useMenuLeading, type SegmentedOption } from '@/core/ui/fw'
import { API_URL, setApiUrl, ENV_PROD, ENV_LOCAL } from '@/libs/api-client'
import { FilaDeUsuarios } from '@/features/perfil/components/FilaDeUsuarios'
import { lineasDeIdentidad } from '@/features/perfil/lib/identidad'
import { leerDatosDeVersion, lineasDeVersion } from '@/features/perfil/lib/version'
import { useCerrarSesion } from '@/features/cuenta/hooks/useCerrarSesion'
import { cerrarSesion as cerrarSesionEnElTelefono } from '@/features/auth/lib/cerrarSesion'
import { isBiometricLoginEnabled, isBiometricsAvailable, setBiometricLoginEnabled } from '@/features/auth/utils/biometrics'

const THEME_OPTIONS: SegmentedOption<ThemeMode>[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'system', label: 'Como el teléfono' },
]
const ENTORNOS: SegmentedOption<string>[] = [
  { value: ENV_PROD, label: 'Producción' },
  { value: ENV_LOCAL, label: 'Local' },
]
const nombreEntorno = (url: string | null) => (url === ENV_LOCAL ? 'local (docker)' : 'producción')
const AVISO_HUELLA_PRENDIDA = 'La próxima vez que entres con tu contraseña queda lista la huella.'

/**
 * Mi cuenta reducida (bloque 12, T2: lienzo R15; reglas mobile §14): contraseña, huella, avisos en
 * el teléfono, tema y cerrar sesión. Las sesiones abiertas y la configuración quedan en la web; el
 * selector de servidor, solo en la build de desarrollo.
 */
export default function PerfilScreen() {
  const c = useColors()
  const router = useRouter()
  const leading = useMenuLeading()
  const { user, canDo } = useAuthStore()
  const { mode, setMode } = useThemeStore()
  const { cerrarSesion, revocarEnElServidor } = useCerrarSesion()
  const [saliendo, setSaliendo] = useState(false)
  const [confirmarSalida, setConfirmarSalida] = useState(false)
  const [entornoPendiente, setEntornoPendiente] = useState<string | null>(null)
  const [huella, setHuella] = useState<{ disponible: boolean; prendida: boolean } | null>(null)
  const [avisoHuella, setAvisoHuella] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    void Promise.all([isBiometricsAvailable(), isBiometricLoginEnabled()]).then(([disponible, prendida]) => {
      if (vivo) setHuella({ disponible, prendida })
    })
    return () => { vivo = false }
  }, [])

  const nombre = [user?.nombre, user?.apellido].filter(Boolean).join(' ') || user?.username || 'Usuario'
  const iniciales = `${user?.nombre?.[0] ?? ''}${user?.apellido?.[0] ?? ''}`.toUpperCase() || '·'
  const { rol: quien, email } = lineasDeIdentidad(user)
  const [version] = useState(() => lineasDeVersion(leerDatosDeVersion()))
  // Tarjetas por tono, sin borde (propuesta Cuenta, frame 1).
  const tarjeta = { borderRadius: radii.tarjeta, backgroundColor: c.surface, overflow: 'hidden' as const }
  const secundario = [typeScale.secundario, { color: c.textSecondary }]
  const titulo = (t: string) => <Text accessibilityRole="header" style={[typeScale.seccion, { color: c.text }]}>{t}</Text>

  const seccion = (t: string) => (
    <Text accessibilityRole="header" style={[typeScale.etiqueta, { color: c.textSecondary, textTransform: 'uppercase', paddingHorizontal: space[1] }]}>{t}</Text>
  )
  const cambiarHuella = async () => {
    if (!huella || !user?.username) return
    const prendida = !huella.prendida
    await setBiometricLoginEnabled(prendida, user.username)
    setHuella({ ...huella, prendida })
    setAvisoHuella(prendida ? AVISO_HUELLA_PRENDIDA : null)
  }

  const salir = async () => {
    setSaliendo(true)
    await cerrarSesion()
  }

  const cambiandoEntorno = useRef(false)
  const cambiarEntorno = async () => {
    if (!entornoPendiente || cambiandoEntorno.current) return
    cambiandoEntorno.current = true
    const destino = entornoPendiente
    // La hoja se cierra antes de esperar al servidor: Cancelar no puede quedar vivo a mitad de camino
    // y el aviso de falla (Alert) no sale encima de un Modal visible.
    setEntornoPendiente(null)
    try {
      // Antes de cambiar la URL: el logout tiene que ir al servidor donde está la sesión.
      await revocarEnElServidor()
      await setApiUrl(destino)
      await cerrarSesionEnElTelefono()
      router.replace('/login')
    } catch (e) {
      Alert.alert('No se pudo cambiar de servidor', e instanceof Error && e.message ? e.message : 'Probá de nuevo.')
    } finally {
      cambiandoEntorno.current = false
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Mi cuenta" leading={leading} />
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4], paddingBottom: space[12], width: '100%', maxWidth: 640, alignSelf: 'center' }}>
        {/* Propuesta Cuenta, frame 1: la identidad sale de la franja oscura a una tarjeta sin borde con las iniciales en grande. */}
        <View testID="tarjeta-identidad" style={[tarjeta, { flexDirection: 'row', alignItems: 'center', gap: space[4], padding: space[4] }]}>
          <View testID="iniciales-identidad" style={{ width: 56, height: 56, borderRadius: radii.pastilla, backgroundColor: c.action, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={[typeScale.titulo, { color: c.onAction }]}>{iniciales}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[typeScale.titulo, { color: c.text }]}>{nombre}</Text>
            {quien ? <Text style={secundario}>{quien}</Text> : null}
            {email ? <Text style={secundario}>{email}</Text> : null}
          </View>
        </View>

        {seccion('Seguridad')}
        <View testID="tarjeta-seguridad" style={tarjeta}>
          {huella?.disponible ? (
            <FilaInterruptor icono={Fingerprint} titulo="Entrar con huella" apoyo={huella.prendida ? 'Prendida' : 'Apagada'} prendido={huella.prendida} onChange={() => { void cambiarHuella() }} conDivisor />
          ) : null}
          <FilaDeAjuste icono={Lock} titulo="Cambiar contraseña" apoyo="Pide la actual y una nueva" onPress={() => router.push('/perfil/clave')} />
        </View>
        {avisoHuella ? <Notice tone="info">{avisoHuella}</Notice> : null}

        {seccion('En este teléfono')}
        <View testID="tarjeta-telefono" style={tarjeta}>
          <FilaDeAjuste icono={Bell} titulo="Avisos en el teléfono" apoyo="Cuáles saltan apenas llegan" onPress={() => router.push('/avisos/preferencias')} conDivisor />
          <View style={{ padding: space[4], paddingTop: space[3], gap: space[2] }}>
            <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>Tema</Text>
            <Segmented accessibilityLabel="Tema" options={THEME_OPTIONS} value={mode} onChange={setMode} />
          </View>
        </View>

        {canDo('MOD_USUARIOS', 'read') ? (
          <>
            {seccion('Equipo')}
            <View testID="tarjeta-equipo" style={tarjeta}>
              <FilaDeUsuarios onPress={() => router.push('/perfil/usuarios')} />
            </View>
          </>
        ) : null}

        <View style={{ gap: space[1] }}>
          <Text style={[secundario, { textAlign: 'center' }]}>
            {`${version.version} · conectado a ${nombreEntorno(API_URL)}`}
          </Text>
          {version.actualizacion ? <Text style={[secundario, { textAlign: 'center' }]}>{version.actualizacion}</Text> : null}
        </View>

        <View style={{ gap: space[2] }}>
          <Button label="Cerrar sesión" variant="peligroContorno" icon={LogOut} loading={saliendo} onPress={() => setConfirmarSalida(true)} />
          <Text style={secundario}>Cierra tu sesión aquí y en los demás dispositivos; en la web puede seguir abierta unos minutos. Para volver a entrar vas a necesitar tu usuario y tu contraseña.</Text>
        </View>

        {__DEV__ ? (
          <View style={[tarjeta, { padding: space[4], gap: space[3] }]}>
            {titulo('Servidor (solo en desarrollo)')}
            <Segmented accessibilityLabel="Servidor" options={ENTORNOS} value={API_URL} onChange={(url) => { if (url !== API_URL) setEntornoPendiente(url) }} />
          </View>
        ) : null}
      </ScrollView>

      {/* Propuesta Cuenta, frame 3: la confirmación pasa a hoja desde abajo, con el mismo texto. */}
      <BottomSheet visible={confirmarSalida} onClose={() => setConfirmarSalida(false)} accessibilityLabel="Cerrar sesión">
        <Text accessibilityRole="header" style={[typeScale.seccion, { color: c.text }]}>Cerrar sesión</Text>
        <Text style={[typeScale.cuerpo, { color: c.text }]}>Se cierra aquí y en los demás dispositivos; en la web puede seguir abierta unos minutos.</Text>
        <Button testID="confirmar-cerrar-sesion" label="Cerrar sesión" variant="peligro" icon={LogOut} onPress={() => { setConfirmarSalida(false); void salir() }} />
        <Button label="Cancelar" variant="secundario" onPress={() => setConfirmarSalida(false)} />
      </BottomSheet>
      <ConfirmModal
        visible={entornoPendiente !== null}
        title="Cambiar de servidor"
        message={`Vas a pasar al servidor de ${nombreEntorno(entornoPendiente)}. Se cierra tu sesión para no mezclar datos.`}
        variant="warning"
        confirmLabel="Cambiar y salir"
        cancelLabel="Cancelar"
        onConfirm={() => { void cambiarEntorno() }}
        onCancel={() => setEntornoPendiente(null)}
      />
    </View>
  )
}
