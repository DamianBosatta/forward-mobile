import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter, useNavigation } from 'expo-router'
import { DrawerActions } from '@react-navigation/native'
import {
  Truck,
  Box,
  MapPin,
  ChevronRight,
  Calendar,
  User,
  Package,
  ClipboardList,
  Car,
  Navigation,
  MonitorSmartphone,
} from 'lucide-react-native'
import { ForwardLogo, TopHeaderActions, RequirePermission, GlassCard, BentoGrid, BentoItem } from '@/core/ui'
import { useColors, tokens, BRAND } from '@/libs/theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MotiView } from 'moti'
import { safeHaptics } from '@/core/utils/haptics'
import { useVentasEmpacadas, useInfiniteHojasDeRuta } from '@/libs/api-client/logistica'
import { useLogisticaStore } from '@/src/features/logistica/store/logistica.store'
import { useAuthStore } from '@/libs/store/auth.store'
import { usePermissions } from '@/src/core/auth/RequirePermission'
import { isMgmtRole } from '@/src/features/logistica/lib/rbac'
import { EstadoHojaRuta } from '@/libs/api-client/types'
import { DataList } from '@/core/ui/DataList'
import { RouteCardSkeleton } from '@/src/features/logistica/components/RouteCardSkeleton'
import { HubNavCard } from '@/src/features/logistica/components/hub/HubNavCard'
import { ActiveHojasList } from '@/src/features/logistica/components/hub/ActiveHojasList'
import React, { useMemo, useCallback, useEffect } from 'react'

