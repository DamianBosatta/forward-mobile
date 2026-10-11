import { DrawerActions, useNavigation } from '@react-navigation/native'
import { useResponsive } from '@/libs/useResponsive'

/**
 * Botón de menú para la barra superior (TopBar `leading`). En teléfono el menú
 * lateral se abre con este botón; en tablet el menú está fijo a la izquierda,
 * así que no hay botón.
 */
export function useMenuLeading(): { kind: 'menu'; onPress: () => void } | undefined {
  const navigation = useNavigation()
  const { isTablet } = useResponsive()
  if (isTablet) return undefined
  return { kind: 'menu', onPress: () => navigation.dispatch(DrawerActions.openDrawer()) }
}
