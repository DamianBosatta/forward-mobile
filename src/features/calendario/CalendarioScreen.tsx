import React, { useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { radii, shadowMd, space, typeScale, useColors, useIsDark, type ChipEstado } from '@/libs/theme'
import { Fab, FormContainer, Notice, StatusChip, TopBar, formatImporte, useMenuLeading } from '@/core/ui/fw'
import { useCalendario, type EventoCalendario } from '@/libs/api-client/calendario'
import { diaDe, nombreLargo, semanaDe, tituloSemana } from './semana'
import { NuevoEventoSheet, type Precarga } from './NuevoEventoSheet'

const CHIP: Record<EventoCalendario['estado'], { estado: ChipEstado; label: string }> = {
  Pendiente: { estado: 'pendiente', label: 'Pendiente' },
  Pagado: { estado: 'entregado', label: 'Pagado' },
  Vencido: { estado: 'porAutorizar', label: 'Vencido' },
  Cancelado: { estado: 'anulado', label: 'Cancelado' },
}

const TIPO: Record<EventoCalendario['tipo'], string> = {
  VencimientoCompra: 'Vencimiento de compra',
  ChequeEmitido: 'Cheque emitido',
  ChequeRecibido: 'Cheque recibido',
  ServicioRecurrente: 'Servicio',
  ObligacionPeriodica: 'Obligación',
  Manual: 'Recordatorio',
}

/** Lámina Calendario: la semana de lunes a domingo (días argentinos) y los eventos del día elegido. */
export function CalendarioScreen({ precarga }: { precarga?: Precarga | null }) {
  const c = useColors()
  const sombra = shadowMd[useIsDark() ? 'dark' : 'light']
  const menu = useMenuLeading()
  const hoy = useMemo(() => diaDe(Date.now()).fecha, [])
  const [semana, setSemana] = useState(0)
  const dias = useMemo(() => semanaDe(Date.now(), semana), [semana])
  const [elegido, setElegido] = useState<string | null>(null)
  const dia = dias.find((d) => d.fecha === elegido) ?? dias.find((d) => d.fecha === hoy) ?? dias[0]
  const [creando, setCreando] = useState(!!precarga)
  // La precarga de una venta vale para el primer evento; después, el botón abre uno en blanco.
  const [conPrecarga, setConPrecarga] = useState(precarga ?? null)
  const q = useCalendario(dias[0].fecha, dias[6].fecha)

  const delDia = (fecha: string) => (q.data ?? []).filter((e) => e.fecha.slice(0, 10) === fecha)
  const eventos = delDia(dia.fecha)
  const irASemana = (n: number) => { setSemana(n); setElegido(null) }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar
        title="Calendario"
        subtitle={tituloSemana(dias)}
        leading={menu}
        actions={[
          { icon: ChevronLeft, accessibilityLabel: 'Semana anterior', onPress: () => irASemana(semana - 1) },
          { icon: ChevronRight, accessibilityLabel: 'Semana siguiente', onPress: () => irASemana(semana + 1) },
        ]}
      />
      <View accessibilityRole="radiogroup" accessibilityLabel="Día de la semana" style={{ flexDirection: 'row', gap: space[1], padding: space[3], backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border }}>
        {dias.map((d) => {
          const activo = d.fecha === dia.fecha
          const n = delDia(d.fecha).length
          return (
            <Pressable
              key={d.fecha}
              onPress={() => setElegido(d.fecha)}
              accessibilityRole="radio"
              accessibilityLabel={`${d.corto} ${d.numero}, ${n} ${n === 1 ? 'evento' : 'eventos'}`}
              accessibilityState={{ checked: activo }}
              style={{ flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: radii.campo, borderWidth: activo ? 2 : 0, borderColor: c.brand, backgroundColor: activo ? c.brandSoft : 'transparent' }}
            >
              <Text style={{ ...typeScale.etiqueta, color: activo ? c.brandInk : c.textSecondary }}>{d.corto}</Text>
              <Text style={{ ...typeScale.cuerpoDestacado, color: activo ? c.brandInk : c.text }}>{d.numero}</Text>
              <View style={{ flexDirection: 'row', gap: 2, height: 6 }}>
                {Array.from({ length: Math.min(n, 3) }, (_, i) => (
                  <View key={i} style={{ width: 6, height: 6, borderRadius: radii.pastilla, backgroundColor: c.brand }} />
                ))}
              </View>
            </Pressable>
          )
        })}
      </View>
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[3], paddingBottom: space[12] * 2 }}>
        <FormContainer style={{ gap: space[3] }}>
          <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>
            {`${nombreLargo(dia).split(' de ')[0]}${dia.fecha === hoy ? ' · hoy' : ''}`}
          </Text>
          {q.isLoading ? (
            <ActivityIndicator color={c.brand} accessibilityLabel="Cargando el calendario" />
          ) : q.isError ? (
            <Notice tone="peligro">No se pudo cargar el calendario.</Notice>
          ) : eventos.length === 0 ? (
            <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>No hay eventos este día.</Text>
          ) : (
            eventos.map((e) => {
              const chip = CHIP[e.estado]
              return (
                <View key={e.clave} accessible accessibilityLabel={`${e.titulo}, ${chip?.label ?? e.estado}`} style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[4], gap: space[1], ...sombra }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2] }}>
                    <Text style={{ ...typeScale.cuerpoDestacado, color: c.text, flex: 1 }}>{e.titulo}</Text>
                    {chip ? <StatusChip estado={chip.estado} label={chip.label} /> : null}
                  </View>
                  <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
                    {[TIPO[e.tipo] ?? e.tipo, e.descripcion, e.monto != null ? formatImporte(e.monto) : null].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              )
            })
          )}
          <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
            Ves tus eventos personales. Los vencimientos de cheques y compras aparecen solo si tu puesto los puede ver.
          </Text>
        </FormContainer>
      </ScrollView>
      <Fab accessibilityLabel="Nuevo evento" onPress={() => setCreando(true)} />
      {creando ? (
        <NuevoEventoSheet
          fecha={dia.fecha}
          precarga={conPrecarga}
          onCerrar={() => { setCreando(false); setConPrecarga(null) }}
          onCreado={(fecha) => {
            setCreando(false)
            setConPrecarga(null)
            // Muestra el día del evento nuevo, aunque caiga en otra semana.
            setSemana(semana + Math.floor((Date.parse(fecha) - Date.parse(dias[0].fecha)) / (7 * 24 * 60 * 60 * 1000)))
            setElegido(fecha)
          }}
        />
      ) : null}
    </View>
  )
}
