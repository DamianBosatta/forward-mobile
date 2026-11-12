import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { Segmented } from '@/core/ui/fw'
import { FiltroChip } from '@/core/ui/fw/FiltroChip'
import type { EventoCalendario } from '@/libs/api-client/calendario'
import { ESTADOS_DEL_CALENDARIO, ESTILO_ESTADO, ETIQUETA_TIPO } from './presentacion'
import { TODOS_LOS_DEPOSITOS } from './resumen'
import { VISTAS, type Vista } from './vista'
import { PuntoDeEstado } from './PuntoDeEstado'

type TipoEvento = EventoCalendario['tipo']

interface Props {
  vista: Vista
  onVista: (v: Vista) => void
  titulo: string
  onMover: (sentido: -1 | 1) => void
  onHoy: () => void
  ofrecidos: TipoEvento[]
  activos: ReadonlySet<TipoEvento>
  onAlternar: (t: TipoEvento) => void
  /** Solo para quien ve todos los depósitos y si llegó algún evento (como la web). */
  depositos: { valor: string; etiqueta: string }[] | null
  deposito: string
  onDeposito: (valor: string) => void
}

/** Lo de arriba del calendario de la web (CalendarioPage + FiltrosCalendario): vista, período, tipos, depósito y leyenda. */
export function ControlesCalendario(p: Props) {
  const c = useColors()
  const flecha = (Icono: typeof ChevronLeft, label: string, sentido: -1 | 1) => (
    <Pressable onPress={() => p.onMover(sentido)} accessibilityRole="button" accessibilityLabel={label} android_ripple={{ color: c.surface2, borderless: true }} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Icono size={22} color={c.text} />
    </Pressable>
  )
  return (
    <View style={{ gap: space[3] }}>
      <Segmented options={VISTAS} value={p.vista} onChange={p.onVista} accessibilityLabel="Vista del calendario" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
        {flecha(ChevronLeft, 'Anterior', -1)}
        <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={{ ...typeScale.seccion, color: c.text, flex: 1, textAlign: 'center' }}>{p.titulo}</Text>
        {flecha(ChevronRight, 'Siguiente', 1)}
        <Pressable onPress={p.onHoy} accessibilityRole="button" accessibilityLabel="Hoy" android_ripple={{ color: c.surface2 }} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: space[4], borderRadius: radii.pastilla, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surface }}>
          <Text style={{ ...typeScale.secundario, color: c.text }}>Hoy</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Filtrar por tipo" contentContainerStyle={{ gap: space[2] }}>
        {p.ofrecidos.map((t) => <FiltroChip key={t} label={ETIQUETA_TIPO[t]} activo={p.activos.has(t)} onPress={() => p.onAlternar(t)} />)}
      </ScrollView>
      {p.depositos ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Depósito" contentContainerStyle={{ gap: space[2] }}>
          <FiltroChip label="Todos los depósitos" activo={p.deposito === TODOS_LOS_DEPOSITOS} onPress={() => p.onDeposito(TODOS_LOS_DEPOSITOS)} />
          {p.depositos.map((d) => <FiltroChip key={d.valor} label={d.etiqueta} activo={p.deposito === d.valor} onPress={() => p.onDeposito(d.valor)} />)}
        </ScrollView>
      ) : null}
      <View accessibilityLabel="Leyenda de estados" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
        {ESTADOS_DEL_CALENDARIO.map((e) => <PuntoDeEstado key={e} tono={ESTILO_ESTADO[e].tono} texto={ESTILO_ESTADO[e].etiqueta} />)}
      </View>
    </View>
  )
}
