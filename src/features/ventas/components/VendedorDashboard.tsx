import React, { useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { useColors, tokens, BRAND } from '@/libs/theme'
import { KpiCardMobile, BentoGrid, BentoItem, GlassCard, Skeleton } from '@/core/ui'
import { useVentas, useVentasResumen } from '@/libs/api-client/ventas'
import { TrendingUp, ShoppingCart, Users, Clock, CheckCircle2, ReceiptText, ChevronRight } from 'lucide-react-native'
import { MotiView } from 'moti'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { safeHaptics } from '@/core/utils/haptics'
import { ForwardLogo, TopHeaderActions } from '@/core/ui'
import { useNavigation } from 'expo-router'
import { DrawerActions } from '@react-navigation/native'
import type { Venta } from '@/libs/api-client/types'

// ─── Date helpers ─────────────────────────────────────────────────────────────

function firstDayOfMonth(): string {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function today(): string {
  return new Date().toISOString()
}

function thirtyDaysAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function formatCurrency(val?: number | null) {
  if (val == null) return '$0'
  return `$${val.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
}

function shortDate(isoDate?: string | null): string {
  if (!isoDate) return '—'
  const d = new Date(isoDate)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

function dayKey(isoDate?: string | null): string {
  if (!isoDate) return 'unknown'
  return new Date(isoDate).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────

interface DayBar {
  label: string
  total: number
}

function BarChart({ data }: { data: DayBar[] }) {
  const colors = useColors()
  const maxVal = Math.max(...data.map(d => d.total), 1)
  const BAR_MAX_HEIGHT = 80
  const hasData = data.some(d => d.total > 0)

  if (!hasData) {
    return (
      <View style={{ height: BAR_MAX_HEIGHT + 24, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.textMuted, fontSize: 12, fontFamily: 'Outfit_600SemiBold' }}>
          Sin ventas en los últimos 14 días
        </Text>
      </View>
    )
  }

  const lastIdx = data.length - 1

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: BAR_MAX_HEIGHT + 22 }}>
      {data.map((bar, i) => {
        const ratio = bar.total / maxVal
        const isEmpty = bar.total <= 0
        // Empty days render a faint baseline stub; sale days scale up and stand out.
        const barH = isEmpty ? 3 : Math.max(8, ratio * BAR_MAX_HEIGHT)
        // Show only a few labels (first, middle, last) to avoid clutter with 14 columns.
        const showLabel = i === 0 || i === lastIdx || i === Math.floor(lastIdx / 2)
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
            <View
              style={{
                width: '100%',
                height: barH,
                borderRadius: 3,
                backgroundColor: isEmpty ? colors.textDisabled + '30' : colors.primary,
                opacity: isEmpty ? 1 : 0.6 + 0.4 * ratio,
              }}
            />
            <Text
              style={{
                fontSize: 8,
                color: colors.textDisabled,
                fontFamily: 'Outfit_700Bold',
                marginTop: 6,
                textAlign: 'center',
                minHeight: 11,
              }}
              numberOfLines={1}
            >
              {showLabel ? bar.label : ''}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function VentaRowSkeleton() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 }}>
      <Skeleton width={36} height={36} borderRadius={10} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width="70%" height={12} />
        <Skeleton width="40%" height={10} />
      </View>
      <Skeleton width={60} height={14} />
    </View>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VendedorDashboard() {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const navigation = useNavigation()

  // Memoize once per mount. today() returns a millisecond-precision ISO string that
  // changes on every render — without memoization the query keys change each render,
  // causing react-query to refetch forever (infinite "loading" + blank dashboard).
  const { fechaDesde, fechaHasta, fecha30d } = useMemo(
    () => ({
      fechaDesde: firstDayOfMonth(),
      fechaHasta: today(),
      fecha30d: thirtyDaysAgo(),
    }),
    [],
  )

  // Resumen del mes (totales, pendientes, entregadas)
  const { data: resumen, isLoading: resumenLoading, refetch: refetchResumen } = useVentasResumen({
    fechaDesde,
    fechaHasta,
  })

  // Ventas del mes — pageSize 200 for KPI count + distinct-client computation
  const { data: ventasMes, isLoading: ventasMesLoading, refetch: refetchMes } = useVentas({
    fechaDesde,
    fechaHasta,
    pageSize: 200,
  })

  // Last 30 days for the bar chart
  const { data: ventas30d, isLoading: ventas30dLoading, refetch: refetch30d } = useVentas({
    fechaDesde: fecha30d,
    fechaHasta,
    pageSize: 200,
  })

  // 5 most recent ventas
  const { data: recentVentas, isLoading: recentLoading, refetch: refetchRecent } = useVentas({
    pageSize: 5,
    pageNumber: 1,
  })

  // ── Derived KPIs ──────────────────────────────────────────────────────────

  const totalVendido = resumen?.totalVendido ?? 0
  const ventasCount = ventasMes?.totalCount ?? 0
  const ticketPromedio = ventasCount > 0 ? totalVendido / ventasCount : 0
  const pendientes = resumen?.pendientes ?? 0
  const entregadas = resumen?.entregadas ?? 0

  const clientesAtendidos = useMemo(() => {
    const items = ventasMes?.items ?? []
    const ids = new Set(items.map((v: Venta) => v.clienteId).filter(Boolean))
    return ids.size
  }, [ventasMes])

  // ── Bar chart data ────────────────────────────────────────────────────────

  const barData: DayBar[] = useMemo(() => {
    const items = ventas30d?.items ?? []
    const map = new Map<string, number>()
    for (const v of items) {
      if (!v.fecha) continue
      map.set(dayKey(v.fecha), (map.get(dayKey(v.fecha)) ?? 0) + (v.totalAmount ?? 0))
    }
    // Enumerate the last 14 calendar days ending today so the chart always renders a full axis
    // (days without sales show a tiny baseline) instead of collapsing into one giant full-width
    // block when there's only a single day of sales.
    const DAYS = 14
    const bars: DayBar[] = []
    const cursor = new Date(fechaHasta)
    cursor.setHours(0, 0, 0, 0)
    cursor.setDate(cursor.getDate() - (DAYS - 1))
    for (let i = 0; i < DAYS; i++) {
      bars.push({
        label: cursor.toLocaleDateString('es-AR', { day: '2-digit' }),
        total: map.get(dayKey(cursor.toISOString())) ?? 0,
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    return bars
  }, [ventas30d, fechaHasta])

  // ── Pull-to-refresh ───────────────────────────────────────────────────────

  const [refreshing, setRefreshing] = React.useState(false)

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true)
    await Promise.all([refetchResumen(), refetchMes(), refetch30d(), refetchRecent()])
    setRefreshing(false)
  }, [refetchResumen, refetchMes, refetch30d, refetchRecent])

  const isInitialLoading = resumenLoading || ventasMesLoading

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + tokens.spacing.md,
          paddingHorizontal: tokens.spacing.md,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── Header ── */}
        <MotiView
          from={{ opacity: 0, translateY: -20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 600 }}
          style={{
            marginBottom: 32,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <TouchableOpacity
              onPress={() => {
                safeHaptics.impact('light')
                navigation.dispatch(DrawerActions.openDrawer())
              }}
              activeOpacity={0.7}
              style={{
                width: 54,
                height: 54,
                borderRadius: 18,
                backgroundColor: colors.surface2,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <ForwardLogo size={36} showText={false} />
            </TouchableOpacity>
            <View>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: '900',
                  color: colors.text,
                  letterSpacing: -1,
                  fontFamily: 'Outfit_900Black',
                }}
              >
                MI PANEL
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                <MotiView
                  from={{ opacity: 0.4, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ loop: true, type: 'timing', duration: 1500, repeatReverse: true }}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: colors.success,
                    marginRight: 6,
                  }}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: colors.textMuted,
                    letterSpacing: 0.5,
                    fontFamily: 'Outfit_700Bold',
                  }}
                >
                  VENDEDOR
                </Text>
              </View>
            </View>
          </View>
          <TopHeaderActions />
        </MotiView>

        {/* ── Section label ── */}
        <MotiView
          from={{ opacity: 0, translateX: -10 }}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ delay: 200 }}
          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginLeft: 4 }}
        >
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 4,
              backgroundColor: colors.primary + '20',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
            }}
          >
            <TrendingUp size={8} color={colors.primary} />
          </View>
          <Text
            style={{
              color: colors.textDisabled,
              fontSize: 10,
              fontWeight: '900',
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              fontFamily: 'Outfit_900Black',
            }}
          >
            Mes en curso
          </Text>
        </MotiView>

        {/* ── KPI Grid ── */}
        <BentoGrid>
          {/* Vendido del mes — full width */}
          <BentoItem span={2}>
            {isInitialLoading ? (
              <Skeleton width="100%" height={120} borderRadius={24} />
            ) : (
              <KpiCardMobile
                label="VENDIDO DEL MES"
                value={formatCurrency(totalVendido)}
                sub={
                  ventasCount === 0
                    ? 'SIN VENTAS ESTE MES'
                    : `${ventasCount} ${ventasCount === 1 ? 'VENTA' : 'VENTAS'}`
                }
                accent={colors.primary}
                icon={<TrendingUp size={20} color={colors.primary} />}
                index={1}
              />
            )}
          </BentoItem>

          {/* Ticket promedio */}
          <BentoItem span={1}>
            {isInitialLoading ? (
              <Skeleton width="100%" height={100} borderRadius={24} />
            ) : (
              <KpiCardMobile
                label="TICKET PROM."
                value={formatCurrency(ticketPromedio)}
                sub="POR VENTA"
                accent={BRAND.violet}
                icon={<ReceiptText size={18} color={BRAND.violet} />}
                index={2}
              />
            )}
          </BentoItem>

          {/* Clientes atendidos */}
          <BentoItem span={1}>
            {isInitialLoading ? (
              <Skeleton width="100%" height={100} borderRadius={24} />
            ) : (
              <KpiCardMobile
                label="CLIENTES"
                value={clientesAtendidos.toString()}
                sub="ATENDIDOS"
                accent={BRAND.blue}
                icon={<Users size={18} color={BRAND.blue} />}
                index={3}
              />
            )}
          </BentoItem>

          {/* Pendientes */}
          <BentoItem span={1}>
            {isInitialLoading ? (
              <Skeleton width="100%" height={100} borderRadius={24} />
            ) : (
              <KpiCardMobile
                label="PENDIENTES"
                value={pendientes.toString()}
                sub="POR ENTREGAR"
                accent={BRAND.orange}
                icon={<Clock size={18} color={BRAND.orange} />}
                index={4}
              />
            )}
          </BentoItem>

          {/* Entregadas */}
          <BentoItem span={1}>
            {isInitialLoading ? (
              <Skeleton width="100%" height={100} borderRadius={24} />
            ) : (
              <KpiCardMobile
                label="ENTREGADAS"
                value={entregadas.toString()}
                sub="DEL MES"
                accent={colors.success}
                icon={<CheckCircle2 size={18} color={colors.success} />}
                index={5}
              />
            )}
          </BentoItem>
        </BentoGrid>

        {/* ── Bar chart ── */}
        <MotiView
          from={{ opacity: 0, translateX: -10 }}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ delay: 500 }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 16,
            marginLeft: 4,
            marginTop: 32,
          }}
        >
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 4,
              backgroundColor: BRAND.violet + '30',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
            }}
          >
            <TrendingUp size={8} color={BRAND.violet} />
          </View>
          <Text
            style={{
              color: colors.textDisabled,
              fontSize: 10,
              fontWeight: '900',
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              fontFamily: 'Outfit_900Black',
            }}
          >
            Ventas últimos 30 días
          </Text>
        </MotiView>

        <GlassCard intensity={10} style={{ padding: tokens.spacing.md, borderRadius: 24 }}>
          {ventas30dLoading ? (
            <Skeleton width="100%" height={104} borderRadius={12} />
          ) : (
            <BarChart data={barData} />
          )}
        </GlassCard>

        {/* ── Últimas ventas ── */}
        <MotiView
          from={{ opacity: 0, translateX: -10 }}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ delay: 700 }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 16,
            marginLeft: 4,
            marginTop: 32,
          }}
        >
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 4,
              backgroundColor: BRAND.blue + '30',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
            }}
          >
            <ShoppingCart size={8} color={BRAND.blue} />
          </View>
          <Text
            style={{
              color: colors.textDisabled,
              fontSize: 10,
              fontWeight: '900',
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              fontFamily: 'Outfit_900Black',
            }}
          >
            Últimas ventas
          </Text>
        </MotiView>

        <GlassCard intensity={10} style={{ borderRadius: 24, overflow: 'hidden' }}>
          {recentLoading ? (
            <View style={{ padding: tokens.spacing.md, gap: 4 }}>
              {[1, 2, 3, 4, 5].map(i => (
                <VentaRowSkeleton key={i} />
              ))}
            </View>
          ) : !recentVentas?.items?.length ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: 13,
                  fontFamily: 'Outfit_600SemiBold',
                  textAlign: 'center',
                }}
              >
                Todavía no registraste ventas este mes
              </Text>
            </View>
          ) : (
            <View style={{ padding: tokens.spacing.md }}>
              {recentVentas.items.map((venta: Venta, i: number) => (
                <TouchableOpacity
                  key={venta.id}
                  activeOpacity={0.7}
                  onPress={() => {
                    safeHaptics.impact('light')
                    // @ts-ignore — expo-router dynamic route
                    router.push(`/(tabs)/ventas/${venta.id}`)
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 10,
                    gap: 12,
                    borderBottomWidth: i < (recentVentas.items?.length ?? 0) - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: colors.primary + '15',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ShoppingCart size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 13,
                        fontFamily: 'Outfit_700Bold',
                        fontWeight: '700',
                      }}
                      numberOfLines={1}
                    >
                      {venta.razonSocialCliente ?? 'Cliente'}
                    </Text>
                    <Text
                      style={{
                        color: colors.textMuted,
                        fontSize: 11,
                        fontFamily: 'Outfit_600SemiBold',
                        marginTop: 1,
                      }}
                    >
                      {shortDate(venta.fecha)} · {venta.estado}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 4, alignSelf: 'center' }}>
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 13,
                        fontFamily: 'Outfit_700Bold',
                        fontWeight: '700',
                      }}
                    >
                      {formatCurrency(venta.totalAmount)}
                    </Text>
                    <ChevronRight size={14} color={colors.textDisabled} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </GlassCard>
      </ScrollView>
    </View>
  )
}
