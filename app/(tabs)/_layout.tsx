import { Drawer } from 'expo-router/drawer'
import { StyleSheet, Platform } from 'react-native'
import { useColors } from '../../libs/theme'
import CustomDrawerContent from '@/src/components/layout/CustomDrawerContent'
import { useResponsive } from '@/libs/useResponsive'

export default function DrawerLayout() {
  const colors = useColors()
  const { isLarge } = useResponsive()

  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          backgroundColor: 'transparent',
          width: isLarge ? 280 : '80%',
        },
        drawerType: isLarge ? 'permanent' : (Platform.OS === 'ios' ? 'slide' : 'front'),
        swipeEdgeWidth: 100,
      }}
    >
      <Drawer.Screen name="index" />
      <Drawer.Screen name="ventas/index" />
      <Drawer.Screen name="inventario/index" />
      <Drawer.Screen name="compras/index" />
      <Drawer.Screen name="usuarios/index" />
      <Drawer.Screen name="socios/index" />
      <Drawer.Screen name="cuentas/index" />
      <Drawer.Screen name="tesoreria/index" />
      <Drawer.Screen name="inventario/depositos/index" />
      <Drawer.Screen name="inventario/depositos/nuevo" />
      <Drawer.Screen name="logistica/index" />
      <Drawer.Screen name="logistica/consola" />

      {/* Logística — rutas secundarias (no aparecen en el drawer, se acceden desde el Hub) */}
      <Drawer.Screen name="logistica/picking" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="logistica/viajes" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="logistica/vehiculos" options={{ drawerItemStyle: { display: 'none' } }} />

      {/* Rutas ocultas o secundarias (no aparecen en el drawer per se, pero se registran en el router) */}
      <Drawer.Screen name="perfil" />
      <Drawer.Screen name="tesoreria/nueva" />
      <Drawer.Screen name="ventas/nueva" />
      <Drawer.Screen name="compras/nueva" />
      <Drawer.Screen name="inventario/nuevo" />
      <Drawer.Screen name="usuarios/nuevo" />
      <Drawer.Screen name="socios/nuevo" />
      <Drawer.Screen name="cuentas/nueva" />
      <Drawer.Screen name="cuentas/[id]" />
      <Drawer.Screen name="compras/[id]" />
      <Drawer.Screen name="inventario/editar/[id]" />
      <Drawer.Screen name="usuarios/[id]" />
    </Drawer>
  )
}
