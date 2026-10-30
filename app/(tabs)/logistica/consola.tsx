import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Linking, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { onlineManager, useQueryClient } from '@tanstack/react-query'
import { FileText, Phone, RefreshCw, WifiOff } from 'lucide-react-native'
import { RequirePermission } from '@/core/ui'
import { BottomSheet, Button, Notice, Progress, formatImporte, TopBar, useMenuLeading, type TopBarAction } from '@/core/ui/fw'
import { MotivoDeshabilitado } from '@/core/ui/fw/MotivoDeshabilitado'
import { esFallaDeRed } from '@/core/api/errores'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { safeHaptics } from '@/core/utils/haptics'
import { useEntregarParada, useFinalizarHojaRuta, useHojaRuta, useHojasDeRuta, useIniciarHojaRuta, useReportarParada } from '@/libs/api-client'
import { getManifiestoUrl, logisticaKeys } from '@/libs/api-client/logistica'
import { getNotaEntregaUrl } from '@/libs/api-client/ventas'
import { EstadoHojaRuta, type ParadaDto } from '@/libs/api-client/types'
import { esEstadoHojaRuta } from '@/core/constants/estados'
import { useAuthStore } from '@/libs/store'
import { esChofer } from '@/src/components/layout/menuModules'
import { useLogisticaStore } from '@/features/logistica/store/logistica.store'
import { RouteSelector } from '@/features/logistica/components/RouteSelector'
import { PedidoDetalleModal } from '@/features/logistica/components/PedidoDetalleModal'
import { HojaDeRutaVista } from '@/features/logistica/consola/HojaDeRutaVista'
import { ReportarParada, type Resultado, type ReporteParada } from '@/features/logistica/consola/ReportarParada'
import { LlegueParada } from '@/features/logistica/consola/LlegueParada'
import { EntregaLista } from '@/features/logistica/consola/EntregaLista'
import { ColaConsola, encolarAccion, useColaConsola, type DatosAccion } from '@/features/logistica/cola'
import { conAccionesEnCola } from '@/features/logistica/cola/conAccionesEnCola'
import { piezasDeParada } from '@/features/logistica/consola/piezasParada'
import { resumenRuta, urlComoLlegar, urlLlamar } from '@/features/logistica/consola/hojaDeRuta'
import { clasificarFalloEntrega, formatDistancia } from '@/features/logistica/consola/entrega'
import type { CuerpoEntregaParada } from '@/libs/api-client/logistica'
import { nuevaClaveIdempotencia } from '@/features/venta-nueva/lib/payload'
import { tituloDelDia } from '@/features/ventas/lib/agruparPorDia'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { sharePdf } from '@/features/pedidos/lib/sharePdf'
import { diaArgentina, parseDateSafe, partesArgentina } from '@/src/utils/date'
import { useAhoraArgentina } from '@/src/utils/useAhoraArgentina'

const horaDe = (ms: number) => {
  const p = partesArgentina(ms)
  return `${String(p.hora).padStart(2, '0')}:${String(p.minuto).padStart(2, '0')}`
}

/**
 * Consola del chofer (plan §11, lámina ChoferRuta). Muestra qué cobrar por parada y el total del día (lo decide
 * el servidor). La entrega va por la operación única `entregar` (cobro mixto, fotos, firma, devolución); un
 * "no se pudo entregar" sigue por `reportar-parada`.
 */
