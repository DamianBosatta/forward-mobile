import React from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native'
import { DrawerContentComponentProps, useDrawerStatus } from '@react-navigation/drawer'
import { useRouter } from 'expo-router'
import { useColors, useThemeStore } from '@/libs/theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LayoutDashboard, ShoppingCart, Package, Truck, ShoppingBag, Users, BookUser, Landmark, Wallet, LogOut, ChevronRight, MapPin, Settings, Activity, Navigation } from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Image } from 'expo-image'
import { safeHaptics } from '@/core/utils/haptics'
import { usePermissions } from '@/core/auth/RequirePermission'
import type { AppModule } from '@/libs/api-client/types'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useAuthStore } from '@/libs/store/auth.store'
import { MotiView, AnimatePresence } from 'moti'
import { BlurView } from 'expo-blur'

type ModuleItem = {
  id: string
  name: string
  icon: React.ElementType
  route: string
  color: string
  appModule?: AppModule
  /** Permission action required to see this item (default 'read'). Use 'create' to hide read-only users. */
  appAction?: 'read' | 'create' | 'update' | 'delete'
  requiredRoles?: string[]
}

const MODULES: { category: string, items: ModuleItem[] }[] = [
  {
    category: "Principal",
    items: [
      { id: 'panel', name: 'Panel Central', icon: LayoutDashboard, route: '/(tabs)/', color: '#00C19E' },
    ]
  },
  {
    category: "Operaciones",
    items: [
      // Gated by CREATE (not read): a chofer has MOD_VENTAS read-only (to view a parada's pedido) and
      // must NOT see the ventas module; a vendedor has create and does.
      { id: 'ventas', name: 'Ventas / Presupuestos', icon: ShoppingCart, route: '/(tabs)/ventas', color: '#3B82F6', appModule: 'MOD_VENTAS', appAction: 'create' },
      { id: 'compras', name: 'Compras', icon: ShoppingBag, route: '/(tabs)/compras', color: '#F59E0B', appModule: 'MOD_COMPRAS' },
      { id: 'consola', name: 'Consola del Chofer', icon: Navigation, route: '/(tabs)/logistica/consola', color: '#0EA5E9', appModule: 'MOD_VIAJES' },
      // Logistics management (create/assign hojas de ruta) is management-only — a chofer uses the consola, not this.
      { id: 'logistica', name: 'Gestión Logística', icon: MapPin, route: '/(tabs)/logistica', color: '#10B981', appModule: 'MOD_VIAJES', requiredRoles: ['Administrador', 'AdministradorSistemas', 'Gerencia'] },
    ]
  },
  {
    category: "Inventario",
    items: [
      // Stock view is READ-ONLY for the vendedor (MOD_STOCK:Read); create/edit/deactivate actions
      // inside the screen stay gated by RequirePermission. Depósitos (warehouse management) is management-only.
      { id: 'stock', name: 'Control de Stock', icon: Package, route: '/(tabs)/inventario', color: '#EC4899', appModule: 'MOD_STOCK' },
      { id: 'depositos', name: 'Depósitos', icon: MapPin, route: '/(tabs)/inventario/depositos', color: '#8B5CF6', appModule: 'MOD_STOCK', requiredRoles: ['Administrador', 'AdministradorSistemas', 'Gerencia'] },
    ]
  },
  {
    category: "Finanzas",
    items: [
      { id: 'tesoreria', name: 'Movimientos', icon: Wallet, route: '/(tabs)/tesoreria', color: '#10B981', appModule: 'MOD_PAGOS' },
      { id: 'cuentas', name: 'Cuentas Ctes.', icon: Landmark, route: '/(tabs)/cuentas', color: '#6366F1', appModule: 'MOD_CC' },
    ]
  },
  {
    category: "Administración",
    items: [
      { id: 'socios', name: 'Socios Comerciales', icon: BookUser, route: '/(tabs)/socios', color: '#14B8A6', appModule: 'MOD_CLIENTES' },
      { id: 'staff', name: 'Usuarios', icon: Users, route: '/(tabs)/usuarios', color: '#F43F5E', appModule: 'MOD_USUARIOS' },
    ]
  },
  {
    category: "Herramientas",
    items: [
      { id: 'stress', name: 'Asistente de Flujo', icon: Activity, route: '/debug/stress-test', color: '#A3E635', requiredRoles: ['AdministradorSistemas'] },
    ]
  }
]

