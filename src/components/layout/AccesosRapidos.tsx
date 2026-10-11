import React from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { DrawerActions, useNavigation } from '@react-navigation/native'
import { House, Menu, ShoppingBag, Tag } from 'lucide-react-native'
import { useResponsive } from '@/libs/useResponsive'
import { usePermissions } from '@/core/auth/RequirePermission'
import { safeHaptics } from '@/core/utils/haptics'
import { puedeVerVentas } from './menuModules'
import { BottomBar, Fab, type BottomBarItem } from '@/core/ui/fw'

type Activa = 'inicio' | 'ventas' | 'compras'

/**
 * Barra inferior de accesos rápidos (lámina Main): Inicio, Ventas, "+" para una
 * venta nueva, Compras y Menú. Solo en teléfono: en tablet el menú está fijo.
 * Ventas pide lo mismo que el menú (leer ventas o pedidos, sin el chofer); el "+"
 * es contextual: en Compras crea una compra, en el resto una venta; Compras pide
 * leer compras.
 */
function AccesosRapidos({ activa }: { activa: Activa }) {
  const router = useRouter()
  const navigation = useNavigation()
  const { canDo } = usePermissions()
  const venta = canDo('MOD_VENTAS', 'create')
  const compra = canDo('MOD_COMPRAS', 'create')
  const nuevaCompra = activa === 'compras'

  const ir = (ruta: string) => () => {
    safeHaptics.impact('light')
    router.push(ruta as never)
  }

  const items: BottomBarItem[] = [
    { key: 'inicio', label: 'Inicio', icon: House, onPress: ir('/(tabs)/') },
    ...(puedeVerVentas(canDo) ? [{ key: 'ventas', label: 'Ventas', icon: Tag, onPress: ir('/(tabs)/ventas') }] : []),
    ...(canDo('MOD_COMPRAS', 'read') ? [{ key: 'compras', label: 'Compras', icon: ShoppingBag, onPress: ir('/(tabs)/compras') }] : []),
    { key: 'menu', label: 'Menú', icon: Menu, onPress: () => navigation.dispatch(DrawerActions.openDrawer()) },
  ]

  return (
    <BottomBar
      items={items}
      activeKey={activa}
      center={
        (nuevaCompra ? compra : venta) ? (
          <Fab
            accessibilityLabel={nuevaCompra ? 'Nueva compra' : 'Nueva venta'}
            onPress={ir(nuevaCompra ? '/(tabs)/compras/nueva' : '/(tabs)/ventas/nueva')}
            style={{ position: 'relative', right: 0, bottom: 0 }} />
        ) : undefined
      }
    />
  )
}

/** Envuelve una pantalla principal (Inicio, Ventas, Compras) y le suma la barra en teléfono. */
export function ConAccesosRapidos({ activa, children }: { activa: Activa; children: React.ReactNode }) {
  const { isTablet } = useResponsive()
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>{children}</View>
      {isTablet ? null : <AccesosRapidos activa={activa} />}
    </View>
  )
}
