import React, { useMemo, useRef, useState } from 'react'
import { ScrollView, Text, View, type ScrollViewInstance } from 'react-native'
import { Plus } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { space, typeScale, useColors } from '@/libs/theme'
import { Button, FormContainer, Notice, TopBar, useMenuLeading } from '@/core/ui/fw'
import { EstadoDePantalla, textoSinConexion } from '@/core/ui/fw/EstadoDePantalla'
import { Esqueletos } from '@/features/clientes/components/Esqueletos'
import { esFallaDeRed } from '@/core/api/errores'
import { useSinConexionSinDatos } from '@/features/ventas/lib/sinConexion'
import { CalendarioAvisosTabs } from '@/core/ui/fw/CalendarioAvisosTabs'
import { usePermissions } from '@/core/auth/RequirePermission'
import { useResponsive } from '@/libs/useResponsive'
import { PanelAvisos } from '@/features/notificaciones/PanelAvisos'
import { useCalendario, type EventoCalendario } from '@/libs/api-client/calendario'
import { useAhoraArgentina } from '@/core/utils/useAhoraArgentina'
import { diaDe, mesDelDia, semanaDelDia, sumarDias, tituloDia, tituloMes, tituloSemanaCorta } from './semana'
import { tiposOfrecidos } from './presentacion'
import { agruparPorDia, filtrarPorDeposito, opcionesDeDeposito, TODOS_LOS_DEPOSITOS } from './resumen'
import { cargarVista, guardarVista, type Vista } from './vista'
import { useEntregasDelCalendario } from './entregas'
import { ControlesCalendario } from './ControlesCalendario'
import { VistaSemanal } from './VistaSemanal'
import { GrillaMensual } from './GrillaMensual'
import { ListaDeEventos } from './ListaDeEventos'
import { NuevoEventoSheet, type Precarga } from './NuevoEventoSheet'
import { EventoSheet } from './EventoSheet'

/** Cuántos días abarca la Agenda, como la web (entra de sobra en el tope de 93 que acepta la API). */
const DIAS_DE_AGENDA = 30
type TipoEvento = EventoCalendario['tipo']

