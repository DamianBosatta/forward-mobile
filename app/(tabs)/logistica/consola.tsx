import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, Linking, Platform, ScrollView } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import {
  Truck,
  Navigation,
  CheckCircle2,
  XCircle,
  ChevronRight,
  AlertCircle,
  Clock,
  ExternalLink,
  Package,
  MoreVertical,
  Flag,
  ArrowLeft,
  FileText,
} from 'lucide-react-native'
import { FlashList } from '@shopify/flash-list'
const FlashListCast = FlashList as any
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { MotiView } from 'moti'
import { safeHaptics } from '@/core/utils/haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { GlassCard, RequirePermission, ConfirmModal } from '@/core/ui'
import { useColors, tokens, BRAND } from '@/libs/theme'
import { useLogisticaStore } from '@/features/logistica/store/logistica.store'
import { StopActionModal } from '@/features/logistica/components/StopActionModal'
import { RouteSelector } from '@/features/logistica/components/RouteSelector'
import { FinalizedTripSummary } from '@/features/logistica/components/FinalizedTripSummary'
import { ReadOnlyNotice } from '@/features/logistica/components/ReadOnlyNotice'
import { PedidoDetalleModal } from '@/features/logistica/components/PedidoDetalleModal'
import { DriverConsoleHeader } from '@/features/logistica/components/DriverConsoleHeader'
import { useHojaRuta, useReportarParada, useFinalizarHojaRuta, useIniciarHojaRuta, useHojasDeRuta } from '@/libs/api-client'
import { getManifiestoUrl } from '@/libs/api-client/logistica'
import { getNotaEntregaUrl } from '@/libs/api-client/ventas'
import { EstadoHojaRuta, EstadoParada } from '@/libs/api-client/types'
import { useAuthStore } from '@/libs/store'
import { allParadasReported } from '@/src/features/logistica/lib/viajes-logic'
import { sharePdf } from '@/features/pedidos/lib/sharePdf'

// Module-scope (stable identity) so it can be a dependency-free callback for the memoized header.
// Uses only Platform/Linking — no component state.
function openInMaps(lat: number, lng: number, address: string) {
  const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' })
  const label = encodeURIComponent(address)
  const url = Platform.select({
    ios: `${scheme}${label}@${lat},${lng}`,
    android: `geo:${lat},${lng}?q=${label}`,
  })
  if (url) Linking.openURL(url)
}

