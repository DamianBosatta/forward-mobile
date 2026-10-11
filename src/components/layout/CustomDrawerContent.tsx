import React from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { DrawerContentComponentProps, useDrawerStatus } from '@react-navigation/drawer'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { safeHaptics } from '@/core/utils/haptics'
import { usePermissions } from '@/core/auth/RequirePermission'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useAuthStore } from '@/libs/store/auth.store'
import { hasCapability } from '@/features/auth/lib/capabilities'
import { MENU, MI_CUENTA, esRutaActiva, menuVisible, type MenuItem } from './menuModules'

const iniciales = (nombre?: string, apellido?: string) =>
  `${nombre?.[0] ?? ''}${apellido?.[0] ?? ''}`.toUpperCase() || '·'

/**
 * Menú lateral (Bloque 9A, PR 0.3). En teléfono es la lámina Menu: panel claro
 * con cabecera oscura, filas de 48 con ícono. En tablet queda fijo y sigue la
 * lámina TabInicio: panel oscuro, filas de 44 y la activa en color de acción.
 */
export default function CustomDrawerContent(props: DrawerContentComponentProps) {
  const c = useColors()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { isTablet } = useResponsive()
  const { canDo } = usePermissions()
  const { refreshPermissions } = useAuth()
  const { isAuthenticated, user } = useAuthStore()
  const isDrawerOpen = useDrawerStatus() === 'open'

  React.useEffect(() => {
    if (isDrawerOpen && isAuthenticated) refreshPermissions()
  }, [isDrawerOpen, isAuthenticated])

  const rutaActual = props.state.routeNames[props.state.index]
  const grupos = menuVisible(MENU, {
    canDo,
    roles: user?.roles ?? [],
    tieneCapacidad: (cap) => hasCapability(user?.permissions, cap),
  })

  const fondo = isTablet ? c.topBar : c.surface
  const texto = isTablet ? c.onTopBar : c.text
  const secundario = isTablet ? c.onTopBar : c.textSecondary

  const fila = (item: MenuItem) => {
    const activa = esRutaActiva(item, rutaActual)
    const color = activa ? (isTablet ? c.onAction : c.brandInk) : texto
    const Icono = item.icon
    return (
      <Pressable
        key={item.id}
        accessibilityRole="button"
        accessibilityLabel={item.label}
        accessibilityState={{ selected: activa }}
        onPress={() => {
          safeHaptics.impact('light')
          router.push(item.href as never)
        }}
        style={{
          minHeight: isTablet ? 44 : 48,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[4],
          paddingHorizontal: isTablet ? space[3] : space[4],
          borderRadius: isTablet ? radii.campo : 0,
          backgroundColor: activa ? (isTablet ? c.action : c.brandSoft) : 'transparent',
        }}
      >
        {isTablet ? null : <Icono size={22} color={color} strokeWidth={2} />}
        <Text style={{ ...(activa ? typeScale.cuerpoDestacado : typeScale.cuerpo), color, flex: 1 }}>{item.label}</Text>
        {item.hint ? <Text style={{ ...typeScale.secundario, color: activa ? color : secundario }}>{item.hint}</Text> : null}
      </Pressable>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: fondo, paddingHorizontal: isTablet ? space[3] : 0 }}>
      <View
        style={{
          backgroundColor: c.topBar,
          paddingTop: insets.top + (isTablet ? space[4] : space[6]),
          paddingBottom: space[4],
          paddingHorizontal: isTablet ? space[1] : space[4],
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[3],
        }}
      >
        <View
          style={{
            width: isTablet ? 44 : 48,
            height: isTablet ? 44 : 48,
            borderRadius: radii.pastilla,
            backgroundColor: c.brandSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ ...typeScale.cuerpoDestacado, color: c.brandInk }}>{iniciales(user?.nombre, user?.apellido)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ ...typeScale.cuerpoDestacado, color: c.onTopBarStrong }}>
            {[user?.nombre, user?.apellido].filter(Boolean).join(' ') || 'Forward'}
          </Text>
          <Text numberOfLines={1} style={{ ...typeScale.secundario, color: c.onTopBar }}>
            {user?.roles?.join(' · ')}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingVertical: space[2], gap: isTablet ? space[1] : 0 }} showsVerticalScrollIndicator={false}>
        {grupos.map((g, i) => (
          <View key={g.title ?? `grupo-${i}`} style={{ gap: isTablet ? space[1] : 0 }}>
            {g.title ? (
              <Text
                accessibilityRole="header"
                style={{ ...typeScale.secundario, color: secundario, paddingHorizontal: isTablet ? space[3] : space[4], paddingTop: space[3], paddingBottom: space[1] }}
              >
                {g.title}
              </Text>
            ) : null}
            {g.items.map(fila)}
          </View>
        ))}
      </ScrollView>

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: isTablet ? c.textSecondary : c.border,
          paddingTop: space[2],
          paddingBottom: insets.bottom + space[2],
        }}
      >
        {fila(MI_CUENTA)}
      </View>
    </View>
  )
}
