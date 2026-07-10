import React, { useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native'
import { useRouter, useNavigation } from 'expo-router'
import { DrawerActions } from '@react-navigation/native'
import { useColors, tokens, BRAND } from '@/libs/theme'
import { KpiCardMobile, BentoGrid, BentoItem, GlassCard, Skeleton, ForwardLogo, TopHeaderActions } from '@/core/ui'
import { useHojasDeRuta } from '@/libs/api-client/logistica'
import { EstadoHojaRuta } from '@/libs/api-client/types'
import { useAuthStore } from '@/libs/store/auth.store'
import { Truck, MapPin, CheckCircle2, Clock, ChevronRight, Navigation } from 'lucide-react-native'
import { MotiView } from 'moti'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { safeHaptics } from '@/core/utils/haptics'
import type { HojaRutaListItemDto } from '@/libs/api-client/types'

// ─── Date helpers (memoized at module level — never recomputed per render) ─────

function firstDayOfCurrentMonth(): string {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function nowIso(): string {
  return new Date().toISOString()
}

// ─── Estado badge config ───────────────────────────────────────────────────────

interface BadgeConfig {
  label: string
  color: string
}

function getEstadoBadge(estado: number | undefined, colors: ReturnType<typeof useColors>): BadgeConfig {
  switch (estado) {
    case EstadoHojaRuta.Programada:
      return { label: 'PROGRAMADA', color: BRAND.orange }
    case EstadoHojaRuta.EnCurso:
      return { label: 'EN CURSO', color: colors.primary }
    case EstadoHojaRuta.Finalizada:
      return { label: 'FINALIZADA', color: colors.success }
    case EstadoHojaRuta.Cancelada:
      return { label: 'CANCELADA', color: colors.danger }
    default:
      return { label: 'DESCONOCIDA', color: colors.textMuted }
  }
}

// ─── Skeleton row ──────────────────────────────────────────────────────────────

function HojaRowSkeleton() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 }}>
      <Skeleton width={36} height={36} borderRadius={10} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width="60%" height={12} />
        <Skeleton width="40%" height={10} />
      </View>
      <Skeleton width={70} height={20} borderRadius={6} />
    </View>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function ChoferDashboard() {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const navigation = useNavigation()
  const { user } = useAuthStore()

  // Memoize date range once per mount to avoid infinite react-query refetch loops.
  const { fechaDesde, fechaHasta } = useMemo(
    () => ({
      fechaDesde: firstDayOfCurrentMonth(),
      fechaHasta: nowIso(),
    }),
    [],
  )

  const {
    data: hojas,
    isLoading,
    refetch,
  } = useHojasDeRuta({ choferId: user?.id })

  // ── Derived state ──────────────────────────────────────────────────────────

  const sorted: HojaRutaListItemDto[] = useMemo(() => {
    if (!hojas) return []
    return [...hojas].sort((a, b) => {
      const da = a.fechaSalida ? new Date(a.fechaSalida).getTime() : 0
      const db = b.fechaSalida ? new Date(b.fechaSalida).getTime() : 0
      return db - da
    })
  }, [hojas])

  const activo = useMemo(
    () => sorted.find(h => h.estado === EstadoHojaRuta.EnCurso),
    [sorted],
  )

  const programado = useMemo(
    () => sorted.find(h => h.estado === EstadoHojaRuta.Programada),
    [sorted],
  )

  const heroHoja = activo ?? programado

  // KPIs derived from this month's hojas (memoized against stable date strings)
  const { viajesDelMes, totalProgramados, paradasActivas } = useMemo(() => {
    if (!hojas) return { viajesDelMes: 0, totalProgramados: 0, paradasActivas: 0 }

    const mesStart = new Date(fechaDesde).getTime()

    const viajesDelMes = hojas.filter(h => {
      const t = h.fechaSalida ? new Date(h.fechaSalida).getTime() : 0
      return h.estado === EstadoHojaRuta.Finalizada && t >= mesStart
    }).length

    const totalProgramados = hojas.filter(h => h.estado === EstadoHojaRuta.Programada).length

    // The list endpoint returns HojaRutaListItemDto; cantidadParadas is required in the contract.
    const paradasActivas = heroHoja?.cantidadParadas ?? 0

    return { viajesDelMes, totalProgramados, paradasActivas }
  }, [hojas, fechaDesde, heroHoja])

  // ── Pull-to-refresh ────────────────────────────────────────────────────────

  const [refreshing, setRefreshing] = React.useState(false)

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  // ── Helpers ────────────────────────────────────────────────────────────────

  const choferName = user?.nombre?.split(' ')[0]?.toUpperCase() ?? 'CHOFER'

  const openConsola = (id?: string) => {
    safeHaptics.impact('light')
    if (id) {
      // @ts-ignore — expo-router dynamic route with query param
      router.push(`/(tabs)/logistica/consola?id=${id}`)
    } else {
      // @ts-ignore — expo-router dynamic route
      router.push('/(tabs)/logistica/consola')
    }
  }

  // ──────────────────────────────────────────────────────────────────────────

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
                  {choferName} · CHOFER
                </Text>
              </View>
            </View>
          </View>
          <TopHeaderActions />
        </MotiView>

        {/* ── Hero — viaje activo / próximo ── */}
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
            <Truck size={8} color={colors.primary} />
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
            Viaje actual
          </Text>
        </MotiView>

        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 300 }}
        >
          <GlassCard intensity={12} style={{ borderRadius: 24, padding: tokens.spacing.md }}>
            {isLoading ? (
              <View style={{ gap: 12 }}>
                <Skeleton width="50%" height={18} borderRadius={6} />
                <Skeleton width="30%" height={28} borderRadius={6} />
                <Skeleton width="100%" height={48} borderRadius={14} />
              </View>
            ) : heroHoja ? (
              <View style={{ gap: 16 }}>
                {/* Status label */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {activo ? (
                    <MotiView
                      from={{ opacity: 0.5, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ loop: true, type: 'timing', duration: 1200, repeatReverse: true }}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: colors.primary,
                      }}
                    />
                  ) : null}
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '900',
                      color: activo ? colors.primary : BRAND.orange,
                      letterSpacing: 1.5,
                      fontFamily: 'Outfit_900Black',
                      textTransform: 'uppercase',
                    }}
                  >
                    {activo ? 'VIAJE EN CURSO' : 'VIAJE PREPARADO'}
                  </Text>
                </View>

                {/* Stop count */}
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <Text
                    style={{
                      fontSize: 40,
                      fontWeight: '900',
                      color: colors.text,
                      fontFamily: 'Outfit_900Black',
                      lineHeight: 44,
                    }}
                  >
                    {heroHoja.cantidadParadas}
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: colors.textMuted,
                      fontFamily: 'Outfit_700Bold',
                    }}
                  >
                    paradas
                  </Text>
                </View>

                {/* CTA button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => openConsola(heroHoja.id)}
                  style={{
                    backgroundColor: colors.primary,
                    borderRadius: 14,
                    paddingVertical: 14,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <Navigation size={16} color="#fff" />
                  <Text
                    style={{
                      color: '#fff',
                      fontSize: 14,
                      fontWeight: '900',
                      fontFamily: 'Outfit_900Black',
                      letterSpacing: 0.5,
                    }}
                  >
                    ABRIR CONSOLA
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}>
                <Truck size={32} color={colors.textDisabled} />
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 14,
                    fontFamily: 'Outfit_600SemiBold',
                    textAlign: 'center',
                  }}
                >
                  No tenés viajes asignados
                </Text>
              </View>
            )}
          </GlassCard>
        </MotiView>

        {/* ── KPIs ── */}
        <MotiView
          from={{ opacity: 0, translateX: -10 }}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ delay: 450 }}
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
              backgroundColor: BRAND.green + '30',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
            }}
          >
            <CheckCircle2 size={8} color={BRAND.green} />
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

        <BentoGrid>
          <BentoItem span={2}>
            {isLoading ? (
              <Skeleton width="100%" height={100} borderRadius={24} />
            ) : (
              <KpiCardMobile
                label="VIAJES DEL MES"
                value={viajesDelMes.toString()}
                sub="FINALIZADOS"
                accent={colors.success}
                icon={<CheckCircle2 size={20} color={colors.success} />}
                index={1}
              />
            )}
          </BentoItem>

          <BentoItem span={1}>
            {isLoading ? (
              <Skeleton width="100%" height={100} borderRadius={24} />
            ) : (
              <KpiCardMobile
                label="PROGRAMADOS"
                value={totalProgramados.toString()}
                sub="PENDIENTES"
                accent={BRAND.orange}
                icon={<Clock size={18} color={BRAND.orange} />}
                index={2}
              />
            )}
          </BentoItem>

          <BentoItem span={1}>
            {isLoading ? (
              <Skeleton width="100%" height={100} borderRadius={24} />
            ) : (
              <KpiCardMobile
                label="PARADAS"
                value={paradasActivas.toString()}
                sub="VIAJE ACTIVO"
                accent={colors.primary}
                icon={<MapPin size={18} color={colors.primary} />}
                index={3}
              />
            )}
          </BentoItem>
        </BentoGrid>

        {/* ── Mis viajes ── */}
        <MotiView
          from={{ opacity: 0, translateX: -10 }}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ delay: 650 }}
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
            <Truck size={8} color={BRAND.blue} />
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
            Mis viajes
          </Text>
        </MotiView>

        <GlassCard intensity={10} style={{ borderRadius: 24, overflow: 'hidden' }}>
          {isLoading ? (
            <View style={{ padding: tokens.spacing.md, gap: 4 }}>
              {[1, 2, 3].map(i => (
                <HojaRowSkeleton key={i} />
              ))}
            </View>
          ) : !sorted.length ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: 13,
                  fontFamily: 'Outfit_600SemiBold',
                  textAlign: 'center',
                }}
              >
                Sin hojas de ruta registradas
              </Text>
            </View>
          ) : (
            <View style={{ padding: tokens.spacing.md }}>
              {sorted.map((hoja, i) => {
                const badge = getEstadoBadge(hoja.estado, colors)
                const code = `HR-${hoja.id.slice(0, 8).toUpperCase()}`
                const fecha = hoja.fechaSalida
                  ? new Date(hoja.fechaSalida).toLocaleDateString('es-AR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit',
                    })
                  : '—'
                const paradas = hoja.cantidadParadas

                return (
                  <TouchableOpacity
                    key={hoja.id}
                    activeOpacity={0.7}
                    onPress={() => openConsola(hoja.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 10,
                      gap: 12,
                      borderBottomWidth: i < sorted.length - 1 ? 1 : 0,
                      borderBottomColor: colors.border,
                    }}
                  >
                    {/* Icon */}
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: badge.color + '15',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Truck size={16} color={badge.color} />
                    </View>

                    {/* Info */}
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
                        {code}
                      </Text>
                      <Text
                        style={{
                          color: colors.textMuted,
                          fontSize: 11,
                          fontFamily: 'Outfit_600SemiBold',
                          marginTop: 1,
                        }}
                      >
                        {fecha} · {paradas} {paradas === 1 ? 'parada' : 'paradas'}
                      </Text>
                    </View>

                    {/* Badge + chevron */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View
                        style={{
                          backgroundColor: badge.color + '20',
                          borderRadius: 6,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                        }}
                      >
                        <Text
                          style={{
                            color: badge.color,
                            fontSize: 9,
                            fontFamily: 'Outfit_900Black',
                            fontWeight: '900',
                            letterSpacing: 0.5,
                          }}
                        >
                          {badge.label}
                        </Text>
                      </View>
                      <ChevronRight size={14} color={colors.textDisabled} />
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}
        </GlassCard>
      </ScrollView>
    </View>
  )
}
