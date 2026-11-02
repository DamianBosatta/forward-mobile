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
      {/* Secciones con su propio Stack (audit A-05): el cajón ve una ruta por carpeta y las pantallas internas
          (nueva, [id], stock...) viven en el Stack de la sección, así "volver" regresa a la pantalla anterior. */}
      <Drawer.Screen name="ventas" />
      <Drawer.Screen name="inventario" />
      <Drawer.Screen name="compras" />
      <Drawer.Screen name="proveedores" />
      <Drawer.Screen name="socios" />
      <Drawer.Screen name="autorizaciones" />
      <Drawer.Screen name="cuentas" />
      <Drawer.Screen name="tesoreria" />
      <Drawer.Screen name="avisos" />
      <Drawer.Screen name="logistica" />
      <Drawer.Screen name="calendario/index" />
      <Drawer.Screen name="reportes/index" />

      {/* Rutas ocultas o secundarias (no aparecen en el drawer per se, pero se registran en el router) */}
      <Drawer.Screen name="perfil" />
      <Drawer.Screen name="perfil/clave" />
      <Drawer.Screen name="perfil/usuarios" />
    </Drawer>
  )
}