export default function LogisticaScreen() {
  const navigation = useNavigation()
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const { user, canDo } = useAuthStore()
  const { roles } = usePermissions()
  const { activeTrip, clearActiveTrip } = useLogisticaStore()

  const isDriver = !!user?.roles?.includes('Empleado') && canDo('MOD_VIAJES', 'read')
  const isMgmt = isMgmtRole(roles)

  // A finished/cancelled trip persisted in AsyncStorage must not surface as an
  // "ongoing" shortcut — tapping it would drop the driver on the finalized summary.
  // Clear it proactively so the list resolves a fresh route.
  const isActiveTripClosed =
    activeTrip?.estado === EstadoHojaRuta.Finalizada ||
    activeTrip?.estado === EstadoHojaRuta.Cancelada

  useEffect(() => {
    if (isActiveTripClosed) clearActiveTrip()
  }, [isActiveTripClosed, clearActiveTrip])

  // Queries
  const { data: empacadas } = useVentasEmpacadas()
  const {
    data: routePages,
    isLoading,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteHojasDeRuta({
    choferId: isDriver ? user?.id : undefined,
    pageSize: 15
  })

  const rutas = useMemo(() => {
    // The /hojas-ruta endpoint returns a flat array in `data` (not a PagedResult),
    // and api.get already unwraps `data`, so each page IS the array. Support both
    // shapes so the list renders whether or not the endpoint ever becomes paginated.
    return routePages?.pages.flatMap(page => {
      const p = page as any
      return Array.isArray(p) ? p : (p?.content ?? p?.data?.content ?? p?.data ?? [])
    }) ?? []
  }, [routePages])

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  const getStatusDetails = (estado: number) => {
    switch (estado) {
      case EstadoHojaRuta.Programada:
        return { label: 'PROGRAMADA', color: BRAND.violet, bgColor: BRAND.violet + '15' }
      case EstadoHojaRuta.EnCurso:
        return { label: 'EN CURSO', color: colors.primary, bgColor: colors.primary + '15' }
      case EstadoHojaRuta.Finalizada:
        return { label: 'FINALIZADA', color: BRAND.green, bgColor: BRAND.green + '15' }
      case EstadoHojaRuta.Cancelada:
        return { label: 'CANCELADA', color: BRAND.red, bgColor: BRAND.red + '15' }
      default:
        return { label: 'DESCONOCIDO', color: colors.textDisabled, bgColor: colors.surface2 }
    }
  }

  const renderItem = useCallback(({ item: ruta }: { item: any }) => {
    const status = getStatusDetails(ruta.estado)
    const code = `HR-${ruta.id.substring(0, 8).toUpperCase()}`
    const dateStr = formatDate(ruta.fechaSalida)
    const paradasCount = ruta.detalles?.length || 0

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          safeHaptics.impact('medium')
          router.push({ pathname: '/(tabs)/logistica/consola', params: { id: ruta.id } })
        }}
        style={{ marginBottom: 14 }}
        accessibilityRole="button"
        accessibilityLabel={`Ver hoja de ruta ${code}`}
      >
        <GlassCard
          style={{
            padding: 0, overflow: 'hidden',
            borderColor: ruta.estado === EstadoHojaRuta.EnCurso ? colors.primary : colors.border,
            borderWidth: ruta.estado === EstadoHojaRuta.EnCurso ? 1.5 : 1,
            ...(ruta.estado === EstadoHojaRuta.EnCurso
              ? { shadowColor: colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6 }
              : {})
          }}
        >
          {/* accent stripe por estado */}
          <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: status.color }} />
          <View style={{ padding: 18, paddingLeft: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontFamily: 'Outfit_700Bold', fontWeight: '800', fontSize: 15, color: colors.text, letterSpacing: 0.5 }}>{code}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: status.bgColor, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: status.color }} />
                <Text style={{ fontSize: 10, fontWeight: '900', color: status.color, letterSpacing: 0.5 }}>{status.label}</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface2, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10 }}>
                <User size={14} color={colors.primary} />
                <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '700', flex: 1 }} numberOfLines={1}>{ruta.choferNombre || 'Sin chofer'}</Text>
              </View>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface2, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10 }}>
                <Truck size={14} color={colors.primary} />
                <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '700', flex: 1 }} numberOfLines={1}>{ruta.vehiculoPatente || 'Sin vehículo'}</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Calendar size={13} color={colors.textMuted} />
                <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: '600' }}>{dateStr}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MapPin size={13} color={colors.primary} />
                <Text style={{ fontSize: 13, color: colors.text, fontWeight: '900' }}>{paradasCount} paradas</Text>
              </View>
            </View>
          </View>
        </GlassCard>
      </TouchableOpacity>
    )
  }, [colors, router])

  const headerComponent = useMemo(() => (
    <View style={{ marginBottom: 20 }}>
      {/* ── Header ── */}
      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        style={{ marginBottom: tokens.spacing.xl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <TouchableOpacity
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
            style={{
              width: 52, height: 52, borderRadius: tokens.radius.lg,
              backgroundColor: colors.surface,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: colors.border
            }}
          >
            <ForwardLogo size={36} showText={false} />
          </TouchableOpacity>
          <View>
            <Text style={{ fontSize: 24, fontWeight: '900', color: colors.text, letterSpacing: -1.2 }}>LOGÍSTICA</Text>
            <View style={styles.statusRow}>
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              <Text style={styles.statusText}>CONSOLA DE FLOTA</Text>
            </View>
          </View>
        </View>
        <TopHeaderActions />
      </MotiView>

      {/* ── Active trip banner — elevated above the KPIs so an in-progress trip is seen first ── */}
      {activeTrip && !isActiveTripClosed && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => router.push('/(tabs)/logistica/consola')}
          style={{ marginTop: tokens.spacing.lg }}
        >
          <GlassCard style={[styles.activeTripCard, { borderColor: colors.primary, overflow: 'hidden', shadowColor: colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 18, elevation: 8 }]}>
            <LinearGradient
              colors={[colors.primary + '22', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
            <LinearGradient
              colors={[colors.primary, BRAND.lime]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.iconCircle}
            >
              <Truck size={32} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.primary, fontWeight: '900', fontSize: 12, letterSpacing: 1 }}>VIAJE EN CURSO</Text>
              <Text style={{ color: colors.text, fontWeight: '900', fontSize: 20 }}>Consola del Chofer</Text>
            </View>
            <ChevronRight size={24} color={colors.primary} />
          </GlassCard>
        </TouchableOpacity>
      )}

      {/* ── KPI Bento ── */}
      <BentoGrid>
        <BentoItem span={1}>
          <GlassCard style={{ padding: 16, minHeight: 116, justifyContent: 'space-between', overflow: 'hidden' }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary + '1A', alignItems: 'center', justifyContent: 'center' }}>
              <Box size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={{ fontSize: 28, fontWeight: '900', color: colors.text }}>{empacadas?.length || 0}</Text>
              <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>Empacados</Text>
            </View>
            <View style={{ position: 'absolute', bottom: 0, left: 0, height: 3, width: '45%', backgroundColor: colors.primary, borderTopRightRadius: 2 }} />
          </GlassCard>
        </BentoItem>
        <BentoItem span={1}>
          <GlassCard style={{ padding: 16, minHeight: 116, justifyContent: 'space-between', overflow: 'hidden' }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.info + '1A', alignItems: 'center', justifyContent: 'center' }}>
              <Truck size={20} color={colors.info} />
            </View>
            <View>
              <Text style={{ fontSize: 28, fontWeight: '900', color: colors.text }}>
                {rutas.filter(r => r.estado === EstadoHojaRuta.EnCurso).length}
              </Text>
              <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>En Tránsito</Text>
            </View>
            <View style={{ position: 'absolute', bottom: 0, left: 0, height: 3, width: '45%', backgroundColor: colors.info, borderTopRightRadius: 2 }} />
          </GlassCard>
        </BentoItem>
      </BentoGrid>

      {/* ── Pedidos quick link (existing) ── */}
      <RequirePermission module="MOD_VIAJES" action="read">
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            safeHaptics.impact('light')
            router.push('/(tabs)/logistica/pedidos')
          }}
          style={{ marginTop: tokens.spacing.md }}
        >
          <GlassCard style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: BRAND.violet + '20', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={22} color={BRAND.violet} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '900', color: colors.text }}>PEDIDOS</Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>Estado de órdenes</Text>
            </View>
            <ChevronRight size={20} color={colors.textMuted} />
          </GlassCard>
        </TouchableOpacity>
      </RequirePermission>

      {/* ── Hub Nav Cards (RBAC-gated) ── */}
      <Text style={[styles.sectionTitle, { marginTop: tokens.spacing.xl }]}>Accesos rápidos</Text>

      {/* Picking — any MOD_VIAJES:read holder */}
      <HubNavCard
        title="Picking"
        subtitle="Tablero de preparación de órdenes"
        icon={ClipboardList}
        iconColor={colors.primary}
        onPress={() => router.push('/(tabs)/logistica/picking')}
        visible
      />

      {/* Consola — any MOD_VIAJES:read holder */}
      <HubNavCard
        title="Consola"
        subtitle="Panel del chofer"
        icon={MonitorSmartphone}
        iconColor={BRAND.green}
        onPress={() => router.push('/(tabs)/logistica/consola')}
        visible
      />

      {/* Vehículos — management only */}
      <HubNavCard
        title="Vehículos"
        subtitle="ABM de la flota"
        icon={Car}
        iconColor={BRAND.violet}
        onPress={() => router.push('/(tabs)/logistica/vehiculos')}
        visible={isMgmt}
      />

      {/* Planificar Viaje — management only */}
      <HubNavCard
        title="Planificar Viaje"
        subtitle="Wizard de hoja de ruta"
        icon={Navigation}
        iconColor={colors.info}
        onPress={() => router.push('/(tabs)/logistica/viajes')}
        visible={isMgmt}
      />

      {/* ── Active Hojas de Ruta overview ── */}
      <Text style={[styles.sectionTitle, { marginTop: tokens.spacing.xl }]}>Viajes en curso</Text>
      <ActiveHojasList />

      {/* ── Full fleet list section title ── */}
      <Text style={styles.sectionTitle}>
        {isDriver ? 'Mis Viajes Asignados' : 'Hojas de Ruta de la Flota'}
      </Text>
    </View>
  ), [empacadas?.length, rutas, activeTrip, isActiveTripClosed, colors, isDriver, isMgmt, router, navigation])

  return (
    <RequirePermission module="MOD_VIAJES" action="read" mode="screen">
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <DataList
          data={rutas}
          renderItem={renderItem}
          estimatedItemSize={180}
          ListHeaderComponent={headerComponent}
          contentContainerStyle={{
            paddingTop: insets.top + tokens.spacing.md,
            paddingHorizontal: tokens.spacing.md,
            paddingBottom: 150
          }}
          isLoading={isLoading}
          isRefetching={isRefetching}
          onRefresh={refetch}
          onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
          isFetchingNextPage={isFetchingNextPage}
          SkeletonComponent={RouteCardSkeleton}
          skeletonCount={3}
          emptyMessage="No hay hojas de ruta disponibles."
        />
      </View>
    </RequirePermission>
  )
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { fontSize: 10, fontWeight: '700', color: '#888', letterSpacing: 0.5 },
  activeTripCard: { padding: 20, backgroundColor: 'rgba(0, 209, 193, 0.1)', borderWidth: 2, flexDirection: 'row', alignItems: 'center', gap: 20 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 13, fontWeight: '900', color: '#888', marginTop: 32, marginBottom: 16, letterSpacing: 1.5, textTransform: 'uppercase' }
})
