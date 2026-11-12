import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { LayoutGrid, List, SlidersHorizontal } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { BottomSheet, Button, Casilla } from '@/core/ui/fw'
import { mostrarNumero } from '@/core/utils/numero'
import type { StockResumen } from '../hooks/useStockPorDeposito'
import {
  ESTADOS_STOCK,
  ESTADO_STOCK_LABEL,
  SIN_FILTROS,
  contarFiltros,
  textoBotonFiltros,
  type EstadoStock,
  type FiltrosDeStock,
} from '../lib/stock-presentacion'
import type { VistaDeStock } from './TotalesDeStock'

/** Opciones que se ven de entrada por grupo; el resto detrás de "Ver todas" (web LIMITE_VISIBLE). */
const LIMITE_VISIBLE = 8

const VISTAS = [
  { valor: 'tarjetas' as const, label: 'Tarjetas', Icono: LayoutGrid },
  { valor: 'lista' as const, label: 'Lista', Icono: List },
]

/** Tarjetas / Lista con íconos (web InventarioViewSwitcher en el teléfono). El nombre lo lee el lector de pantalla. */
export function SelectorDeVista({ vista, onCambiar }: { vista: VistaDeStock; onCambiar: (v: VistaDeStock) => void }) {
  const c = useColors()
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Cambiar vista de stock" style={{ flexDirection: 'row', gap: space[1], padding: space[1], borderRadius: radii.campo, backgroundColor: c.surface2 }}>
      {VISTAS.map(({ valor, label, Icono }) => {
        const elegido = vista === valor
        return (
          <Pressable
            key={valor}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ selected: elegido, checked: elegido }}
            onPress={() => {
              if (!elegido) onCambiar(valor)
            }}
            android_ripple={{ color: c.border }}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.campo, backgroundColor: elegido ? c.surface : 'transparent' }}
          >
            <Icono size={20} color={elegido ? c.text : c.textSecondary} />
          </Pressable>
        )
      })}
    </View>
  )
}

/** "Filtros" o "Filtros (n activos)": abre la hoja (web FacetasStock en el teléfono). */
export function BotonFiltros({ filtros, onPress }: { filtros: FiltrosDeStock; onPress: () => void }) {
  const c = useColors()
  const n = contarFiltros(filtros)
  const label = textoBotonFiltros(n)
  const activo = n > 0
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={{ color: c.border }}
      style={{
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[2],
        paddingHorizontal: space[4],
        borderRadius: radii.pastilla,
        borderWidth: 1,
        borderColor: activo ? c.brand : c.border,
        backgroundColor: activo ? c.brandSoft : c.surface,
      }}
    >
      <SlidersHorizontal size={18} color={activo ? c.brandInk : c.text} />
      <Text style={[typeScale.cuerpoDestacado, { color: activo ? c.brandInk : c.text }]}>{label}</Text>
    </Pressable>
  )
}

interface Opcion {
  valor: string
  label: string
  /** Conteo del resumen; sin resumen (cargando o con error) no se muestra. */
  cantidad?: number
}

/** Opción con casilla: el nombre accesible lleva el conteo separado por coma ("Sin stock, 34"), no pegado al nombre. */
function OpcionConConteo({ label, cantidad, marcada, onPress }: { label: string; cantidad?: number; marcada: boolean; onPress: () => void }) {
  const c = useColors()
  return (
    <Casilla
      label={label}
      accessibilityLabel={cantidad != null ? `${label}, ${mostrarNumero(cantidad)}` : label}
      marcada={marcada}
      onPress={onPress}
      detalle={cantidad != null ? <Text style={[typeScale.secundario, importe, { color: c.textSecondary }]}>{mostrarNumero(cantidad)}</Text> : null}
    />
  )
}

