import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { BottomSheet, Button, chipForEstado } from '@/core/ui/fw'
import { FONT, radii, space, typeScale, useColors } from '@/libs/theme'

export interface FiltrosPreparacion {
  /** MetodoEntrega del servidor (va como `MetodoEntrega`). */
  metodo: number | null
  /** Va como `VendedorId`; el nombre es para mostrar el filtro. */
  vendedor: { id: string; nombre: string } | null
  /** EstadoVenta: el servidor no lo filtra, se filtra en el teléfono. */
  estado: number | null
}

export const SIN_FILTROS: FiltrosPreparacion = { metodo: null, vendedor: null, estado: null }

const LOGISTICAS = [
  { valor: 1, label: 'Logística propia' },
  { valor: 2, label: 'Retiro en el local' },
  { valor: 3, label: 'Expreso' },
]
/** Los estados que trae ventas-para-preparacion (sin los no entregados, que tienen su sección). */
const ESTADOS = [2, 3, 4].map((valor) => ({ valor, label: chipForEstado('venta', valor)?.label ?? String(valor) }))

/** "Filtros: Retiro en el local · Lucía Ferreyra"; sin filtros, null. */
export function textoFiltros(f: FiltrosPreparacion): string | null {
  const partes = [
    LOGISTICAS.find((l) => l.valor === f.metodo)?.label,
    f.vendedor?.nombre,
    ESTADOS.find((e) => e.valor === f.estado)?.label,
  ].filter(Boolean)
  return partes.length > 0 ? `Filtros: ${partes.join(' · ')}` : null
}

interface Opcion<T> { valor: T; label: string }

function Grupo<T>({ titulo, opciones, valor, onCambio }: { titulo: string; opciones: Opcion<T>[]; valor: T; onCambio: (v: T) => void }) {
  const c = useColors()
  return (
    <View style={{ gap: space[2] }}>
      <Text style={[typeScale.secundario, { color: c.text, fontFamily: FONT.semibold, fontWeight: '600' }]}>{titulo}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={titulo} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        {opciones.map((o) => {
          const sel = o.valor === valor
          return (
            <Pressable
              key={o.label}
              accessibilityRole="radio"
              accessibilityState={{ checked: sel }}
              onPress={() => onCambio(o.valor)}
              style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: space[4], borderRadius: radii.pastilla, borderWidth: 1, borderColor: sel ? c.brand : c.border, backgroundColor: sel ? c.brandSoft : c.surface }}
            >
              <Text style={[typeScale.secundario, { color: sel ? c.brandInk : c.text }]}>{o.label}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

interface Props {
  visible: boolean
  filtros: FiltrosPreparacion
  onCambio: (f: FiltrosPreparacion) => void
  /** `null`: sin permiso para leer la lista de vendedores; el filtro no se ofrece. */
  vendedores: { id: string; nombre: string }[] | null
  onClose: () => void
}

/** Hoja de filtros de Pedidos por preparar (botón "Filtrar: logística, vendedor, estado" de la lámina). */
export function FiltrosPorPreparar({ visible, filtros, onCambio, vendedores, onClose }: Props) {
  const c = useColors()
  const todos = <T,>(label: string, opciones: Opcion<T>[]): Opcion<T | null>[] => [{ valor: null, label }, ...opciones]
  return (
    <BottomSheet visible={visible} onClose={onClose} accessibilityLabel="Filtrar pedidos">
      <Text accessibilityRole="header" style={[typeScale.seccion, { color: c.text }]}>Filtrar pedidos</Text>
      <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: space[4] }}>
        <Grupo titulo="Logística" opciones={todos('Todas', LOGISTICAS)} valor={filtros.metodo} onCambio={(metodo) => onCambio({ ...filtros, metodo })} />
        {vendedores ? (
          <Grupo
            titulo="Vendedor"
            opciones={todos('Todos', vendedores.map((v) => ({ valor: v.id, label: v.nombre })))}
            valor={filtros.vendedor?.id ?? null}
            onCambio={(id) => onCambio({ ...filtros, vendedor: vendedores.find((v) => v.id === id) ?? null })}
          />
        ) : null}
        <Grupo titulo="Estado" opciones={todos('Todos', ESTADOS)} valor={filtros.estado} onCambio={(estado) => onCambio({ ...filtros, estado })} />
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: space[3] }}>
        <View style={{ flex: 1 }}><Button label="Quitar filtros" variant="secundario" disabled={!textoFiltros(filtros)} onPress={() => onCambio(SIN_FILTROS)} /></View>
        <View style={{ flex: 1 }}><Button label="Listo" onPress={onClose} /></View>
      </View>
    </BottomSheet>
  )
}