export default function CustomDrawerContent(props: DrawerContentComponentProps) {
  const colors = useColors()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { mode } = useThemeStore()
  const isDark = mode === 'dark'

  const currentRoute = props.state.routeNames[props.state.index]
  const { canDo } = usePermissions()
  const { refreshPermissions, logout } = useAuth()
  const { isAuthenticated, user } = useAuthStore()
  const isDrawerOpen = useDrawerStatus() === 'open'

  React.useEffect(() => {
    if (isDrawerOpen && isAuthenticated) {
      refreshPermissions()
    }
  }, [isDrawerOpen, isAuthenticated])

  const s = StyleSheet.create({
    container: { 
      flex: 1, 
      backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)',
      overflow: 'hidden'
    },
    blur: {
      ...StyleSheet.absoluteFillObject,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: insets.top + 20,
      paddingBottom: 24,
    },
    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
      borderRadius: 24,
      padding: 16,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
      gap: 16
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 20,
      backgroundColor: colors.surface2,
      borderWidth: 2,
      borderColor: colors.primary,
      overflow: 'hidden'
    },
    headerText: {
      flex: 1,
    },
    title: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '900',
      fontFamily: 'Outfit_900Black',
      letterSpacing: -0.5
    },
    subtitle: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '800',
      fontFamily: 'Outfit_800ExtraBold',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginTop: 2
    },
    categoryTitle: {
      color: colors.textDisabled,
      fontSize: 10,
      fontWeight: '900',
      fontFamily: 'Outfit_900Black',
      letterSpacing: 2,
      textTransform: 'uppercase',
      marginTop: 24,
      marginBottom: 12,
      paddingHorizontal: 20
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 20,
      gap: 14,
      marginHorizontal: 12,
      borderRadius: 16,
    },
    itemActive: {
      backgroundColor: isDark ? 'rgba(0, 209, 193, 0.12)' : 'rgba(0, 209, 193, 0.08)',
    },
    itemText: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: colors.textMuted,
      fontFamily: 'Outfit_600SemiBold'
    },
    itemTextActive: {
      color: colors.primary,
      fontWeight: '800',
      fontFamily: 'Outfit_800ExtraBold'
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    },
    iconActive: {
      backgroundColor: colors.primary,
    },
    footer: {
      padding: 20,
      paddingBottom: insets.bottom + 20,
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    },
    logoutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(220, 38, 38, 0.05)',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(220, 38, 38, 0.2)',
    },
    logoutText: {
      color: colors.danger,
      fontSize: 14,
      fontWeight: '900',
      fontFamily: 'Outfit_900Black',
      letterSpacing: 0.5
    }
  })

  return (
    <View style={s.container}>
      <BlurView intensity={isDark ? 80 : 40} tint={isDark ? 'dark' : 'light'} style={s.blur} />
      
      {/* Header Info */}
      <View style={s.header}>
        <MotiView
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 500 }}
        >
          <TouchableOpacity style={s.profileCard} activeOpacity={0.8}>
            <View style={s.avatar}>
              <Image 
                source={{ uri: `https://ui-avatars.com/api/?name=${user?.nombre || 'User'}&background=0D8ABC&color=fff&bold=true&size=128` }} 
                style={{ width: '100%', height: '100%' }} 
                contentFit="cover"
              />
            </View>
            <View style={s.headerText}>
              <Text style={s.title} numberOfLines={1}>{user?.nombre || 'Forward ERP'}</Text>
              <Text style={s.subtitle} numberOfLines={1}>{user?.roles?.join(' • ') || 'USUARIO'}</Text>
            </View>
          </TouchableOpacity>
        </MotiView>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {MODULES.map((category, catIdx) => {
          // Hide items the user can't access; skip the whole category (incl. its title) if none remain.
          const visibleItems = category.items.filter(
            (it) =>
              !(it.requiredRoles && !it.requiredRoles.some(r => user?.roles?.includes(r as any))) &&
              !(it.appModule && !canDo(it.appModule, it.appAction ?? 'read'))
          )
          if (visibleItems.length === 0) return null
          return (
          <View key={`cat-${catIdx}`}>
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: catIdx * 100 }}
            >
              <Text style={s.categoryTitle}>{category.category}</Text>
            </MotiView>

            {visibleItems.map((item, itemIdx) => {
              const isActive = currentRoute === item.route.replace('/(tabs)/', '') ||
                               (item.route === '/(tabs)/' && currentRoute === 'index')

              return (
                <MotiView
                  key={item.id}
                  from={{ opacity: 0, translateX: -20 }}
                  animate={{ opacity: 1, translateX: 0 }}
                  transition={{ 
                    type: 'timing', 
                    duration: 400, 
                    delay: 200 + (catIdx * 100) + (itemIdx * 50) 
                  }}
                >
                  <TouchableOpacity
                    style={[s.item, isActive && s.itemActive]}
                    activeOpacity={0.7}
                    onPress={() => {
                      safeHaptics.impact('light')
                      // @ts-ignore
                      router.push(item.route)
                    }}
                  >
                    <View style={[s.iconContainer, isActive && s.iconActive]}>
                      <item.icon size={20} color={isActive ? '#FFFFFF' : item.color} />
                    </View>
                    <Text style={[s.itemText, isActive && s.itemTextActive]}>
                      {item.name}
                    </Text>
                    {isActive && (
                      <MotiView from={{ opacity: 0, translateX: -5 }} animate={{ opacity: 1, translateX: 0 }}>
                        <ChevronRight size={18} color={colors.primary} />
                      </MotiView>
                    )}
                  </TouchableOpacity>
                </MotiView>
              )
            })}
          </View>
          )
        })}
      </ScrollView>

      {/* Footer Actions */}
      <View style={s.footer}>
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 800 }}
        >
          <TouchableOpacity 
            style={s.logoutBtn}
            onPress={() => {
              safeHaptics.impact('medium')
              logout()
            }}
          >
            <LogOut size={20} color={colors.danger} />
            <Text style={s.logoutText}>Cerrar Sesión</Text>
          </TouchableOpacity>
        </MotiView>
      </View>
    </View>
  )
}

