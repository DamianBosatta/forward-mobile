import { Drawer } from 'expo-router/drawer'
import { Platform } from 'react-native'
import CustomDrawerContent from '@/src/components/layout/CustomDrawerContent'
import { useResponsive } from '@/libs/useResponsive'

export default function DrawerLayout() {
  // Plan §8: en tablet (≥ 600) el menú queda fijo; en teléfono se abre con el botón.
  const { isTablet } = useResponsive()

  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          backgroundColor: 'transparent',
          width: isTablet ? 240 : '80%', // 240: lámina TabInicio
        },
        drawerType: isTablet ? 'permanent' : (Platform.OS === 'ios' ? 'slide' : 'front'),
        swipeEdgeWidth: 100,
      }}
    >
      <Drawer.Screen name="index" />
      <Drawer.Screen name="ventas/index" />
      <Drawer.Screen name="inventario/index" />
      <Drawer.Screen name="compras/index" />
      <Drawer.Screen name="socios/index" />
      <Drawer.Screen name="autorizaciones/index" />
      <Drawer.Screen name="cuentas/index" />
      <Drawer.Screen name="tesoreria/index" />
      <Drawer.Screen name="calendario/index" />
      <Drawer.Screen name="avisos/index" />
      <Drawer.Screen name="reportes/index" />
      <Drawer.Screen name="logistica/index" />
      <Drawer.Screen name="logistica/consola" />

      {/* Rutas ocultas o secundarias (no aparecen en el drawer per se, pero se registran en el router) */}
      <Drawer.Screen name="perfil" />
      <Drawer.Screen name="tesoreria/transferencia" />
      <Drawer.Screen name="ventas/nueva" />
      <Drawer.Screen name="ventas/nueva-v2" />
      <Drawer.Screen name="compras/nueva" />
      <Drawer.Screen name="socios/nuevo" />
      <Drawer.Screen name="cuentas/[id]" />
      <Drawer.Screen name="cuentas/cobro" />
      <Drawer.Screen name="compras/[id]" />
      <Drawer.Screen name="autorizaciones/[id]" />
      <Drawer.Screen name="avisos/preferencias" />
    </Drawer>
  )
}
