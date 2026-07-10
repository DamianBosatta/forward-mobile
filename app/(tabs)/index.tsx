import { safeHaptics } from '@/core/utils/haptics'
;
import { useState, useCallback } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet } from 'react-native'
import { useAuthStore } from '../../libs/store/auth.store'
import { useKpiDashboard } from '../../libs/api-client'
import { KpiCardMobile, BentoGrid, BentoItem, GlassCard, AuroraGlow } from '@/core/ui'
import { DollarSign, Package, ShoppingCart, Activity, TrendingUp, Users, Shield, LayoutGrid } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Link, useNavigation } from 'expo-router'
import { DrawerActions } from '@react-navigation/native';
import { useColors, useIsDark, tokens } from '../../libs/theme'
import { ForwardLogo, TopHeaderActions } from '@/core/ui'
import { MotiView, MotiText } from 'moti'
import { FadeInDown } from 'react-native-reanimated'
import { VendedorDashboard } from '@/features/ventas/components/VendedorDashboard'
import { ChoferDashboard } from '@/features/logistica/components/ChoferDashboard'

export default function DashboardScreen() {
  const navigation = useNavigation();
  const { user, isAdmin, isSuperAdmin, canDo } = useAuthStore()
  const { data: kpis, isLoading, refetch } = useKpiDashboard()
  const colors = useColors()
  const isDark = useIsDark()
  const insets = useSafeAreaInsets()

  const [refreshing, setRefreshing] = useState(false)

  // IMPORTANT: every hook must run before any conditional return, otherwise React throws
  // "Rendered fewer hooks than expected" when the role changes (e.g. on logout) and the
  // branch flips. So onRefresh is declared here, BEFORE the role-based early return below.
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  // Route non-admin users to their role-specific dashboard (after all hooks).
  if (!isAdmin() && !isSuperAdmin()) {
    // A chofer reads ventas (to view a parada's pedido detail) but cannot CREATE them — that's
    // what distinguishes them from a vendedor (who has MOD_VENTAS create).
    const isChofer = canDo('MOD_VIAJES', 'read') && !canDo('MOD_VENTAS', 'create')
    if (isChofer) return <ChoferDashboard />
    return <VendedorDashboard />
  }

  const formatCurrency = (val?: number | null) =>
    val != null
      ? `$${val.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
      : '$0'

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AuroraGlow />

      <ScrollView
        contentContainerStyle={{ 
          paddingTop: insets.top + tokens.spacing.md, 
          paddingHorizontal: tokens.spacing.md, 
          paddingBottom: 120 
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing || isLoading} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* ── Header Premium ── */}
        <MotiView 
          from={{ opacity: 0, translateY: -20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 600 }}
          style={{ marginBottom: 32, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <TouchableOpacity 
              onPress={() => { 
                safeHaptics.impact('light'); 
                navigation.dispatch(DrawerActions.openDrawer()); 
              }}
              activeOpacity={0.7}
              style={{ 
                width: 54, height: 54, borderRadius: 18, 
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', 
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              }}
            >
              <ForwardLogo size={36} showText={false} />
            </TouchableOpacity>
            <View>
              <MotiText 
                from={{ opacity: 0, translateX: -10 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ delay: 200 }}
                style={{ 
                  fontSize: 22, 
                  fontWeight: '900', 
                  color: colors.text, 
                  letterSpacing: -1,
                  fontFamily: 'Outfit_900Black'
                }}
              >
                PANEL CENTRAL
              </MotiText>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                <MotiView 
                  from={{ opacity: 0.4, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ loop: true, type: 'timing', duration: 1500, repeatReverse: true }}
                  style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success, marginRight: 6 }} 
                />
                <Text style={{ 
                  fontSize: 12, 
                  fontWeight: '700', 
                  color: colors.textMuted, 
                  letterSpacing: 0.5,
                  fontFamily: 'Outfit_700Bold'
                }}>
                  ONLINE: {user?.nombre?.split(' ')[0]?.toUpperCase() || 'OPERADOR'}
                </Text>
              </View>
            </View>
          </View>
          <TopHeaderActions />
        </MotiView>

        {/* ── Métricas Operativas ── */}
        <MotiView
          from={{ opacity: 0, translateX: -10 }}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ delay: 300 }}
          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginLeft: 4 }}
        >
          <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
            <Activity size={8} color={colors.primary} />
          </View>
          <Text style={{ 
            color: colors.textDisabled, 
            fontSize: 10, 
            fontWeight: '900', 
            textTransform: 'uppercase', 
            letterSpacing: 1.5,
            fontFamily: 'Outfit_900Black'
          }}>
            Métricas de Rendimiento
          </Text>
        </MotiView>

        <BentoGrid>
          <BentoItem span={2}>
            <KpiCardMobile
              label="VENTAS DEL DÍA"
              value={kpis ? formatCurrency(kpis.salesToday) : '$0'}
              sub={`${kpis?.pendingOrders ?? 0} PEDIDOS PENDIENTES`}
              accent={colors.primary}
              icon={<TrendingUp size={20} color={colors.primary} />}
              index={1}
            />
          </BentoItem>

          <BentoItem span={1}>
            <KpiCardMobile
              label="RUTAS ACTIVAS"
              value={(kpis?.activeRoutes ?? 0).toString()}
              sub="EN DISTRIBUCIÓN"
              accent="#a855f7"
              icon={<Activity size={18} color="#a855f7" />}
              index={2}
            />
          </BentoItem>

          <BentoItem span={1}>
            <KpiCardMobile
              label="STOCK CRÍTICO"
              value={(kpis?.lowStockAlerts ?? 0).toString()}
              sub="BAJO MÍNIMO"
              accent={(kpis?.lowStockAlerts ?? 0) > 0 ? colors.danger : colors.success}
              icon={<Package size={18} color={(kpis?.lowStockAlerts ?? 0) > 0 ? colors.danger : colors.success} />}
              index={3}
            />
          </BentoItem>

          <BentoItem span={2}>
            <KpiCardMobile
              label="PEDIDOS PENDIENTES"
              value={(kpis?.pendingOrders ?? 0).toString()}
              sub="REQUIEREN ATENCIÓN"
              accent="#f59e0b"
              icon={<ShoppingCart size={20} color="#f59e0b" />}
              index={4}
            />
          </BentoItem>
        </BentoGrid>

        {/* ── Accesos Rápidos ── */}
        <MotiView
          from={{ opacity: 0, translateX: -10 }}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ delay: 600 }}
          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginLeft: 4, marginTop: 32 }}
        >
          <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: colors.secondary + '20', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
            <LayoutGrid size={8} color={colors.secondary} />
          </View>
          <Text style={{ 
            color: colors.textDisabled, 
            fontSize: 10, 
            fontWeight: '900', 
            textTransform: 'uppercase', 
            letterSpacing: 1.5,
            fontFamily: 'Outfit_900Black'
          }}>
            Accesos Inteligentes
          </Text>
        </MotiView>

        <MotiView 
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 800 }}
          style={{ flexDirection: 'row', gap: 12 }}
        >
          <Link href="/(tabs)/ventas" asChild>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.8}>
              <GlassCard intensity={12} style={{ padding: 20, alignItems: 'center', borderRadius: 24 }}>
                <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.primary + '10', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <ShoppingCart size={24} color={colors.primary} />
                </View>
                <Text style={{ color: colors.text, fontSize: 11, fontWeight: '900', letterSpacing: 0.5, fontFamily: 'Outfit_900Black' }}>VENTAS</Text>
              </GlassCard>
            </TouchableOpacity>
          </Link>
          <Link href="/(tabs)/inventario" asChild>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.8}>
              <GlassCard intensity={12} style={{ padding: 20, alignItems: 'center', borderRadius: 24 }}>
                <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.secondary + '10', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Package size={24} color={colors.secondary} />
                </View>
                <Text style={{ color: colors.text, fontSize: 11, fontWeight: '900', letterSpacing: 0.5, fontFamily: 'Outfit_900Black' }}>STOCK</Text>
              </GlassCard>
            </TouchableOpacity>
          </Link>
        </MotiView>

        {/* ── Footer Branding ── */}
        <MotiView 
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 0.5, scale: 1 }}
          transition={{ delay: 1200 }}
          style={{ marginTop: 100, alignItems: 'center' }}
        >
          <ForwardLogo size={24} showText={false} />
          <Text style={{ color: colors.text, fontSize: 10, fontWeight: '900', letterSpacing: 2, marginTop: 12, textTransform: 'uppercase', fontFamily: 'Outfit_900Black' }}>
            Forward Premium v3.5
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 8, fontWeight: '700', letterSpacing: 1, marginTop: 4, fontFamily: 'Outfit_700Bold' }}>
            SISTEMA DE GESTIÓN EMPRESARIAL
          </Text>
        </MotiView>
      </ScrollView>
    </View>
  )
}