export default function ConsolaChoferScreen() {
  const c = useColors()
  const router = useRouter()
  const menu = useMenuLeading()
  const { id } = useLocalSearchParams<{ id?: string }>()
  const { user, canDo, hasCapability, isSuperAdmin } = useAuthStore()
  // Sin permiso de viajes no se consulta nada: el servidor respondería 403. La oficina que arma
  // viajes (CAP_ARMAR_VIAJES) también abre una hoja (GET hojas-ruta/{id}).
  const puedeVerViajes = canDo('MOD_VIAJES', 'read') || hasCapability('CAP_ARMAR_VIAJES')
  // El inicio del chofer es esta misma pantalla; el resto vuelve a los pedidos de logística.
  const volverA = esChofer(canDo) ? '/(tabs)' : '/(tabs)/logistica/pedidos'
  const { activeTrip, setActiveTrip, clearActiveTrip, updateStopStatus } = useLogisticaStore()
  const [rutaElegida, setRutaElegida] = useState<string | null>(null)
  // La hoja que el chofer acaba de dejar con "Cambiar de ruta": la lista vieja no la vuelve a elegir sola.
  const [descartada, setDescartada] = useState<string | null>(null)
  const qc = useQueryClient()
  // "¡Llegué!" abre primero la pantalla de la parada; de ahí se pasa al reporte (entregué todo / no pude entregar).
  const [llegue, setLlegue] = useState<{ parada: ParadaDto; numero: number } | null>(null)
  const [reportando, setReportando] = useState<{ parada: ParadaDto; numero: number; resultado: Resultado } | null>(null)
  // Sin señal el chofer sigue trabajando: lo que reporta queda en la cola del teléfono y sale solo (EnvioConsolaSinSenal).
  const enLinea = useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
  )
  const [revisadoA, setRevisadoA] = useState(() => Date.now())
  /** Lámina chofer-06: la entrega que acaba de quedar registrada. */
  const [lista, setLista] = useState<{ parada: ParadaDto; cobrado: number; piezas: number; guardada: boolean } | null>(null)
  const [errorReporte, setErrorReporte] = useState<string | null>(null)
  const [pedido, setPedido] = useState<ParadaDto | null>(null)
  const [finalizando, setFinalizando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  /** chofer-07-estados, "Guardado sin señal": lo último que se reportó quedó en el teléfono. */
  const [guardado, setGuardado] = useState(false)
  const [notaCargando, setNotaCargando] = useState(false)

  // Sin id de navegación, un viaje cerrado que quedó guardado no secuestra la consola.
  useEffect(() => {
    const guardado = useLogisticaStore.getState().activeTrip
    const cerrado = esEstadoHojaRuta(guardado?.estado, 'Finalizada', 'Cancelada')
    if (!id && cerrado) clearActiveTrip()
  }, [id, clearActiveTrip])

  const objetivo = id || activeTrip?.id || rutaElegida || ''
  // El servidor devuelve todo el historial del chofer: se piden solo las de hoy (día argentino) y sin las canceladas.
  const hoy = diaArgentina(useAhoraArgentina())
  const buscar = puedeVerViajes && !id && !activeTrip?.id && !!user?.id
  const rutas = useHojasDeRuta({ choferId: user?.id, fecha: hoy }, { enabled: buscar })
  // Un viaje en curso que salió otro día (pasada la medianoche, sin cerrar) sigue siendo del chofer: se pide aparte, sin fecha.
  const enCurso = useHojasDeRuta({ choferId: user?.id, estado: EstadoHojaRuta.EnCurso }, { enabled: buscar })
  const rutasDeHoy = useMemo(() => {
    const vistas = new Set<string>()
    return [...(enCurso.data ?? []), ...(rutas.data ?? [])].filter((r) => {
      if (esEstadoHojaRuta(r.estado, 'Cancelada') || vistas.has(r.id)) return false
      vistas.add(r.id)
      return true
    })
  }, [rutas.data, enCurso.data])
  useEffect(() => {
    if (id || activeTrip?.id) return
    // Un viaje en curso manda: hay que cerrarlo antes de arrancar otro.
    const abiertas = rutasDeHoy.filter((r) => esEstadoHojaRuta(r.estado, 'EnCurso'))
    const unica = abiertas.length === 1 ? abiertas[0] : rutasDeHoy.length === 1 ? rutasDeHoy[0] : null
    if (unica && unica.id !== descartada) setRutaElegida(unica.id ?? null)
  }, [rutasDeHoy, id, activeTrip?.id, descartada])

  const remota = useHojaRuta(puedeVerViajes ? objetivo : '')
  useEffect(() => {
    if (remota.data) setActiveTrip(remota.data)
  }, [remota.data, setActiveTrip])

  const cola = useColaConsola()
  const reportar = useReportarParada()
  const entregar = useEntregarParada()
  // Una clave por parada, la misma en cada reintento (también si se cierra y reabre la entrega):
  // si la respuesta se perdió, el servidor contesta lo que ya registró en vez de cargarlo dos veces.
  const claves = useRef(new Map<string, string>())
  const claveDe = (paradaId: string) => {
    const guardada = claves.current.get(paradaId)
    if (guardada) return guardada
    const nueva = nuevaClaveIdempotencia()
    claves.current.set(paradaId, nueva)
    return nueva
  }
  // Guarda síncrona: un doble toque llega antes de que `isPending` se vea en pantalla.
  const reportandoYa = useRef(false)
  const iniciar = useIniciarHojaRuta()
  const finalizar = useFinalizarHojaRuta()

  // El guardado sirve sin señal, pero solo si es el viaje pedido; si no, manda el servidor.
  const viaje = activeTrip && activeTrip.id === objetivo ? activeTrip : remota.data ?? null

  if (!puedeVerViajes) {
    return (
      <RequirePermission module="MOD_VIAJES" action="read" mode="screen">
        {null}
      </RequirePermission>
    )
  }

  // chofer-07-estados: bloques con la forma real de la pantalla; el texto dice qué se espera.
  if ((remota.isLoading || ((rutas.isLoading || enCurso.isLoading) && !objetivo)) && !viaje) {
    return (
      <View accessibilityLabel="Cargando la hoja de ruta" accessibilityLiveRegion="polite" style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar title="Viaje de hoy" leading={menu} />
        <View style={{ padding: space[4], gap: space[3] }}>
          <View style={{ height: 24, width: '60%', borderRadius: radii.campo, backgroundColor: c.surface2 }} />
          <View style={{ height: 12, borderRadius: radii.pastilla, backgroundColor: c.surface2 }} />
          <View style={{ height: 220, borderRadius: radii.tarjeta, backgroundColor: c.surface2 }} />
          <Text style={{ ...typeScale.cuerpo, color: c.textSecondary, textAlign: 'center' }}>Buscando tu viaje…</Text>
        </View>
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
    const conError = remota.isError || rutas.isError || enCurso.isError
    const revisar = async () => {
      safeHaptics.impact('light')
      await Promise.all([rutas.refetch(), enCurso.refetch(), remota.refetch()])
      setRevisadoA(Date.now())
    }
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar title="Viaje de hoy" leading={leading} />
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space[4], gap: space[4] }}
          refreshControl={<RefreshControl refreshing={rutas.isRefetching || enCurso.isRefetching} onRefresh={revisar} />}
        >
          <View accessibilityRole={conError ? 'alert' : undefined} style={{ alignItems: 'center', gap: space[3] }}>
            <View style={{ width: 96, height: 96, borderRadius: radii.pastilla, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
              {conError || !enLinea ? <WifiOff size={40} color={c.textSecondary} /> : <Phone size={40} color={c.textSecondary} />}
            </View>
            <Text accessibilityRole="header" style={{ ...typeScale.titulo, fontSize: 24, lineHeight: 32, color: c.text, textAlign: 'center' }}>
              {conError ? 'No pudimos traer tu viaje' : 'Hoy no tenés viaje'}
            </Text>
            <Text style={{ ...typeScale.cuerpo, color: c.textSecondary, textAlign: 'center' }}>
              {conError ? 'Revisá la señal y probá de nuevo.' : 'No tenés una hoja de ruta para hoy ni en curso.'}
            </Text>
            {!conError ? (
              <Text style={{ ...typeScale.secundario, color: c.textSecondary, textAlign: 'center' }}>{`Última revisión: ${horaDe(revisadoA)}`}</Text>
            ) : null}
          </View>
          {/* TODO API: el número de Logística no tiene campo hoy; cuando llegue de la config va "Llamar a Logística" (urlLlamar). */}
          <Button size="xl" icon={RefreshCw} label={conError ? 'Probar de nuevo' : 'Revisar de nuevo'} loading={rutas.isRefetching || enCurso.isRefetching} onPress={revisar} />
          <Button size="xl" label="Volver" variant="secundario" onPress={() => router.replace(volverA as never)} />
        </ScrollView>
      </View>
    )
  }

  // Lo reportado sin señal que todavía no salió ya cuenta como hecho, aunque el servidor aún no lo sepa.
  const deEsteViaje = cola.items.filter((a) => a.hojaDeRutaId === viaje.id)
  const sinMandar = deEsteViaje.filter((a) => a.estado.tipo === 'esperando').length
  const detalles = conAccionesEnCola((viaje.detalles ?? []) as ParadaDto[], deEsteViaje)
  const resumen = resumenRuta(detalles)
  const finalizada = esEstadoHojaRuta(viaje.estado, 'Finalizada')
  // Documentada (confirmada con remitos, sin salir) se inicia igual que Programada.
  const programada = esEstadoHojaRuta(viaje.estado, 'Programada', 'Documentada')
  // La oficina puede cancelar una hoja mientras no salió (#860): ya no se inicia ni se reporta.
  const cancelada = esEstadoHojaRuta(viaje.estado, 'Cancelada')
  // Solo el chofer asignado (o el administrador de sistemas) reporta; el servidor lo exige igual.
  const soloLectura = !isSuperAdmin() && viaje.choferId !== user?.id
  const fecha = parseDateSafe(viaje.fechaSalida)
  const subtitulo = [fecha ? tituloDelDia(fecha) : null, viaje.vehiculoPatente].filter(Boolean).join(' · ')
  // El manifiesto existe desde que el viaje arranca; antes daría 404.
  const conManifiesto = esEstadoHojaRuta(viaje.estado, 'EnCurso') || finalizada

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

  const usuarioId = user?.id ?? ''
  const guardarEntrega = (parada: ParadaDto, cuerpo: CuerpoEntregaParada, cobrado: number) =>
    encolarAccion(usuarioId, {
      clave: cuerpo.claveIdempotencia ?? nuevaClaveIdempotencia(), hojaDeRutaId: viaje.id, paradaId: parada.id, clienteNombre: parada.clienteNombre,
      tipo: 'entrega', cuerpo, cobrado, conDevolucion: !!cuerpo.devolucion,
    })

  const confirmarReporte = async (r: ReporteParada) => {
    if (!reportando || reportandoYa.current) return
    reportandoYa.current = true
    setErrorReporte(null)
    const { parada } = reportando
    if (r.entregado) {
      try {
        const cuerpo = { ...r.entrega, claveIdempotencia: claveDe(parada.id) }
        const cobrado = (r.entrega.cobro?.lineas ?? []).reduce((t, l) => t + (l.monto ?? 0), 0)
        const piezas = piezasDeParada(parada).total
        // Sin señal no se llama al servidor: queda en el teléfono con la misma clave y sale sola al volver.
        const guardada = !onlineManager.isOnline()
        if (guardada) guardarEntrega(parada, cuerpo, cobrado)
        else await entregar.mutateAsync({ hojaDeRutaId: viaje.id, paradaId: parada.id, cuerpo })
        updateStopStatus(parada.id, { delivered: true, observations: r.entrega.observaciones ?? undefined })
        setLista({ parada, cobrado, piezas, guardada })
        setReportando(null)
      } catch (e) {
        if (esFallaDeRed(e)) {
          // El pedido no llegó aunque el teléfono creyera tener señal: igual que sin señal; la misma clave evita duplicar.
          const cobrado = (r.entrega.cobro?.lineas ?? []).reduce((t, l) => t + (l.monto ?? 0), 0)
          guardarEntrega(parada, { ...r.entrega, claveIdempotencia: claveDe(parada.id) }, cobrado)
          updateStopStatus(parada.id, { delivered: true, observations: r.entrega.observaciones ?? undefined })
          setLista({ parada, cobrado, piezas: piezasDeParada(parada).total, guardada: true })
          setReportando(null)
          reportandoYa.current = false
          return
        }
        const fallo = clasificarFalloEntrega(e)
        if (fallo.tipo === 'claveUsada') claves.current.set(parada.id, nuevaClaveIdempotencia())
        if (fallo.tipo === 'yaRegistrada') {
          // Un intento anterior ya la registró (quizás con otros datos): manda lo que guardó el servidor.
          setReportando(null)
          setAviso(fallo.mensaje)
          remota.refetch()
        } else {
          setErrorReporte(fallo.mensaje)
        }
      } finally {
        reportandoYa.current = false
      }
      return
    }
    const cuerpo = { entregado: false as const, motivoRechazo: r.motivoRechazo, observaciones: r.observaciones, evidenciaUrl: r.evidenciaUrl }
    const guardarNoEntrega = () => {
      encolarAccion(usuarioId, {
        clave: nuevaClaveIdempotencia(), hojaDeRutaId: viaje.id, paradaId: parada.id, clienteNombre: parada.clienteNombre,
        tipo: 'noEntrega', cuerpo,
      })
      updateStopStatus(parada.id, { delivered: false, observations: r.observaciones, reason: r.motivoRechazo })
      setGuardado(true)
      setReportando(null)
    }
    try {
      if (!onlineManager.isOnline()) {
        guardarNoEntrega()
        return
      }
      await reportar.mutateAsync({ hojaDeRutaId: viaje.id, paradaId: parada.id, ...cuerpo })
      updateStopStatus(parada.id, { delivered: false, observations: r.observaciones, reason: r.motivoRechazo })
      setGuardado(false)
      setReportando(null)
    } catch (e) {
      if (esFallaDeRed(e)) guardarNoEntrega()
      else setErrorReporte(mensajeDelServidor(e, 'No se pudo reportar la parada.'))
    } finally {
      reportandoYa.current = false
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
      // Un 409 puede ser que la oficina la canceló o la cambió: se vuelve a pedir lo que dice el servidor.
      remota.refetch()
      qc.invalidateQueries({ queryKey: logisticaKeys.hojasRuta() })
      setAviso(mensajeDelServidor(e, accion === 'iniciar' ? 'No se pudo iniciar el recorrido.' : 'No se pudo finalizar el viaje.'))
    }
  }

  const porcentaje = resumen.total > 0 ? Math.round((resumen.entregadas / resumen.total) * 100) : 0
  // chofer-01-viaje: progreso y total a cobrar del día arriba de la próxima parada.
  const cabecera = (
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space[2] }}>
        <Text style={{ ...typeScale.seccion, color: c.text }}>{`${resumen.entregadas} de ${resumen.total} entregadas`}</Text>
        <Text style={{ ...typeScale.secundario, ...importe, color: c.textSecondary }}>{`${porcentaje} %`}</Text>
      </View>
      <Progress value={resumen.entregadas} max={resumen.total} accessibilityLabel="Entregas hechas" />
      {/* Lo calcula el servidor; un servidor anterior no lo manda y no se muestra. */}
      {viaje.totalMontoCobrar != null ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space[2] }}>
          <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>A cobrar hoy</Text>
          <Text maxFontSizeMultiplier={1.3} style={{ ...typeScale.titulo, ...importe, fontSize: 28, lineHeight: 34, color: c.text }}>{formatImporte(viaje.totalMontoCobrar)}</Text>
        </View>
      ) : null}
      <ColaConsola acciones={deEsteViaje} />
      {/* Los km son de la última ruta calculada: sin recalcular serían los del plan anterior. */}
      {viaje.rutaCalculada === true && viaje.distanciaTotalMetros > 0 ? (
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`Recorrido ${formatDistancia(viaje.distanciaTotalMetros)}`}</Text>
      ) : null}
    </View>
  )
  const avisos = (
    <View style={{ gap: space[2] }}>
      {/* chofer-01-viaje--sin-senal: se sigue trabajando; lo reportado queda en el teléfono y sale solo al volver. */}
      {!enLinea ? (
        <Notice tone="advertencia" title="Sin señal.">Seguí trabajando: se manda solo cuando vuelva.</Notice>
      ) : null}
      {guardado && sinMandar > 0 ? <Notice tone="info" title="Guardado sin señal.">Se manda cuando haya señal.</Notice> : null}
      {soloLectura ? <Notice tone="info">Esta hoja de ruta es de otro chofer: solo podés verla.</Notice> : null}
      {finalizada ? <Notice tone="exito" title="Viaje finalizado.">Quedó cerrado en el sistema.</Notice> : null}
      {cancelada ? <Notice tone="info" title="Hoja cancelada.">La oficina canceló esta hoja de ruta antes de salir.</Notice> : null}
      {/* `=== false`: un servidor anterior no manda el campo y no se avisa nada. */}
      {viaje.rutaCalculada === false && !finalizada && !cancelada ? (
        <Notice tone="info" title="Ruta sin recalcular.">La oficina cambió las paradas: el orden puede no ser el más corto.</Notice>
      ) : null}
      {aviso ? <Notice tone="peligro">{aviso}</Notice> : null}
    </View>
  )

  const motivoSinMandar = `Falta mandar ${sinMandar} ${sinMandar === 1 ? 'acción' : 'acciones'}: esperá la señal para finalizar.`
  const todasReportadas = resumen.total > 0 && resumen.hechas === resumen.total
  const pie = soloLectura ? null : programada ? (
    <Button size="xl" label="Iniciar recorrido" loading={iniciar.isPending} onPress={() => accionViaje('iniciar')} />
  ) : finalizada || cancelada ? (
    !id ? (
      <Button size="xl" label="Cambiar de ruta" variant="secundario" onPress={() => {
        setDescartada(viaje.id)
        clearActiveTrip()
        setRutaElegida(null)
        qc.invalidateQueries({ queryKey: logisticaKeys.hojasRuta() })
      }} />
    ) : null
  ) : esEstadoHojaRuta(viaje.estado, 'EnCurso') && todasReportadas ? (
    sinMandar > 0 ? (
      <View style={{ gap: space[2] }}>
        <Button size="xl" label="Finalizar viaje" disabled onPress={() => undefined} />
        <MotivoDeshabilitado>{motivoSinMandar}</MotivoDeshabilitado>
      </View>
    ) : (
      <Button size="xl" label="Finalizar viaje" onPress={() => setFinalizando(true)} />
    )
  ) : null

  return (
    <RequirePermission module="MOD_VIAJES" action="read" mode="screen">
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar title="Viaje de hoy" subtitle={subtitulo || undefined} leading={leading} actions={acciones} />
        <HojaDeRutaVista
          resumen={resumen}
          soloLectura={soloLectura}
          puedeReportar={esEstadoHojaRuta(viaje.estado, 'EnCurso')}
          cabecera={cabecera}
          avisos={avisos}
          onLlegue={(p) => {
            setErrorReporte(null)
            setLlegue({ parada: p, numero: resumen.proxima?.numero ?? 0 })
          }}
          onComoLlegar={(p) => abrir(urlComoLlegar(p.direccion))}
          onLlamar={(p) => abrir(urlLlamar(p.telefono))}
          puedeLlamar={(p) => urlLlamar(p.telefono) !== null}
          onVerPedido={setPedido}
          onNota={compartirNota}
          notaCargando={notaCargando}
          pie={pie}
        />
        {llegue ? (
          <LlegueParada
            key={llegue.parada.id}
            parada={llegue.parada}
            onVolver={() => setLlegue(null)}
            onEntregueTodo={() => {
              setReportando({ ...llegue, resultado: 'entregado' })
              setLlegue(null)
            }}
            onNoPudeEntregar={() => {
              setReportando({ ...llegue, resultado: 'noEntregado' })
              setLlegue(null)
            }}
          />
        ) : null}
        {reportando ? (
          <ReportarParada
            key={reportando.parada.id}
            resultadoInicial={reportando.resultado}
            hojaDeRutaId={viaje.id}
            parada={reportando.parada}
            numero={reportando.numero}
            enviando={reportar.isPending || entregar.isPending}
            exigeFotoRemito={viaje.exigeFotoRemitoAlEntregar === true}
            error={errorReporte}
            onCerrar={() => setReportando(null)}
            onConfirmar={confirmarReporte}
          />
        ) : null}
        {lista ? (
          <EntregaLista
            parada={lista.parada}
            cobrado={lista.cobrado}
            piezas={lista.piezas}
            hechas={resumen.entregadas}
            total={resumen.total}
            siguiente={resumen.proxima}
            onSiguiente={() => setLista(null)}
            sinSenal={lista.guardada}
            onTermine={() => {
              setLista(null)
              // Con acciones sin mandar el servidor rechazaría el cierre: el pie muestra cuántas faltan.
              if (sinMandar === 0) setFinalizando(true)
            }}
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