/** El primer día del mes `n` meses después del de `fecha` (YYYY-MM-DD). */
function primeroDelMes(fecha: string, n: number): string {
  const [anio, mes] = fecha.split('-').map(Number)
  const total = anio * 12 + (mes - 1) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`
}

interface Props {
  precarga?: Precarga | null
  onAbrirVenta?: (ventaId: string) => void
  /** Abre el flujo de cobro del cliente de una tarea de cobro. Sin él, la hoja no ofrece cobrar. */
  onCobrar?: (socioId: string) => void
  /** Abre la hoja de "Nuevo evento" al entrar (desde la bandeja de avisos). */
  nuevo?: boolean
  /** Avisos sin leer, para el selector "Calendario | Avisos (n)" del teléfono. */
  avisosSinLeer?: number
  /** Pasa a la bandeja; sin esto no se muestra el selector. */
  onIrAAvisos?: () => void
}

/**
 * Calendario como la web (CalendarioPage): Semana (por defecto, recordada en el teléfono), Mes, Día o Agenda, con
 * filtros por tipo y depósito y colores por estado. Qué trae lo decide el servidor; acá solo se decide qué se ofrece.
 */
export function CalendarioScreen({ precarga, onAbrirVenta, onCobrar, nuevo, avisosSinLeer, onIrAAvisos }: Props) {
  const { isTablet, isTabletLandscape } = useResponsive()
  const c = useColors()
  const insets = useSafeAreaInsets()
  const menu = useMenuLeading()
  const { hasCapability } = usePermissions()
  // La plata de la empresa la ve quien tiene CAP_VER_TESORERIA, la capacidad con la que filtra el servidor (la web, esGestion).
  const esGestion = hasCapability('CAP_VER_TESORERIA')
  const veTodosLosDepositos = hasCapability('CAP_VER_TODOS_LOS_DEPOSITOS')
  const ahora = useAhoraArgentina()
  const hoy = useMemo(() => diaDe(ahora).fecha, [ahora])
  const [vista, setVista] = useState<Vista>(cargarVista)
  // Sin día elegido, el calendario sigue a hoy (también al cruzar la medianoche o al volver a la pantalla).
  const [elegido, setElegido] = useState<string | null>(null)
  const ancla = elegido ?? hoy
  const [apagados, setApagados] = useState<ReadonlySet<TipoEvento>>(new Set())
  const [deposito, setDeposito] = useState(TODOS_LOS_DEPOSITOS)
  const [creando, setCreando] = useState(!!precarga || !!nuevo)
  // La precarga de una venta vale para el primer evento; después, el botón abre uno en blanco.
  const [conPrecarga, setConPrecarga] = useState(precarga ?? null)
  const [abierto, setAbierto] = useState<EventoCalendario | null>(null)

  const semana = useMemo(() => semanaDelDia(ancla), [ancla])
  const mes = useMemo(() => mesDelDia(ancla), [ancla])
  const rango =
    vista === 'mes' ? { desde: mes.desde, hasta: mes.hasta }
      : vista === 'semana' ? { desde: semana[0].fecha, hasta: semana[6].fecha }
        : vista === 'dia' ? { desde: ancla, hasta: ancla }
          : { desde: ancla, hasta: sumarDias(ancla, DIAS_DE_AGENDA - 1) }
  const q = useCalendario(rango.desde, rango.hasta)
  const entregas = useEntregasDelCalendario(rango.desde)

  const ofrecidos = useMemo(() => tiposOfrecidos(esGestion), [esGestion])
  const activos = useMemo(() => new Set(ofrecidos.filter((t) => !apagados.has(t))), [ofrecidos, apagados])
  const porTipo = useMemo(() => (q.data ?? []).filter((e) => activos.has(e.tipo)), [q.data, activos])
  const depositos = useMemo(() => opcionesDeDeposito(porTipo), [porTipo])
  const porDia = useMemo(() => agruparPorDia(filtrarPorDeposito(porTipo, deposito)), [porTipo, deposito])

  const alternar = (t: TipoEvento) => setApagados((prev) => {
    const sig = new Set(prev)
    if (sig.has(t)) sig.delete(t)
    else sig.add(t)
    return sig
  })
  const mover = (sentido: -1 | 1) => setElegido(
    vista === 'mes' ? primeroDelMes(ancla, sentido)
      : sumarDias(ancla, (vista === 'dia' ? 1 : vista === 'agenda' ? DIAS_DE_AGENDA : 7) * sentido),
  )
  const elegirVista = (v: Vista) => { setVista(v); guardarVista(v) }
  /** Tocar un día del mes abre su semana, como la web (sin cambiar la vista recordada). */
  const verSemanaDe = (fecha: string) => { setElegido(fecha); setVista('semana') }

  const titulo = vista === 'mes' ? tituloMes(ancla)
    : vista === 'semana' ? tituloSemanaCorta(semana)
      : vista === 'dia' ? tituloDia(ancla)
        : `Desde ${tituloDia(ancla).toLowerCase()}`

  // Al abrir, la semana se para en hoy (una sola vez: después manda la persona).
  const scroll = useRef<ScrollViewInstance>(null)
  const yDeLaVista = useRef(0)
  const yaSeParo = useRef(false)
  const pararEnHoy = (y: number) => {
    if (yaSeParo.current) return
    yaSeParo.current = true
    scroll.current?.scrollTo({ y: yDeLaVista.current + y, animated: false })
  }

  const sinRed = q.isError && esFallaDeRed(q.error)
  // Sin red y sin nada guardado la consulta queda en pausa (sin error): también es "sin conexión".
  const sinConexionSinDatos = useSinConexionSinDatos(q)
  const reintentar = { label: 'Reintentar', onPress: () => void q.refetch() }
  const contenido = q.isLoading ? (
    // Bloques quietos con la forma de la semana (un día por fila), como las listas de Cuentas y Pagos.
    <Esqueletos bloques={[{ alto: 76 }, { alto: 76 }, { alto: 76 }]} />
  ) : (sinRed || sinConexionSinDatos) && !q.data ? (
    <EstadoDePantalla tipo="sinConexion" titulo="No pudimos cargar el calendario" accion={reintentar} />
  ) : q.isError && !(sinRed && q.data) ? (
    <View style={{ gap: space[3] }}>
      <Notice tone="peligro">No se pudo cargar el calendario.</Notice>
      <Button label={reintentar.label} variant="secundario" onPress={reintentar.onPress} />
    </View>
  ) : vista === 'semana' ? (
    <View onLayout={(e) => { yDeLaVista.current = e.nativeEvent.layout.y }}>
      <VistaSemanal dias={semana} hoy={hoy} porDia={porDia} onAbrir={setAbierto} entregas={entregas} onHoyMedido={pararEnHoy} />
    </View>
  ) : vista === 'mes' ? (
    <>
      <GrillaMensual mes={mes} hoy={hoy} porDia={porDia} onElegirDia={verSemanaDe} entregas={entregas} />
      <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Tocá un día para ver su semana.</Text>
    </>
  ) : (
    <ListaDeEventos
      dias={Array.from({ length: vista === 'dia' ? 1 : DIAS_DE_AGENDA }, (_, i) => sumarDias(ancla, i))}
      hoy={hoy}
      porDia={porDia}
      onAbrir={setAbierto}
      etiqueta={vista === 'dia' ? 'Calendario diario' : 'Agenda'}
    />
  )

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Calendario" leading={menu} />
      {!isTablet && onIrAAvisos ? <CalendarioAvisosTabs actual="calendario" sinLeer={avisosSinLeer} onElegir={onIrAAvisos} /> : null}
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <View style={{ flex: 1 }}>
          <ScrollView ref={scroll} testID="calendario" style={{ flex: 1 }} contentContainerStyle={{ padding: space[4], paddingBottom: space[12] }}>
            <FormContainer style={{ gap: space[3] }}>
              <ControlesCalendario
                vista={vista}
                onVista={elegirVista}
                titulo={titulo}
                onMover={mover}
                onHoy={() => setElegido(null)}
                ofrecidos={ofrecidos}
                activos={activos}
                onAlternar={alternar}
                depositos={veTodosLosDepositos && depositos.length > 0 ? depositos : null}
                deposito={deposito}
                onDeposito={setDeposito}
              />
              {sinRed && q.data ? <Notice tone="advertencia">{textoSinConexion(q.dataUpdatedAt || undefined)}</Notice> : null}
              {contenido}
              <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
                Ves tus eventos personales. Los vencimientos de cheques y compras aparecen solo si tu puesto los puede ver.
              </Text>
            </FormContainer>
          </ScrollView>
          <View style={{ padding: space[4], paddingBottom: space[4] + insets.bottom, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border }}>
            <Button label="Nuevo evento" icon={Plus} onPress={() => setCreando(true)} />
          </View>
        </View>
        {isTabletLandscape ? (
          <View style={{ width: 380, borderLeftWidth: 1, borderLeftColor: c.border }}>
            <PanelAvisos />
          </View>
        ) : null}
      </View>
      {creando ? (
        <NuevoEventoSheet
          fecha={vista === 'mes' ? hoy : ancla}
          precarga={conPrecarga}
          onCerrar={() => { setCreando(false); setConPrecarga(null) }}
          onCreado={(fecha) => {
            setCreando(false)
            setConPrecarga(null)
            setElegido(fecha)
          }}
        />
      ) : null}
      {abierto ? (
        <EventoSheet
          evento={abierto}
          onCerrar={() => setAbierto(null)}
          onMovido={(fecha) => { setAbierto(null); setElegido(fecha) }}
          onAbrirVenta={onAbrirVenta}
          onCobrar={onCobrar}
        />
      ) : null}
    </View>
  )
}
