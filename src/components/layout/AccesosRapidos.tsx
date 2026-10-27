import React from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { Banknote, FileText, House, User } from 'lucide-react-native'
import { useResponsive } from '@/libs/useResponsive'
import { usePermissions } from '@/core/auth/RequirePermission'
import { safeHaptics } from '@/core/utils/haptics'
import { puedeVerVentas } from './menuModules'
import { BottomBar, type BottomBarItem } from '@/core/ui/fw'

type Activa = 'inicio' | 'ventas' | 'compras' | 'clientes' | 'cobros'

/**
 * Barra inferior de accesos rápidos (lámina CalleMiDia, D2): Mi día, Ventas, Clientes y Cobros.
 * Solo en teléfono: en tablet el menú está fijo. Cada acceso pide lo mismo que su entrada del menú
 * lateral (Ventas: leer ventas o pedidos, sin el chofer; Clientes: MOD_CLIENTES; Cobros, que abre
 * las cuentas corrientes: MOD_CC). Lo demás (nueva venta, nueva compra, menú) está en cada pantalla.
 */
function AccesosRapidos({ activa }: { activa: Activa }) {
  const router = useRouter()
  const { canDo } = usePermissions()

  const ir = (ruta: string) => () => {
    safeHaptics.impact('light')
    router.push(ruta as never)
  }

  const items: BottomBarItem[] = [
    { key: 'inicio', label: 'Mi día', icon: House, onPress: ir('/(tabs)/') },
    ...(puedeVerVentas(canDo) ? [{ key: 'ventas', label: 'Ventas', icon: FileText, onPress: ir('/(tabs)/ventas') }] : []),
    ...(canDo('MOD_CLIENTES', 'read') ? [{ key: 'clientes', label: 'Clientes', icon: User, onPress: ir('/(tabs)/socios') }] : []),
    ...(canDo('MOD_CC', 'read') ? [{ key: 'cobros', label: 'Cobros', icon: Banknote, onPress: ir('/(tabs)/cuentas') }] : []),
  ]

  return <BottomBar items={items} activeKey={activa} />
}

/** Envuelve una pantalla principal (Inicio, Ventas, Clientes, Cobros, Compras) y le suma la barra en teléfono. */
export function ConAccesosRapidos({ activa, children }: { activa: Activa; children: React.ReactNode }) {
  const { isTablet } = useResponsive()
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>{children}</View>
      {isTablet ? null : <AccesosRapidos activa={activa} />}
    </View>
  )
}
