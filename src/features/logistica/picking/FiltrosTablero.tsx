import React from 'react'
import { ScrollView, Text, View } from 'react-native'
import { BottomSheet, Button, pesoSemibold } from '@/core/ui/fw'
import { FiltroChip } from '@/core/ui/fw/FiltroChip'
import { space, typeScale, useColors } from '@/libs/theme'
import { SelectorDia } from '@/features/calendario/SelectorDia'
import { ATAJOS_ENTREGA, METODOS, rangoDeAtajo, type AtajoEntrega, type RangoEntrega } from './tablero'

/** Lo que filtra el tablero: todo viaja al servidor; filtrar no cambia datos. */
export interface FiltrosTablero {
  rango: RangoEntrega
  /** El rango exacto (Desde / Hasta) está abierto aunque coincida con un atajo. */
  exacto: boolean
  /** YYYY-MM-DD elegido en la tira de días; reemplaza al rango. Un atajo o el rango exacto lo limpian. */
  dia: string | null
  metodo: number | null
  vendedor: { id: string; nombre: string } | null
}

export const filtrosDeApertura = (hoy: string): FiltrosTablero => ({ rango: rangoDeAtajo('hoy', hoy), exacto: false, dia: null, metodo: null, vendedor: null })

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const c = useColors()
  return (
    <View style={{ gap: space[2] }}>
      <Text style={{ ...typeScale.secundario, ...pesoSemibold, color: c.text }}>{titulo}</Text>
      <View accessibilityLabel={titulo} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>{children}</View>
    </View>
  )
}

interface Props {
  visible: boolean
  hoy: string
  filtros: FiltrosTablero
  atajo: AtajoEntrega | null
  onCambio: (f: FiltrosTablero) => void
  onLimpiar: () => void
  /** `null`: sin permiso para leer la lista de vendedores; el filtro no se ofrece. */
  vendedores: { lista: { id: string; nombre: string }[]; cargando: boolean; error: boolean } | null
  nombreDeposito?: string
  onClose: () => void
}

/**
 * Hoja del embudo: lo que en la web va arriba del tablero (picking-client.tsx). Entrega con los atajos y el rango
 * exacto, Método de entrega (Todos, Logística, Retiro, Expreso) y Vendedor. Cada cambio se aplica al momento.
 */
export function FiltrosTableroSheet({ visible, hoy, filtros, atajo, onCambio, onLimpiar, vendedores, nombreDeposito, onClose }: Props) {
  const c = useColors()
  const { rango } = filtros
  // El rango exacto arranca del atajo que se estaba mirando; "Todo" no tiene extremos, así que arranca en hoy.
  const desde = rango.desde || hoy
  const hasta = rango.hasta || desde
  const exacto = (d: string, h: string) => onCambio({ ...filtros, exacto: true, dia: null, rango: { desde: d, hasta: h < d ? d : h } })
  return (
    <BottomSheet visible={visible} onClose={onClose} accessibilityLabel="Filtros del tablero">
      <View testID="hoja-filtros" style={{ gap: space[4] }}>
        <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>Filtros</Text>
        <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: space[4] }}>
          <Grupo titulo="Entrega">
            {ATAJOS_ENTREGA.map(({ id, label }) => (
              <FiltroChip key={id} label={label} activo={!filtros.exacto && atajo === id} onPress={() => onCambio({ ...filtros, exacto: false, dia: null, rango: rangoDeAtajo(id, hoy) })} />
            ))}
            <FiltroChip label="Rango exacto" activo={filtros.exacto || (atajo === null && filtros.dia === null)} onPress={() => exacto(desde, hasta)} />
          </Grupo>
          {filtros.exacto || (atajo === null && filtros.dia === null) ? (
            <View style={{ gap: space[2] }}>
              <View testID="rango-desde">
                <SelectorDia fecha={desde} etiqueta="Desde" nota="Primer día de entrega" onCambiar={(d) => exacto(d, hasta)} />
              </View>
              <View testID="rango-hasta">
                <SelectorDia fecha={hasta} etiqueta="Hasta" nota="Último día de entrega" onCambiar={(h) => exacto(desde, h < desde ? desde : h)} />
              </View>
            </View>
          ) : null}
          <Grupo titulo="Método de entrega">
            {METODOS.map((m) => (
              <FiltroChip key={m.label} label={m.label} activo={filtros.metodo === m.valor} onPress={() => onCambio({ ...filtros, metodo: m.valor })} />
            ))}
          </Grupo>
          {vendedores ? (
            <View style={{ gap: space[2] }}>
              <Grupo titulo={nombreDeposito ? `Vendedor de ${nombreDeposito}` : 'Vendedor del depósito'}>
                <FiltroChip label="Todos los vendedores del depósito" activo={filtros.vendedor === null} onPress={() => onCambio({ ...filtros, vendedor: null })} />
                {vendedores.lista.map((v) => (
                  <FiltroChip key={v.id} label={v.nombre} activo={filtros.vendedor?.id === v.id} onPress={() => onCambio({ ...filtros, vendedor: v })} />
                ))}
              </Grupo>
              {vendedores.cargando ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Cargando…</Text> : null}
              {vendedores.error ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>No se pudo cargar la lista de vendedores.</Text> : null}
            </View>
          ) : null}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: space[3] }}>
          <View style={{ flex: 1 }}><Button label="Limpiar" variant="secundario" onPress={onLimpiar} /></View>
          <View style={{ flex: 1 }}><Button label="Ver pedidos" onPress={onClose} /></View>
        </View>
      </View>
    </BottomSheet>
  )
}
