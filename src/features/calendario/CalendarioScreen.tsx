import React, { useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { space, typeScale, useColors } from '@/libs/theme'
import { Button, FormContainer, Notice, TopBar, useMenuLeading } from '@/core/ui/fw'
import { EstadoDePantalla, textoSinConexion } from '@/core/ui/fw/EstadoDePantalla'
import { esFallaDeRed } from '@/core/api/errores'
import { CalendarioAvisosTabs } from '@/core/ui/fw/CalendarioAvisosTabs'
import { useResponsive } from '@/libs/useResponsive'
import { PanelAvisos } from '@/features/notificaciones/PanelAvisos'
import { useCalendario, type EventoCalendario } from '@/libs/api-client/calendario'
import { useAhoraArgentina } from '@/src/utils/useAhoraArgentina'
import { diaDe, mesDe, moverDia, nombreLargo, rangoCorto, semanaDe } from './semana'
import { MesGrilla } from './MesGrilla'
import { NuevoEventoSheet, type Precarga } from './NuevoEventoSheet'
import { EventoSheet } from './EventoSheet'
import { EventoCard } from './EventoCard'
import { FilaDeDias, textoEventos } from './FilaDeDias'

/** Lámina Calendario: la semana de lunes a domingo (días argentinos) y los eventos del día elegido. */
interface Props {
  precarga?: Precarga | null
  onAbrirVenta?: (ventaId: string) => void
  /** Abre la hoja de "Nuevo evento" al entrar (desde la bandeja de avisos). */
  nuevo?: boolean
  /** Avisos sin leer, para el selector "Calendario | Avisos (n)" del teléfono. */
  avisosSinLeer?: number
  /** Pasa a la bandeja; sin esto no se muestra el selector. */
  onIrAAvisos?: () => void
}

export function CalendarioScreen({ precarga, onAbrirVenta, nuevo, avisosSinLeer, onIrAAvisos }: Props) {
  const { isTablet, isTabletLandscape } = useResponsive()
  const c = useColors()
  const insets = useSafeAreaInsets()
  const menu = useMenuLeading()
  const ahora = useAhoraArgentina()
  const hoy = useMemo(() => diaDe(ahora).fecha, [ahora])
  const [semana, setSemana] = useState(0)
  const [meses, setMeses] = useState(0)
  const dias = useMemo(() => semanaDe(ahora, semana), [ahora, semana])
  const mes = useMemo(() => mesDe(ahora, meses), [ahora, meses])
  const [elegido, setElegido] = useState<string | null>(null)
  // En tablet se ve el mes entero; en teléfono, la semana.
  const desde = isTablet ? mes.desde : dias[0].fecha
  const hasta = isTablet ? mes.hasta : dias[6].fecha
  const dia = isTablet
    ? moverDia(elegido ?? (hoy >= mes.desde && hoy <= mes.hasta ? hoy : mes.semanas[0].find((d) => d.delMes)!.fecha), 0)
    : dias.find((d) => d.fecha === elegido) ?? dias.find((d) => d.fecha === hoy) ?? dias[0]
  const [creando, setCreando] = useState(!!precarga || !!nuevo)
  // La precarga de una venta vale para el primer evento; después, el botón abre uno en blanco.
  const [conPrecarga, setConPrecarga] = useState(precarga ?? null)
  const q = useCalendario(desde, hasta)

  const delDia = (fecha: string) => (q.data ?? []).filter((e) => e.fecha.slice(0, 10) === fecha)
  const eventos = delDia(dia.fecha)
  const irASemana = (n: number) => { setSemana(n); setElegido(null) }
  const irAMes = (n: number) => { setMeses(n); setElegido(null) }
  const [abierto, setAbierto] = useState<EventoCalendario | null>(null)
  /** Muestra un día, aunque caiga en otra semana. */
  const irADia = (fecha: string) => {
    if (isTablet) {
      const hoyP = hoy.split('-').map(Number)
      const p = fecha.split('-').map(Number)
      setMeses((p[0] - hoyP[0]) * 12 + (p[1] - hoyP[1]))
    } else {
      setSemana(semana + Math.floor((Date.parse(fecha) - Date.parse(dias[0].fecha)) / (7 * 24 * 60 * 60 * 1000)))
    }
    setElegido(fecha)
  }

  const sinRed = q.isError && esFallaDeRed(q.error)
  const listaDelDia = (
    <FormContainer style={{ gap: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space[2] }}>
        <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text, flexShrink: 1 }}>
          {`${nombreLargo(dia).split(' de ')[0]}${dia.fecha === hoy ? ' · hoy' : ''}`}
        </Text>
        {q.data && eventos.length > 0 ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{textoEventos(eventos.length)}</Text> : null}
      </View>
      {sinRed && q.data ? <Notice tone="advertencia">{textoSinConexion(q.dataUpdatedAt || undefined)}</Notice> : null}
      {q.isLoading ? (
        <ActivityIndicator color={c.brand} accessibilityLabel="Cargando el calendario" />
      ) : q.isError && !(sinRed && q.data) ? (
        <View style={{ gap: space[3] }}>
          <Notice tone="peligro">No se pudo cargar el calendario.</Notice>
          <Button label="Reintentar" variant="secundario" onPress={() => void q.refetch()} />
        </View>
      ) : eventos.length === 0 ? (
        <EstadoDePantalla tipo="vacio" titulo="No hay eventos este día." accion={{ label: 'Actualizar', onPress: () => void q.refetch() }} />
      ) : (
        eventos.map((e) => <EventoCard key={e.clave} evento={e} onPress={() => setAbierto(e)} />)
      )}
      <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
        Ves tus eventos personales. Los vencimientos de cheques y compras aparecen solo si tu puesto los puede ver.
      </Text>
    </FormContainer>
  )

  const nuevoEvento = <Button label="Nuevo evento" onPress={() => setCreando(true)} />

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar
        title="Calendario"
        subtitle={isTablet ? mes.titulo : rangoCorto(dias)}
        leading={menu}
        actions={isTablet ? [
          { icon: ChevronLeft, accessibilityLabel: 'Mes anterior', onPress: () => irAMes(meses - 1) },
          { icon: ChevronRight, accessibilityLabel: 'Mes siguiente', onPress: () => irAMes(meses + 1) },
        ] : [
          { icon: ChevronLeft, accessibilityLabel: 'Semana anterior', onPress: () => irASemana(semana - 1) },
          { icon: ChevronRight, accessibilityLabel: 'Semana siguiente', onPress: () => irASemana(semana + 1) },
        ]}
      />
      {!isTablet && onIrAAvisos ? <CalendarioAvisosTabs actual="calendario" sinLeer={avisosSinLeer} onElegir={onIrAAvisos} /> : null}
      {isTablet ? (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <ScrollView testID="calendario-mes" style={{ flex: 1 }} contentContainerStyle={{ padding: space[4], gap: space[4], paddingBottom: space[12] * 2 }}>
            <View style={{ alignItems: 'flex-end' }}>{nuevoEvento}</View>
            <MesGrilla mes={mes} elegido={dia.fecha} hoy={hoy} cantidadDelDia={(f) => delDia(f).length} onElegir={setElegido} />
            {listaDelDia}
          </ScrollView>
          {isTabletLandscape ? (
            <View style={{ width: 380, borderLeftWidth: 1, borderLeftColor: c.border }}>
              <PanelAvisos />
            </View>
          ) : null}
        </View>
      ) : (
        <>
          <FilaDeDias dias={dias} elegido={dia.fecha} hoy={hoy} cantidadDelDia={(f) => delDia(f).length} onElegir={setElegido} />
          <ScrollView contentContainerStyle={{ padding: space[4], gap: space[3], paddingBottom: space[12] * 2 }}>
            {listaDelDia}
          </ScrollView>
        </>
      )}
      {!isTablet ? (
        <View style={{ padding: space[4], paddingBottom: space[4] + insets.bottom, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border }}>
          <Button label="Nuevo evento" icon={Plus} onPress={() => setCreando(true)} />
        </View>
      ) : null}
      {creando ? (
        <NuevoEventoSheet
          fecha={dia.fecha}
          precarga={conPrecarga}
          onCerrar={() => { setCreando(false); setConPrecarga(null) }}
          onCreado={(fecha) => {
            setCreando(false)
            setConPrecarga(null)
            irADia(fecha)
          }}
        />
      ) : null}
      {abierto ? (
        <EventoSheet
          evento={abierto}
          onCerrar={() => setAbierto(null)}
          onMovido={(fecha) => { setAbierto(null); irADia(fecha) }}
          onAbrirVenta={onAbrirVenta}
        />
      ) : null}
    </View>
  )
}