export default function ConsolaChoferScreen() {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  
  const { user, canDo } = useAuthStore()
  // A chofer is a NON-management user with MOD_VIAJES read but no MOD_VENTAS create. Excluding
  // admin/superadmin (management) prevents a manager with viajes access from being treated as a
  // driver and routed to the driver home. Mirrors the role branch in the tabs dashboard index.
  const isChofer =
    !useAuthStore.getState().isAdmin() &&
    !useAuthStore.getState().isSuperAdmin() &&
    canDo('MOD_VIAJES', 'read') &&
    !canDo('MOD_VENTAS', 'create')
  // For a chofer, "back/home" is their own dashboard — never the logística admin index.
  const homeTarget = isChofer ? '/(tabs)' : '/(tabs)/logistica'
  const { activeTrip, setActiveTrip, clearActiveTrip, updateStopStatus } = useLogisticaStore()
  const [selectedStop, setSelectedStop] = useState<any>(null)
  const [pedidoStop, setPedidoStop] = useState<any>(null)
  const [resolvedRouteId, setResolvedRouteId] = useState<string | null>(null)
  // Tracks which stop's nota de entrega is currently downloading (by ventaId).
  const [notaLoadingId, setNotaLoadingId] = useState<string | null>(null)

  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean
    title: string
    message: string
    variant?: 'danger' | 'success' | 'info' | 'warning' | 'primary'
    confirmLabel?: string
    cancelLabel?: string
    onConfirm?: () => void | Promise<void>
    onCancel?: () => void
    loading?: boolean
  }>({
    visible: false,
    title: '',
    message: '',
  })

  const showAlert = (config: Omit<typeof alertConfig, 'visible'>) => {
    setAlertConfig({
      ...config,
      visible: true,
      loading: false,
    })
  }

  const handleAlertConfirm = async () => {
    if (alertConfig.onConfirm) {
      const originalOnConfirm = alertConfig.onConfirm
      setAlertConfig(prev => ({ ...prev, loading: true }))
      try {
        await originalOnConfirm()
        setAlertConfig(prev => {
          if (prev.onConfirm === originalOnConfirm) {
            return { ...prev, visible: false, loading: false }
          }
          return prev
        })
      } catch (error) {
        setAlertConfig(prev => {
          if (prev.onConfirm === originalOnConfirm) {
            return { ...prev, loading: false }
          }
          return prev
        })
      }
    } else {
      setAlertConfig(prev => ({ ...prev, visible: false }))
    }
  }
  
  // On open without an explicit navigation id, a cached finished/cancelled trip
  // must not hijack the console — it would trap the user on the summary with no way out.
  // Drop it once so the route list / selector can resolve a fresh route.
  useEffect(() => {
    const cached = useLogisticaStore.getState().activeTrip
    const isClosed =
      cached?.estado === EstadoHojaRuta.Finalizada || cached?.estado === EstadoHojaRuta.Cancelada
    if (!id && isClosed) clearActiveTrip()
  }, [id, clearActiveTrip])

  const targetId = id || activeTrip?.id || resolvedRouteId || ''
  
  // 1. Consultar hojas de ruta del chofer si no hay un ID definido en navegación ni activeTrip
  const { data: routeList, isLoading: isLoadingRoutes } = useHojasDeRuta(
    { choferId: user?.id },
    { enabled: !id && !activeTrip?.id && !!user?.id }
  )

  // 2. Resolver la ruta activa solo cuando hay exactamente 1 ruta.
  //    Con >1 rutas el selector manual es el que asigna resolvedRouteId.
  useEffect(() => {
    if (routeList && routeList.length === 1 && !id && !activeTrip?.id) {
      const route = routeList[0]
      setResolvedRouteId(route.id ?? null)
    }
  }, [routeList, id, activeTrip])

  const { data: remoteTrip, isLoading: isLoadingTrip, refetch } = useHojaRuta(targetId)
  const reportarParada = useReportarParada()
  const finalizarRuta = useFinalizarHojaRuta()
  const iniciarRuta = useIniciarHojaRuta()

  const isLoading = isLoadingTrip || (isLoadingRoutes && !targetId)

  useEffect(() => {
    if (remoteTrip) setActiveTrip(remoteTrip)
  }, [remoteTrip])

  // ── Derived state ────────────────────────────────────────────────────────────

  // Show the route selector when the driver has multiple routes and none has been chosen yet.
  const showRouteSelector =
    !id && !activeTrip?.id && !resolvedRouteId &&
    !isLoadingRoutes && (routeList?.length ?? 0) > 1

  // The route is finalized — show summary and hide action CTAs.
  const isFinalized = activeTrip?.estado === EstadoHojaRuta.Finalizada

  // The authenticated user is the assigned driver (or a super-admin).
  const isSuperAdmin = useAuthStore.getState().isSuperAdmin()
  const isAssignedDriver = isSuperAdmin || activeTrip?.choferId === user?.id

  // When not the assigned driver, the console is read-only.
  const isReadOnly = activeTrip != null && !isAssignedDriver

  // The manifiesto PDF only exists once the trip has actually started (EnCurso) or
  // finished (Finalizada). For a Programada (not-yet-started) trip getManifiestoUrl
  // would 404, so the share control must not be offered yet.
  const manifiestoAvailable =
    !!activeTrip?.id &&
    (activeTrip.estado === EstadoHojaRuta.EnCurso ||
      activeTrip.estado === EstadoHojaRuta.Finalizada)

  const handleStartRoute = async () => {
    if (!activeTrip || iniciarRuta.isPending) return
    try {
      safeHaptics.notification('success')
      await iniciarRuta.mutateAsync(activeTrip.id ?? '')
      refetch()
    } catch (error) {
      showAlert({
        title: "Error",
        message: "No se pudo iniciar la hoja de ruta.",
        variant: "danger",
        confirmLabel: "Entendido"
      })
    }
  }

  const handleFinishRoute = () => {
    if (!activeTrip) return
    // allParadasReported handles null/undefined estado (treated as Pendiente).
    // Also requires at least 1 stop (empty trip should not be finalizable).
    const detalles = activeTrip.detalles ?? []
    if (detalles.length === 0 || !allParadasReported(detalles)) {
      const pendingCount = detalles.filter(
        d => d.estado !== EstadoParada.Entregado && d.estado !== EstadoParada.NoEntregado
      ).length
      showAlert({
        title: "Paradas Pendientes",
        message: `Quedan ${pendingCount} paradas sin reportar. Reportá todas las paradas antes de finalizar.`,
        variant: "warning",
        confirmLabel: "Entendido"
      })
      return
    }

    showAlert({
      title: "Finalizar Viaje",
      message: "¿Estás seguro de finalizar el viaje?",
      variant: "danger",
      confirmLabel: "FINALIZAR",
      cancelLabel: "Cancelar",
      onConfirm: async () => {
        try {
          await finalizarRuta.mutateAsync(activeTrip.id ?? '')
          safeHaptics.notification('success')
          clearActiveTrip()
          // Back to the role home: a chofer must never land on the logística admin index after
          // closing a trip (homeTarget = their own dashboard); an admin returns to logística.
          router.replace(homeTarget as any)
        } catch (error) {
          showAlert({
            title: "Error",
            message: "No se pudo finalizar la hoja de ruta.",
            variant: "danger",
            confirmLabel: "Entendido"
          })
        }
      }
    })
  }

  const [shareError, setShareError] = useState<string | null>(null)

  const handleShareManifiesto = useCallback(async () => {
    if (!activeTrip?.id) return
    setShareError(null)
    const result = await sharePdf(
      getManifiestoUrl(activeTrip.id),
      `manifiesto-${activeTrip.id.substring(0, 8)}.pdf`
    )
    if (!result.ok) {
      setShareError(result.message)
    }
  }, [activeTrip])

  // Downloads the nota de entrega PDF for a single stop and opens the OS share sheet.
  // A stop reached in the consola is always EnRuta+, so its nota is available.
  const handleDownloadNota = useCallback(async (ventaId?: string) => {
    // Empty string passes a plain falsy check but yields a malformed URL (404), so guard the trim too.
    if (!ventaId || !ventaId.trim() || notaLoadingId) return
    setShareError(null)
    setNotaLoadingId(ventaId)
    const result = await sharePdf(getNotaEntregaUrl(ventaId), `nota-entrega-${ventaId.slice(0, 8)}.pdf`)
    setNotaLoadingId(null)
    if (!result.ok) {
      setShareError(result.message)
    }
  }, [notaLoadingId])

  // Stable FlashList header: rendered through useCallback so the header (coach banner + focus
  // card) keeps a constant identity across unrelated re-renders and does NOT remount / re-fire
  // its entrance animation. It re-creates only when the route data, the user, or read-only
  // status changes. Declared BEFORE the early returns to satisfy the Rules of Hooks.
  const renderListHeader = useCallback(() => {
    if (!activeTrip) return null
    return (
      <DriverConsoleHeader
        estado={activeTrip.estado}
        detalles={activeTrip.detalles ?? []}
        firstName={(user?.nombre ?? '').split(' ')[0] || 'Chofer'}
        isReadOnly={isReadOnly}
        onSelectStop={setSelectedStop}
        onVerPedido={setPedidoStop}
        onNavigate={openInMaps}
      />
    )
  }, [activeTrip, user, isReadOnly])

  if (isLoading && !activeTrip) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  // Multi-route selector: shown before an activeTrip is resolved.
  if (showRouteSelector && routeList) {
    return (
      <RequirePermission module="MOD_VIAJES" action="read" mode="screen">
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
          <RouteSelector
            routes={routeList}
            onSelect={(selectedId) => setResolvedRouteId(selectedId)}
          />
        </View>
      </RequirePermission>
    )
  }

  if (!activeTrip) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: 20 }}>
        <GlassCard style={{ padding: 40, alignItems: 'center' }}>
          <Truck size={64} color={colors.textDisabled} />
          <Text style={{ fontSize: tokens.typography.xl.size, fontWeight: '900', color: colors.text, marginTop: 24, textAlign: 'center' }}>SIN VIAJE ACTIVO</Text>
          <TouchableOpacity
            onPress={() => router.replace(homeTarget as any)}
            style={{ backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16, marginTop: 32 }}
          >
            <Text style={{ color: '#fff', fontWeight: '900' }}>{isChofer ? 'VOLVER AL INICIO' : 'VOLVER A LOGÍSTICA'}</Text>
          </TouchableOpacity>
        </GlassCard>
      </View>
    )
  }

  const tripDetalles = activeTrip.detalles ?? []
  const progress = tripDetalles.length > 0
    ? (tripDetalles.filter(d => d.estado !== EstadoParada.Pendiente).length / tripDetalles.length) * 100
    : 0

  const nextStop = tripDetalles.find(d => d.estado === EstadoParada.Pendiente)

  return (
    <RequirePermission module="MOD_VIAJES" action="read" mode="screen">
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        
        <View style={{ 
          paddingTop: insets.top, 
          backgroundColor: colors.surface + 'CC',
          zIndex: 10
        }}>
          <BlurView intensity={80} style={{ padding: 20, paddingBottom: 15 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                <TouchableOpacity
                  onPress={() => router.replace(homeTarget as any)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Volver"
                  style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}
                >
                  <ArrowLeft size={22} color={colors.text} />
                </TouchableOpacity>
                <MotiView from={{ opacity: 0, translateX: -10 }} animate={{ opacity: 1, translateX: 0 }} style={{ flex: 1 }}>
                  <Text style={{ fontSize: tokens.typography.sm.size, fontWeight: '900', color: colors.primary, letterSpacing: 2 }}>DRIVER CONSOLE</Text>
                  <Text numberOfLines={1} style={{ fontSize: 24, fontWeight: '900', color: colors.text }}>Viaje #{activeTrip.id ? activeTrip.id.substring(0, 8).toUpperCase() : ''}</Text>
                </MotiView>
              </View>
              <MotiView
                from={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{
                  flexShrink: 0, marginLeft: 12,
                  flexDirection: 'row', alignItems: 'center', gap: 7,
                  backgroundColor: activeTrip.estado === EstadoHojaRuta.EnCurso ? colors.primary + '20' : colors.surface2,
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
                  borderWidth: 1, borderColor: activeTrip.estado === EstadoHojaRuta.EnCurso ? colors.primary : colors.border,
                  ...(activeTrip.estado === EstadoHojaRuta.EnCurso
                    ? { shadowColor: colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 10, elevation: 6 }
                    : {})
                }}
              >
                {activeTrip.estado === EstadoHojaRuta.EnCurso && (
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary }} />
                )}
                <Text style={{ fontSize: tokens.typography.sm.size, fontWeight: '900', letterSpacing: 0.5, color: activeTrip.estado === EstadoHojaRuta.EnCurso ? colors.primary : colors.textMuted }}>
                  {activeTrip.estado === EstadoHojaRuta.EnCurso ? 'EN RUTA' :
                   activeTrip.estado === EstadoHojaRuta.Programada ? 'PROGRAMADA' :
                   activeTrip.estado === EstadoHojaRuta.Finalizada ? 'FINALIZADA' : 'CANCELADA'}
                </Text>
              </MotiView>
            </View>

            <View style={{ marginTop: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.5, color: colors.textSecondary }}>PROGRESO DEL DÍA</Text>
                <Text style={{ fontSize: 11, fontWeight: '900', color: colors.primary }}>{Math.round(progress)}% COMPLETADO</Text>
              </View>
              <View style={{ height: 8, backgroundColor: colors.surface2, borderRadius: 4, overflow: 'hidden' }}>
                <MotiView
                  animate={{ width: `${progress}%` }}
                  transition={{ type: 'timing', duration: 1000 }}
                  style={{ height: '100%' }}
                >
                  <LinearGradient
                    colors={[colors.primary, BRAND.lime]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{ flex: 1, borderRadius: 4 }}
                  />
                </MotiView>
              </View>
            </View>
          </BlurView>
        </View>

        {/* Read-only notice for non-assigned drivers */}
        {isReadOnly && <ReadOnlyNotice />}

        {isFinalized ? (
          /* Finalized route: show summary in place of the stop list */
          <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}>
            <FinalizedTripSummary detalles={tripDetalles} />

            {/* Compartir Manifiesto — always available when there is an active trip */}
            <TouchableOpacity
              onPress={handleShareManifiesto}
              style={{
                marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 16,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
                backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border,
              }}
            >
              <FileText size={18} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '900', letterSpacing: 0.5 }}>
                COMPARTIR MANIFIESTO
              </Text>
            </TouchableOpacity>

            {shareError && (
              <View style={{ marginHorizontal: 16, marginTop: 8, padding: 12, borderRadius: 12, backgroundColor: BRAND.red + '15', borderWidth: 1, borderColor: BRAND.red + '40' }}>
                <Text style={{ color: BRAND.red, fontSize: 13, fontWeight: '600' }}>{shareError}</Text>
              </View>
            )}

            {!id && (
              <TouchableOpacity
                onPress={() => {
                  safeHaptics.impact('light')
                  clearActiveTrip()
                  setResolvedRouteId(null)
                }}
                style={{
                  marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 16,
                  borderWidth: 1, borderColor: colors.border, alignItems: 'center'
                }}
              >
                <Text style={{ color: colors.primary, fontWeight: '900', letterSpacing: 0.5 }}>
                  CAMBIAR DE RUTA
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        ) : (
          /* Active route: normal stop list */
          <FlashListCast
            data={activeTrip.detalles}
            keyExtractor={(item: any) => item.id}
            estimatedItemSize={120}
            contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
            ListHeaderComponent={renderListHeader}
            renderItem={({ item, index }: { item: any; index: number }) => (
              <StopItem
                stop={item}
                index={index}
                isLast={index === tripDetalles.length - 1}
                isNext={item.id === nextStop?.id}
                suppressNext={activeTrip.estado === EstadoHojaRuta.EnCurso}
                onAction={() => {
                  if (isReadOnly) return
                  safeHaptics.impact('medium')
                  setSelectedStop(item)
                }}
                onNavigate={() => openInMaps(item.latitud, item.longitud, item.direccion)}
                onVerPedido={() => setPedidoStop(item)}
                onDownloadNota={() => handleDownloadNota(item.ventaId)}
                notaLoading={notaLoadingId === item.ventaId}
                notaBusy={!!notaLoadingId}
              />
            )}
          />
        )}

        {/* Bottom CTA: hidden when finalized or read-only */}
        {!isFinalized && !isReadOnly && (
          <MotiView
            from={{ translateY: 100 }}
            animate={{ translateY: 0 }}
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border,
              backgroundColor: colors.background + 'EE'
            }}
          >
            {shareError && manifiestoAvailable && (
              <View style={{ marginBottom: 10, padding: 10, borderRadius: 10, backgroundColor: BRAND.red + '15', borderWidth: 1, borderColor: BRAND.red + '40' }}>
                <Text style={{ color: BRAND.red, fontSize: tokens.typography.sm.size, fontWeight: '600' }}>{shareError}</Text>
              </View>
            )}

            {/* Compartir Manifiesto — only when the manifiesto actually exists
                (trip EnCurso/Finalizada). Hidden for Programada to avoid a 404. */}
            {manifiestoAvailable && (
              <TouchableOpacity
                onPress={handleShareManifiesto}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  marginBottom: 10, paddingVertical: 10, borderRadius: 16,
                  borderWidth: 1, borderColor: colors.border,
                }}
              >
                <FileText size={15} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 }}>COMPARTIR MANIFIESTO</Text>
              </TouchableOpacity>
            )}

            {activeTrip.estado === EstadoHojaRuta.Programada ? (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleStartRoute}
                disabled={iniciarRuta.isPending}
                style={{ borderRadius: 24, opacity: iniciarRuta.isPending ? 0.6 : 1, ...tokens.shadows.premium }}
              >
                <LinearGradient
                  colors={[colors.primary, BRAND.lime]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={{ padding: 20, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}
                >
                  {iniciarRuta.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Truck size={24} color="#fff" strokeWidth={3} />
                  )}
                  <Text style={{ color: '#fff', fontSize: tokens.typography.lg.size, fontWeight: '900', letterSpacing: 1 }}>
                    {iniciarRuta.isPending ? 'INICIANDO...' : 'INICIAR RECORRIDO'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              (() => {
                // Hard gate: disable Finalizar until allParadasReported() is true.
                const canFinalize = allParadasReported(activeTrip.detalles ?? []) && (activeTrip.detalles ?? []).length > 0
                return (
                  <TouchableOpacity
                    activeOpacity={canFinalize ? 0.9 : 1}
                    onPress={canFinalize ? handleFinishRoute : undefined}
                    style={{
                      backgroundColor: colors.surface2,
                      padding: 20, borderRadius: 24,
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
                      borderWidth: 1.5, borderColor: canFinalize ? colors.primary + '66' : colors.border,
                      opacity: canFinalize ? 1 : 0.45,
                      shadowColor: colors.primary, shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: canFinalize ? 0.25 : 0, shadowRadius: 12, elevation: canFinalize ? 4 : 0
                    }}
                  >
                    <Flag size={24} color={canFinalize ? colors.primary : colors.textDisabled} strokeWidth={2.5} />
                    <Text style={{ color: canFinalize ? colors.text : colors.textDisabled, fontSize: tokens.typography.lg.size, fontWeight: '900', letterSpacing: 0.5 }}>FINALIZAR VIAJE</Text>
                  </TouchableOpacity>
                )
              })()
            )}
          </MotiView>
        )}

        {/* Stop action modal: suppressed when read-only */}
        <StopActionModal
          isVisible={!isReadOnly && !!selectedStop}
          stopName={selectedStop?.clienteNombre || '...'}
          isPending={reportarParada.isPending}
          onClose={() => setSelectedStop(null)}
          onConfirm={async (result) => {
            if (!selectedStop || !activeTrip) return
            try {
              await reportarParada.mutateAsync({
                hojaDeRutaId: activeTrip.id ?? '',
                paradaId: selectedStop.id,
                entregado: result.status === 'delivered',
                observaciones: result.observations,
                motivoRechazo: result.status === 'failed' ? result.reason : undefined
              })
              updateStopStatus(selectedStop.id, {
                delivered: result.status === 'delivered',
                observations: result.observations,
                reason: result.status === 'failed' ? result.reason : undefined
              })
              safeHaptics.notification('success')
              setSelectedStop(null)
            } catch (error) {
              showAlert({
                title: "Error",
                message: "No se pudo reportar la parada.",
                variant: "danger",
                confirmLabel: "Entendido"
              })
            }
          }}
        />

        <PedidoDetalleModal
          ventaId={pedidoStop?.ventaId ?? null}
          clienteNombre={pedidoStop?.clienteNombre}
          isVisible={!!pedidoStop}
          onClose={() => setPedidoStop(null)}
        />

        <ConfirmModal
          visible={alertConfig.visible}
          title={alertConfig.title}
          message={alertConfig.message}
          variant={alertConfig.variant || 'primary'}
          confirmLabel={alertConfig.confirmLabel}
          cancelLabel={alertConfig.cancelLabel}
          onConfirm={handleAlertConfirm}
          onCancel={() => {
            if (alertConfig.onCancel) alertConfig.onCancel()
            setAlertConfig(prev => ({ ...prev, visible: false }))
          }}
          loading={alertConfig.loading}
        />

      </View>
    </RequirePermission>
  )
}

