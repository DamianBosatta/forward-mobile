import React from 'react'
import { iniciales } from '@/core/utils/texto'
import { View, ScrollView } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated'
import { DrawerContentComponentProps, useDrawerStatus } from 'expo-router/drawer'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { radii, space, useColors } from '@/libs/theme'
import { DrawerExpandable, DrawerGroupTitle, DrawerHeader, DrawerItem } from '@/core/ui/fw'
import { useResponsive } from '@/libs/useResponsive'
import { safeHaptics } from '@/core/utils/haptics'
import { usePermissions } from '@/core/auth/RequirePermission'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { hasCapability } from '@/features/auth/lib/capabilities'
import { useCerrarSesion } from '@/features/cuenta/hooks/useCerrarSesion'
import { MENU, MI_CUENTA, esRutaActiva, menuVisible, type MenuItem } from './menuModules'

/**
 * Each section is a Stack inside the Drawer (audit A-05), so the drawer route is the section ("ventas") and the
 * screen is nested in its state. Rebuilds the "section/screen" name the menu entries are keyed by
 * ("ventas/nueva"). Before the section's Stack has reported its state, the screen it was asked to open travels
 * in the route params (`screen`).
 */
function rutaActualDelCajon(state: DrawerContentComponentProps['state']): string | undefined {
  const ruta = state.routes?.[state.index]
  const interna = ruta?.state
    ? ruta.state.routes[ruta.state.index ?? ruta.state.routes.length - 1]?.name
    : (ruta?.params as { screen?: unknown } | undefined)?.screen
  if (ruta && typeof interna === 'string') return `${ruta.name}/${interna}`
  return state.routeNames[state.index]
}

const inicialesDeUsuario = (nombre?: string, apellido?: string) =>
  iniciales([nombre, apellido].filter(Boolean).join(' ')) || '·'

/**
 * Menú lateral (FWD, lote drawer). En teléfono: panel `bg` con esquinas derechas de 30, filas de 44 con radio 22,
 * la activa en píldora lime y Logística como una fila que despliega Picking y la Consola del chofer. En tablet
 * queda fijo, con el panel oscuro y la activa en color de acción. Quién ve cada entrada lo decide `menuVisible`.
 */
export default function CustomDrawerContent(props: DrawerContentComponentProps) {
  const c = useColors()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { isTablet } = useResponsive()
  const { canDo } = usePermissions()
  const { refreshPermissions } = useAuth()
  const { isAuthenticated, user } = useAuthStore()
  const { cerrarSesion } = useCerrarSesion()
  const isDrawerOpen = useDrawerStatus() === 'open'
  const reducido = useReducedMotion()
  const entrada = useSharedValue(0)

  React.useEffect(() => {
    if (isDrawerOpen && isAuthenticated) refreshPermissions()
  }, [isDrawerOpen, isAuthenticated])

  // drawerIn: el contenido entra 60 px desde la izquierda con un rebote leve; con Reduce Motion, sin movimiento.
  React.useEffect(() => {
    if (!isDrawerOpen || reducido) {
      entrada.value = 1
      return
    }
    entrada.value = 0
    entrada.value = withSpring(1, { damping: 14, stiffness: 160 })
  }, [isDrawerOpen, reducido, entrada])
  const estiloEntrada = useAnimatedStyle(() => ({ opacity: entrada.value, transform: [{ translateX: (1 - entrada.value) * -60 }] }))

  const rutaActual = rutaActualDelCajon(props.state)
  const grupos = menuVisible(MENU, {
    canDo,
    tieneCapacidad: (cap) => hasCapability(user?.permissions, cap),
  })
  // Una sola fila desplegable a la vez; abre sola si la pantalla actual es una de sus hijas.
  const [abierta, setAbierta] = React.useState<string | null>(null)
  const grupoDeLaRuta = grupos.flatMap((g) => g.items).find((it) => it.hijos?.some((h) => esRutaActiva(h, rutaActual)))?.id ?? null
  const desplegada = abierta ?? grupoDeLaRuta

  const irA = (item: MenuItem) => {
    safeHaptics.impact('light')
    router.push(item.href as never)
  }
  const fila = (item: MenuItem, hija = false) => (
    <DrawerItem
      key={item.id}
      label={item.label}
      icon={item.icon}
      hint={item.hint}
      hija={hija}
      oscuro={isTablet}
      activa={esRutaActiva(item, rutaActual)}
      onPress={() => irA(item)}
    />
  )
  const filaDeMenu = (item: MenuItem) =>
    item.hijos ? (
      <DrawerExpandable
        key={item.id}
        label={item.label}
        icon={item.icon}
        oscuro={isTablet}
        abierta={desplegada === item.id}
        onToggle={() => {
          safeHaptics.impact('light')
          setAbierta(desplegada === item.id ? '' : item.id)
        }}
      >
        {item.hijos.map((h) => fila(h, true))}
      </DrawerExpandable>
    ) : (
      fila(item)
    )

  const nombre = [user?.nombre, user?.apellido].filter(Boolean).join(' ') || 'Forward'
  return (
    <Animated.View
      style={[
        {
          flex: 1,
          backgroundColor: isTablet ? c.panelOscuro : c.bg,
          borderTopRightRadius: isTablet ? 0 : radii.tarjetaGrande,
          borderBottomRightRadius: isTablet ? 0 : radii.tarjetaGrande,
          overflow: 'hidden',
        },
        estiloEntrada,
      ]}
    >
      <DrawerHeader iniciales={inicialesDeUsuario(user?.nombre, user?.apellido)} nombre={nombre} rol={user?.roles?.join(' · ')} oscuro={isTablet} insetSuperior={insets.top} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: space[1], paddingHorizontal: space[3], gap: 2 }} showsVerticalScrollIndicator={false}>
        {grupos.map((g, i) => (
          <View key={g.title ?? `grupo-${i}`} style={{ gap: 2 }}>
            {g.title ? <DrawerGroupTitle oscuro={isTablet}>{g.title}</DrawerGroupTitle> : null}
            {g.items.map(filaDeMenu)}
          </View>
        ))}
      </ScrollView>

      <View
        style={{
          borderTopWidth: 2,
          borderTopColor: isTablet ? c.panelOscuroBorder : c.border,
          marginHorizontal: space[3],
          marginTop: space[1],
          paddingTop: space[1],
          paddingBottom: insets.bottom + space[3],
        }}
      >
        {fila(MI_CUENTA)}
        <DrawerItem
          label="Cerrar sesión"
          oscuro={isTablet}
          onPress={() => {
            safeHaptics.impact('light')
            void cerrarSesion()
          }}
        />
      </View>
    </Animated.View>
  )
}