function Grupo({ titulo, opciones, elegidos, onAlternar }: { titulo: string; opciones: Opcion[]; elegidos: readonly string[]; onAlternar: (valor: string) => void }) {
  const c = useColors()
  const [todas, setTodas] = React.useState(false)
  if (opciones.length === 0) return null
  const visibles = todas ? opciones : opciones.filter((o, i) => i < LIMITE_VISIBLE || elegidos.includes(o.valor))
  return (
    <View style={{ gap: space[1] }}>
      <Text style={[typeScale.etiqueta, { color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 }]}>{titulo}</Text>
      {visibles.map((o) => (
        <OpcionConConteo key={o.valor} label={o.label} cantidad={o.cantidad} marcada={elegidos.includes(o.valor)} onPress={() => onAlternar(o.valor)} />
      ))}
      {opciones.length > LIMITE_VISIBLE ? (
        <Pressable accessibilityRole="button" onPress={() => setTodas((v) => !v)} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={[typeScale.cuerpoDestacado, { color: c.brandInk }]}>{todas ? 'Ver menos' : `Ver todas (${opciones.length})`}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

/** Suma la opción elegida que el resumen ya no trae (omite las de conteo 0): sin esto quedaría puesta sin forma de soltarla. */
function conElegida(opciones: Opcion[], elegida: { valor: string; label: string } | null, hayResumen: boolean): Opcion[] {
  if (!elegida || opciones.some((o) => o.valor === elegida.valor)) return opciones
  return [...opciones, { ...elegida, cantidad: hayResumen ? 0 : undefined }]
}

interface HojaProps {
  visible: boolean
  onCerrar: () => void
  resumen: StockResumen | undefined
  filtros: FiltrosDeStock
  onCambiar: (f: FiltrosDeStock) => void
}

/**
 * Hoja "Filtros" (web FacetasStock): Estado de stock (se suman), Línea y Marca (una de cada una: elegir otra la
 * reemplaza, tocar la elegida la suelta), "Solo sin peso" y "Solo ocultos", cada opción con lo que cuenta el
 * servidor. Se aplican al tocarlos; "Ver n artículos" cierra. Filtrar no cambia datos.
 */
export function HojaDeFiltros({ visible, onCerrar, resumen, filtros, onCambiar }: HojaProps) {
  const c = useColors()
  const hay = !!resumen
  const estados: Opcion[] = ESTADOS_STOCK.map((e) => ({
    valor: e,
    label: ESTADO_STOCK_LABEL[e],
    cantidad: hay ? (resumen?.estados?.find((x) => x.estado === e)?.cantidad ?? 0) : undefined,
  }))
  const lineas = conElegida(
    (resumen?.lineas ?? []).map((l) => ({ valor: l.id, label: l.nombre, cantidad: l.cantidad })),
    filtros.linea ? { valor: filtros.linea.id, label: filtros.linea.nombre } : null,
    hay,
  )
  const marcas = conElegida(
    (resumen?.marcas ?? []).map((m) => ({ valor: m.marca, label: m.nombre, cantidad: m.cantidad })),
    filtros.marca ? { valor: filtros.marca.clave, label: filtros.marca.nombre } : null,
    hay,
  )

  const alternarEstado = (valor: string) => {
    const e = valor as EstadoStock
    onCambiar({ ...filtros, estados: filtros.estados.includes(e) ? filtros.estados.filter((x) => x !== e) : [...filtros.estados, e] })
  }
  const alternarLinea = (id: string) => {
    const nombre = lineas.find((l) => l.valor === id)?.label ?? id
    onCambiar({ ...filtros, linea: filtros.linea?.id === id ? null : { id, nombre } })
  }
  const alternarMarca = (clave: string) => {
    const nombre = marcas.find((m) => m.valor === clave)?.label ?? clave
    onCambiar({ ...filtros, marca: filtros.marca?.clave === clave ? null : { clave, nombre } })
  }
  const articulos = resumen?.totales.articulos

  return (
    <BottomSheet visible={visible} onClose={onCerrar} accessibilityLabel="Filtros de stock">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text accessibilityRole="header" style={[typeScale.seccion, { color: c.text }]}>Filtros</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Limpiar filtros"
          onPress={() => onCambiar(SIN_FILTROS)}
          style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' }}
        >
          <Text style={[typeScale.cuerpoDestacado, { color: c.brandInk }]}>Limpiar</Text>
        </Pressable>
      </View>
      <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: space[4] }}>
        <Grupo titulo="Estado de stock" opciones={estados} elegidos={filtros.estados} onAlternar={alternarEstado} />
        <Grupo titulo="Línea" opciones={lineas} elegidos={filtros.linea ? [filtros.linea.id] : []} onAlternar={alternarLinea} />
        <Grupo titulo="Marca" opciones={marcas} elegidos={filtros.marca ? [filtros.marca.clave] : []} onAlternar={alternarMarca} />
        <View style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: space[2] }}>
          <OpcionConConteo label="Solo sin peso" cantidad={resumen?.totales.sinPeso} marcada={filtros.sinPeso} onPress={() => onCambiar({ ...filtros, sinPeso: !filtros.sinPeso })} />
          <OpcionConConteo label="Solo ocultos" marcada={filtros.soloOcultos} onPress={() => onCambiar({ ...filtros, soloOcultos: !filtros.soloOcultos })} />
        </View>
      </ScrollView>
      <Button label={articulos == null ? 'Ver artículos' : `Ver ${mostrarNumero(articulos)} artículos`} onPress={onCerrar} />
    </BottomSheet>
  )
}
