import React, { useRef, useState } from 'react'
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../libs/store/auth.store'
import { useThemeStore, useColors, radii, space, typeScale, type ThemeMode } from '../../libs/theme'
import { ConfirmModal } from '@/core/ui'
import { Button, Segmented, TopBar, useMenuLeading, type SegmentedOption } from '@/core/ui/fw'
import { API_URL, setApiUrl, ENV_PROD, ENV_LOCAL } from '@/libs/api-client'
import { safeHaptics } from '@/core/utils/haptics'
import { useVentaNuevaStore, usePuedeProbarVentaNueva } from '@/features/ventas/lib/ventaNueva'
import { CambiarContrasena } from '@/features/cuenta/components/CambiarContrasena'
import { AVISO_SESION_NO_CERRADA_EN_TODOS, cerrarSesionEnElServidor } from '@/features/cuenta/api/cuenta'
import { SesionesAbiertas } from '@/features/cuenta/components/SesionesAbiertas'
import { darDeBajaPushAntesDeSalir } from '@/features/notificaciones'

const THEME_OPTIONS: SegmentedOption<ThemeMode>[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'system', label: 'Como el teléfono' },
]
const ENTORNOS: SegmentedOption<string>[] = [
  { value: ENV_PROD, label: 'Producción' },
  ...(__DEV__ ? [{ value: ENV_LOCAL, label: 'Local' }] : []),
]
const nombreEntorno = (url: string | null) => (url === ENV_LOCAL ? 'local (docker)' : 'producción')

/** Mi cuenta (fase 4.6, lámina MiCuenta): datos, tema, contraseña y cerrar sesión. */
export default function PerfilScreen() {
  const c = useColors()
  const router = useRouter()
  const leading = useMenuLeading()
  const queryClient = useQueryClient()
  const { user, logout } = useAuthStore()
  const { mode, setMode } = useThemeStore()
  const ventaNueva = useVentaNuevaStore((s) => s.activa)
  const setVentaNueva = useVentaNuevaStore((s) => s.setActiva)
  const puedeProbarVentaNueva = usePuedeProbarVentaNueva()
  const [saliendo, setSaliendo] = useState(false)
  const [confirmarSalida, setConfirmarSalida] = useState(false)
  const [entornoPendiente, setEntornoPendiente] = useState<string | null>(null)

  const nombre = [user?.nombre, user?.apellido].filter(Boolean).join(' ') || user?.username || 'Usuario'
  const iniciales = `${user?.nombre?.[0] ?? ''}${user?.apellido?.[0] ?? ''}`.toUpperCase() || '·'
  const tarjeta = { padding: space[4], gap: space[3], borderRadius: radii.tarjeta, backgroundColor: c.surface }
  const secundario = [typeScale.secundario, { color: c.textSecondary }]
  const titulo = (t: string) => <Text accessibilityRole="header" style={[typeScale.seccion, { color: c.text }]}>{t}</Text>

  /**
   * Revoca en el servidor (mejor esfuerzo); si no se pudo, lo dice: no queda la sensación de haber cerrado todo.
   * Antes da de baja el celular para push: después de revocar, el token de acceso ya no vale.
   */
  const revocarEnElServidor = async () => {
    await darDeBajaPushAntesDeSalir()
    const ok = await cerrarSesionEnElServidor()
    if (!ok) Alert.alert('Sesión cerrada solo aquí', AVISO_SESION_NO_CERRADA_EN_TODOS)
  }

  const salir = async () => {
    setSaliendo(true)
    await revocarEnElServidor()
    safeHaptics.notification('success')
    queryClient.clear()
    logout()
    router.replace('/login')
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
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4], paddingBottom: space[12], width: '100%', maxWidth: 640, alignSelf: 'center' }}>
        <View style={tarjeta}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <View style={{ width: 48, height: 48, borderRadius: radii.pastilla, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={[typeScale.cuerpoDestacado, { color: c.brandInk }]}>{iniciales}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>{nombre}</Text>
              <Text style={secundario}>{user?.roles?.join(' · ') ?? ''}</Text>
            </View>
          </View>
          <View accessible accessibilityLabel={`Correo: ${user?.email ?? 'sin dato'}`}>
            <Text style={secundario}>Correo</Text>
            <Text style={[typeScale.cuerpo, { color: c.text }]}>{user?.email ?? '—'}</Text>
          </View>
          <Text style={secundario}>Tus datos y tus permisos los cambia un administrador desde la web.</Text>
        </View>

        <View style={tarjeta}>
          {titulo('Tema')}
          <Segmented accessibilityLabel="Tema" options={THEME_OPTIONS} value={mode} onChange={setMode} />
          <Text style={secundario}>«Como el teléfono» sigue el modo claro u oscuro del sistema. Se guarda en este teléfono.</Text>
        </View>

        {/* Pruebas: la venta nueva convive con la vieja hasta que el dueño la apruebe (9A, PR 2.0) */}
        {puedeProbarVentaNueva && (
          <View style={tarjeta}>
            {titulo('Pruebas')}
            {/* La fila entera es el control (≥ 48 px); el Switch es solo la marca visual. */}
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel="Usar la venta nueva (en prueba)"
              accessibilityState={{ checked: ventaNueva }}
              onPress={() => { void setVentaNueva(!ventaNueva) }}
              style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] }}
            >
              <Text style={[typeScale.cuerpo, { flex: 1, color: c.text }]}>Usar la venta nueva (en prueba)</Text>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
                <Switch value={ventaNueva} trackColor={{ false: c.border, true: c.action }} />
              </View>
            </Pressable>
          </View>
        )}

        <View style={tarjeta}>
          <CambiarContrasena email={user?.email} />
        </View>

        <View style={tarjeta}>
          <SesionesAbiertas />
        </View>

        <View style={tarjeta}>
          {titulo('Servidor')}
          <Segmented accessibilityLabel="Servidor" options={ENTORNOS} value={API_URL} onChange={(url) => { if (url !== API_URL) setEntornoPendiente(url) }} />
        </View>

        <View style={tarjeta}>
          <Button label="Cerrar sesión" variant="peligro" loading={saliendo} onPress={() => setConfirmarSalida(true)} />
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
