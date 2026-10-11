import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Linking, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { FileText } from 'lucide-react-native'
import { RequirePermission } from '@/core/ui'
import { BottomSheet, Button, Notice, TopBar, useMenuLeading, type TopBarAction } from '@/core/ui/fw'
import { radii, space, typeScale, useColors, useIsDark } from '@/libs/theme'
import { useFinalizarHojaRuta, useHojaRuta, useHojasDeRuta, useIniciarHojaRuta, useReportarParada } from '@/libs/api-client'
import { getManifiestoUrl } from '@/libs/api-client/logistica'
import { getNotaEntregaUrl } from '@/libs/api-client/ventas'
import { EstadoHojaRuta, type ParadaDto } from '@/libs/api-client/types'
import { useAuthStore } from '@/libs/store'
import { useLogisticaStore } from '@/features/logistica/store/logistica.store'
import { RouteSelector } from '@/features/logistica/components/RouteSelector'
import { PedidoDetalleModal } from '@/features/logistica/components/PedidoDetalleModal'
import { HojaDeRutaVista } from '@/features/logistica/consola/HojaDeRutaVista'
import { ReportarParada, type ReporteParada } from '@/features/logistica/consola/ReportarParada'
import { resumenRuta, urlComoLlegar, urlLlamar } from '@/features/logistica/consola/hojaDeRuta'
import { tituloDelDia } from '@/features/ventas/lib/agruparPorDia'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { sharePdf } from '@/features/pedidos/lib/sharePdf'
import { diaArgentina, parseDateSafe } from '@/src/utils/date'

