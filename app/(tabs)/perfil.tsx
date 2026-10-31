import React, { useEffect, useRef, useState } from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Constants from 'expo-constants'
import { Bell, Fingerprint, Lock, LogOut } from 'lucide-react-native'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../libs/store/auth.store'
import { useThemeStore, useColors, radii, space, typeScale, type ThemeMode } from '../../libs/theme'
import { ConfirmModal } from '@/core/ui'
import { Button, FilaDeAjuste, FilaInterruptor, Notice, Segmented, TopBar, useMenuLeading, type SegmentedOption } from '@/core/ui/fw'
import { API_URL, setApiUrl, ENV_PROD, ENV_LOCAL } from '@/libs/api-client'
import { FilaDeUsuarios } from '@/features/perfil/components/FilaDeUsuarios'
import { useCerrarSesion } from '@/features/cuenta/hooks/useCerrarSesion'
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
  const queryClient = useQueryClient()
  const { user, logout, canDo } = useAuthStore()
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
  const quien = [user?.roles?.join(' · '), user?.username].filter(Boolean).join(' · ')
  const version = Constants.expoConfig?.version
  const tarjeta = { borderRadius: radii.tarjeta, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }
  const secundario = [typeScale.secundario, { color: c.textSecondary }]
  const titulo = (t: string) => <Text accessibilityRole="header" style={[typeScale.seccion, { color: c.text }]}>{t}</Text>

  const seccion = (t: string) => (
    <Text accessibilityRole="header" style={[typeScale.etiqueta, { color: c.textSecondary, textTransform: 'uppercase', paddingHorizontal: space[1] }]}>{t}</Text>
  )
  const cambiarHuella = async () => {
    if (!huella) return
    const prendida = !huella.prendida
    await setBiometricLoginEnabled(prendida)
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
      queryClient.clear()
      logout()
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
      <View style={{ backgroundColor: c.topBar, paddingHorizontal: space[4], paddingBottom: space[5] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] + 2, width: '100%', maxWidth: 640, alignSelf: 'center' }}>
          <View style={{ width: 60, height: 60, borderRadius: radii.pastilla, backgroundColor: c.action, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={[typeScale.titulo, { fontWeight: '700', color: c.onAction }]}>{iniciales}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 19, lineHeight: 26, fontWeight: '700', color: c.onTopBarStrong }}>{nombre}</Text>
            {quien ? <Text style={[typeScale.secundario, { color: c.onTopBar }]}>{quien}</Text> : null}
            {user?.email ? <Text style={[typeScale.secundario, { color: c.onTopBar }]}>{user.email}</Text> : null}
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4], paddingBottom: space[12], width: '100%', maxWidth: 640, alignSelf: 'center' }}>
        {seccion('Seguridad')}
        <View style={tarjeta}>
          {huella?.disponible ? (
            <FilaInterruptor icono={Fingerprint} titulo="Entrar con huella" apoyo={huella.prendida ? 'Prendida' : 'Apagada'} prendido={huella.prendida} onChange={() => { void cambiarHuella() }} conDivisor />
          ) : null}
          <FilaDeAjuste icono={Lock} titulo="Cambiar contraseña" apoyo="Pide la actual y una nueva" onPress={() => router.push('/perfil/clave')} />
        </View>
        {avisoHuella ? <Notice tone="info">{avisoHuella}</Notice> : null}

        {seccion('En este teléfono')}
        <View style={tarjeta}>
          <FilaDeAjuste icono={Bell} titulo="Avisos en el teléfono" apoyo="Cuáles saltan apenas llegan" onPress={() => router.push('/avisos/preferencias')} conDivisor />
          <View style={{ padding: space[4], paddingTop: space[3], gap: space[2] }}>
            <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>Tema</Text>
            <Segmented accessibilityLabel="Tema" options={THEME_OPTIONS} value={mode} onChange={setMode} />
          </View>
        </View>

        {canDo('MOD_USUARIOS', 'read') ? (
          <>
            {seccion('Equipo')}
            <View style={tarjeta}>
              <FilaDeUsuarios onPress={() => router.push('/perfil/usuarios')} />
            </View>
          </>
        ) : null}

        {__DEV__ ? (
          <View style={[tarjeta, { padding: space[4], gap: space[3] }]}>
            {titulo('Servidor (solo en desarrollo)')}
            <Segmented accessibilityLabel="Servidor" options={ENTORNOS} value={API_URL} onChange={(url) => { if (url !== API_URL) setEntornoPendiente(url) }} />
          </View>
        ) : null}

        <Text style={[secundario, { textAlign: 'center' }]}>
          {`Forward Mobile${version ? ` ${version}` : ''} · conectado a ${nombreEntorno(API_URL)}`}
        </Text>

        <View style={{ gap: space[2] }}>
          <Button label="Cerrar sesión" variant="peligroContorno" icon={LogOut} loading={saliendo} onPress={() => setConfirmarSalida(true)} />
          <Text style={secundario}>Cierra tu sesión aquí y en los demás dispositivos; en la web puede seguir abierta unos minutos. Para volver a entrar vas a necesitar tu usuario y tu contraseña.</Text>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={confirmarSalida}
        title="Cerrar sesión"
        message="Se cierra aquí y en los demás dispositivos; en la web puede seguir abierta unos minutos."
        variant="danger"
        confirmLabel="Cerrar sesión"
        cancelLabel="Cancelar"
        onConfirm={() => { setConfirmarSalida(false); void salir() }}
        onCancel={() => setConfirmarSalida(false)}
      />
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