function StopItem({ stop, index, isLast, isNext, suppressNext, onAction, onNavigate, onVerPedido, onDownloadNota, notaLoading, notaBusy }: any) {
  const colors = useColors()
  const isProcesado = stop.estado !== EstadoParada.Pendiente
  // Semantic color per state: delivered=green, failed=red, pending=amber (warning).
  const statusColor = stop.estado === EstadoParada.Entregado ? BRAND.green
    : stop.estado === EstadoParada.NoEntregado ? BRAND.red
    : colors.warning
  const statusLabel = stop.estado === EstadoParada.Entregado ? 'ENTREGADO'
    : stop.estado === EstadoParada.NoEntregado ? 'NO ENTREGADO'
    : 'PENDIENTE'

  // Only hide the next stop from the list when the EnCurso "PRÓXIMA PARADA" focus card is
  // actually rendering it. In Programada (route not started) there is no focus card, so the
  // first stop MUST stay in the list — otherwise the list visibly starts at #2.
  if (isNext && !isProcesado && suppressNext) return null

  return (
    <MotiView
      from={{ opacity: 0, translateX: -20 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ delay: index * 100 }}
      style={{ flexDirection: 'row' }}
    >
      <View style={{ alignItems: 'center', width: 40 }}>
        <View style={{
          width: 30, height: 30, borderRadius: 15,
          backgroundColor: statusColor + '20',
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 2, borderColor: statusColor
        }}>
          {isProcesado ? (
            stop.estado === EstadoParada.Entregado ? <CheckCircle2 size={15} color={statusColor} /> : <XCircle size={15} color={statusColor} />
          ) : (
            <Text style={{ fontSize: tokens.typography.sm.size, fontWeight: '900', color: statusColor }} maxFontSizeMultiplier={1.3}>{index + 1}</Text>
          )}
        </View>
        {!isLast && <View style={{ flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 4 }} />}
      </View>

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onAction}
        disabled={isProcesado}
        style={{ flex: 1, marginBottom: 20, marginLeft: 12 }}
        accessibilityRole="button"
        accessibilityLabel={`Parada ${index + 1}: ${stop.clienteNombre}`}
      >
        <GlassCard style={{
          padding: 16,
          opacity: isProcesado ? 0.7 : 1,
          backgroundColor: isProcesado ? colors.surface : colors.cardBg,
          borderLeftWidth: 3, borderLeftColor: statusColor
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: tokens.typography.md.size, fontWeight: '800', color: isProcesado ? colors.textMuted : colors.text }} numberOfLines={1}>{stop.clienteNombre}</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>{stop.direccion}</Text>
            </View>
            {!isProcesado && (
              <TouchableOpacity
                onPress={onNavigate}
                style={{ padding: 8 }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Navegar a la dirección"
              >
                <Navigation size={18} color={BRAND.blue} />
              </TouchableOpacity>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: statusColor + '1A', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 }}>
              {isProcesado && <Clock size={11} color={statusColor} />}
              <Text style={{ fontSize: tokens.typography.xs.size, fontWeight: '900', letterSpacing: 0.5, color: statusColor }}>{statusLabel}</Text>
            </View>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              onPress={onVerPedido}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 9, borderRadius: 8, backgroundColor: colors.surface2 }}
              accessibilityRole="button"
              accessibilityLabel="Ver pedido"
            >
              <Package size={13} color={colors.primary} />
              <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>Ver pedido</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onDownloadNota}
              disabled={notaBusy}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 9, borderRadius: 8, backgroundColor: colors.surface2, opacity: notaBusy && !notaLoading ? 0.5 : 1 }}
              accessibilityRole="button"
              accessibilityLabel="Agregar nota"
            >
              {notaLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <FileText size={13} color={colors.primary} />
                  <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>Nota</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </GlassCard>
      </TouchableOpacity>
    </MotiView>
  )
}