/** Consola del chofer (plan §11, lámina ChoferRuta). Sin foto ni cobro: llegan con 5.1b/c/d. */
export default function ConsolaChoferScreen() {
  const c = useColors()
  const oscuro = useIsDark()
  const router = useRouter()
  const menu = useMenuLeading()
  const { id } = useLocalSearchParams<{ id?: string }>()
  const { user, canDo, isAdmin, isSuperAdmin } = useAuthStore()
  // El chofer lee viajes y no crea ventas: su "inicio" es su propio tablero, no el hub de logística.
  const esChofer = !isAdmin() && !isSuperAdmin() && canDo('MOD_VIAJES', 'read') && !canDo('MOD_VENTAS', 'create')
  const volverA = esChofer ? '/(tabs)' : '/(tabs)/logistica'
  const { activeTrip, setActiveTrip, clearActiveTrip, updateStopStatus } = useLogisticaStore()
  const [rutaElegida, setRutaElegida] = useState<string | null>(null)
  const [reportando, setReportando] = useState<{ parada: ParadaDto; numero: number } | null>(null)
  const [errorReporte, setErrorReporte] = useState<string | null>(null)
  const [pedido, setPedido] = useState<ParadaDto | null>(null)
  const [finalizando, setFinalizando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [notaCargando, setNotaCargando] = useState(false)

  // Sin id de navegación, un viaje cerrado que quedó guardado no secuestra la consola.
  useEffect(() => {
    const guardado = useLogisticaStore.getState().activeTrip
    const cerrado = guardado?.estado === EstadoHojaRuta.Finalizada || guardado?.estado === EstadoHojaRuta.Cancelada
    if (!id && cerrado) clearActiveTrip()
  }, [id, clearActiveTrip])

  const objetivo = id || activeTrip?.id || rutaElegida || ''
  // El servidor devuelve todo el historial del chofer: se piden solo las de hoy (día argentino) y sin las canceladas.
  const hoy = diaArgentina(Date.now())
  const rutas = useHojasDeRuta({ choferId: user?.id, fecha: hoy }, { enabled: !id && !activeTrip?.id && !!user?.id })
  const rutasDeHoy = useMemo(() => (rutas.data ?? []).filter((r) => r.estado !== EstadoHojaRuta.Cancelada), [rutas.data])
  useEffect(() => {
    if (!id && !activeTrip?.id && rutasDeHoy.length === 1) setRutaElegida(rutasDeHoy[0].id ?? null)
  }, [rutasDeHoy, id, activeTrip?.id])

  const remota = useHojaRuta(objetivo)
  useEffect(() => {
    if (remota.data) setActiveTrip(remota.data)
  }, [remota.data, setActiveTrip])

  const reportar = useReportarParada()
  const iniciar = useIniciarHojaRuta()
  const finalizar = useFinalizarHojaRuta()

  // El guardado sirve sin señal, pero solo si es el viaje pedido; si no, manda el servidor.
  const viaje = activeTrip && activeTrip.id === objetivo ? activeTrip : remota.data ?? null

  if ((remota.isLoading || (rutas.isLoading && !objetivo)) && !viaje) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={c.brand} accessibilityLabel="Cargando la hoja de ruta" />
      </View>
    )
  }

  if (!id && !activeTrip?.id && !rutaElegida && rutasDeHoy.length > 1) {
    return (
      <RequirePermission module="MOD_VIAJES" action="read" mode="screen">
        <View style={{ flex: 1, backgroundColor: c.bg }}>
          <TopBar title="Elegí la hoja de ruta" leading={menu} />
          <RouteSelector routes={rutasDeHoy} onSelect={setRutaElegida} />
        </View>
      </RequirePermission>
    )
  }

  const leading = id ? { kind: 'atras' as const, onPress: () => router.replace(volverA as never) } : menu

  if (!viaje) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar title="Hoja de ruta" leading={leading} />
        <View style={{ padding: space[4], gap: space[4] }}>
          <Notice tone="info">No tenés una hoja de ruta para hoy.</Notice>
          <Button label="Volver" variant="secundario" onPress={() => router.replace(volverA as never)} />
        </View>
      </View>
    )
  }

  const detalles = (viaje.detalles ?? []) as ParadaDto[]
  const resumen = resumenRuta(detalles)
  const finalizada = viaje.estado === EstadoHojaRuta.Finalizada
  const programada = viaje.estado === EstadoHojaRuta.Programada
  // Solo el chofer asignado (o el administrador de sistemas) reporta; el servidor lo exige igual.
  const soloLectura = !isSuperAdmin() && viaje.choferId !== user?.id
  const fecha = parseDateSafe(viaje.fechaSalida)
  const subtitulo = [fecha ? tituloDelDia(fecha) : null, viaje.vehiculoPatente].filter(Boolean).join(' · ')
  // El manifiesto existe desde que el viaje arranca; antes daría 404.
  const conManifiesto = viaje.estado === EstadoHojaRuta.EnCurso || finalizada

  const compartirManifiesto = async () => {
    setAviso(null)
    const r = await sharePdf(getManifiestoUrl(viaje.id), `manifiesto-${viaje.id.slice(0, 8)}.pdf`)
    if (!r.ok) setAviso(r.message)
  }
  const acciones: TopBarAction[] = conManifiesto
    ? [{ icon: FileText, accessibilityLabel: 'Compartir manifiesto', onPress: compartirManifiesto }]
    : []

  const compartirNota = async (p: ParadaDto) => {
    if (notaCargando) return
    setAviso(null)
    setNotaCargando(true)
    const r = await sharePdf(getNotaEntregaUrl(p.ventaId), `nota-entrega-${p.ventaId.slice(0, 8)}.pdf`)
    setNotaCargando(false)
    if (!r.ok) setAviso(r.message)
  }

  const abrir = (url: string | null) => {
    if (!url) return
    Linking.openURL(url).catch(() => setAviso('No se pudo abrir esa aplicación en el teléfono.'))
  }

  const confirmarReporte = async (r: ReporteParada) => {
    if (!reportando) return
    setErrorReporte(null)
    try {
      await reportar.mutateAsync({
        hojaDeRutaId: viaje.id,
        paradaId: reportando.parada.id,
        entregado: r.entregado,
        motivoRechazo: r.motivoRechazo,
        nombreReceptor: r.nombreReceptor,
        observaciones: r.observaciones,
      })
      updateStopStatus(reportando.parada.id, { delivered: r.entregado, observations: r.observaciones, reason: r.motivoRechazo })
      setReportando(null)
    } catch (e) {
      setErrorReporte(mensajeDelServidor(e, 'No se pudo reportar la parada.'))
    }
  }

  const accionViaje = async (accion: 'iniciar' | 'finalizar') => {
    setAviso(null)
    try {
      if (accion === 'iniciar') {
        await iniciar.mutateAsync(viaje.id)
        remota.refetch()
        return
      }
      await finalizar.mutateAsync(viaje.id)
      setFinalizando(false)
      clearActiveTrip()
      router.replace(volverA as never)
    } catch (e) {
      setFinalizando(false)
      setAviso(mensajeDelServidor(e, accion === 'iniciar' ? 'No se pudo iniciar el recorrido.' : 'No se pudo finalizar el viaje.'))
    }
  }

  const todasReportadas = resumen.total > 0 && resumen.hechas === resumen.total
  const pie = soloLectura ? null : programada ? (
    <Button label="Iniciar recorrido" loading={iniciar.isPending} onPress={() => accionViaje('iniciar')} />
  ) : finalizada ? (
    !id ? (
      <Button label="Cambiar de ruta" variant="secundario" onPress={() => { clearActiveTrip(); setRutaElegida(null) }} />
    ) : null
  ) : todasReportadas ? (
    <Button label="Finalizar viaje" onPress={() => setFinalizando(true)} />
  ) : null

  return (
    <RequirePermission module="MOD_VIAJES" action="read" mode="screen">
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar title="Hoja de ruta" subtitle={subtitulo || undefined} leading={leading} actions={acciones} />
        <View style={{ backgroundColor: c.topBar, paddingHorizontal: space[4], paddingBottom: space[4], gap: space[2] }}>
          <Text style={{ ...typeScale.cuerpoDestacado, color: c.onTopBarStrong }}>
            {`${resumen.hechas} de ${resumen.total} paradas`}
          </Text>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Paradas reportadas"
            accessibilityValue={{ min: 0, max: resumen.total, now: resumen.hechas }}
            style={{ height: space[2], borderRadius: radii.pastilla, overflow: 'hidden', backgroundColor: oscuro ? c.border : c.textSecondary }}
          >
            <View style={{ height: space[2], width: `${resumen.total ? (resumen.hechas / resumen.total) * 100 : 0}%`, backgroundColor: c.brand }} />
          </View>
        </View>
        <View style={{ paddingHorizontal: space[4], paddingTop: space[3], gap: space[2] }}>
          {soloLectura ? <Notice tone="info">Esta hoja de ruta es de otro chofer: solo podés verla.</Notice> : null}
          {finalizada ? <Notice tone="exito" title="Viaje finalizado.">Quedó cerrado en el sistema.</Notice> : null}
          {aviso ? <Notice tone="peligro">{aviso}</Notice> : null}
        </View>
        <HojaDeRutaVista
          resumen={resumen}
          soloLectura={soloLectura}
          puedeReportar={!programada && !finalizada}
          onReportar={(p) => {
            setErrorReporte(null)
            setReportando({ parada: p, numero: resumen.proxima?.numero ?? 0 })
          }}
          onComoLlegar={(p) => abrir(urlComoLlegar(p.direccion))}
          onLlamar={(p) => abrir(urlLlamar(p.telefono))}
          puedeLlamar={(p) => urlLlamar(p.telefono) !== null}
          onVerPedido={setPedido}
          onNota={compartirNota}
          notaCargando={notaCargando}
          pie={pie}
        />
        {reportando ? (
          <ReportarParada
            key={reportando.parada.id}
            parada={reportando.parada}
            numero={reportando.numero}
            enviando={reportar.isPending}
            error={errorReporte}
            onCerrar={() => setReportando(null)}
            onConfirmar={confirmarReporte}
          />
        ) : null}
        <BottomSheet visible={finalizando} onClose={() => setFinalizando(false)} accessibilityLabel="Finalizar viaje">
          <Text style={{ ...typeScale.seccion, color: c.text }}>¿Finalizar el viaje?</Text>
          <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>Todas las paradas están reportadas. El viaje queda cerrado.</Text>
          <Button label="Finalizar viaje" loading={finalizar.isPending} onPress={() => accionViaje('finalizar')} />
          <Button label="Cancelar" variant="secundario" onPress={() => setFinalizando(false)} />
        </BottomSheet>
        <PedidoDetalleModal
          ventaId={pedido?.ventaId ?? null}
          clienteNombre={pedido?.clienteNombre}
          isVisible={!!pedido}
          onClose={() => setPedido(null)}
        />
      </View>
    </RequirePermission>
  )
}
