import React, { memo, useCallback, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronRight } from 'lucide-react-native'
import { importe, maxFontScale, radii, space, typeScale, useColors, type ChipEstado } from '@/libs/theme'
import { Entrada, StatusChip, TopBar, useColumnaDeFormulario, useMenuLeading } from '@/core/ui/fw'
import { PressableFx } from '@/core/ui/fw/PressableFx'
import { EstadoDePantalla } from '@/core/ui/fw/EstadoDePantalla'
import { LISTA_LARGA_PROPS } from '@/core/ui/listaLargaProps'
import { FiltroChip } from '@/core/ui/fw/FiltroChip'
import { fechaCorta } from '@/core/utils/fecha'
import { useHojasDeRuta } from '@/libs/api-client/logistica'
import type { HojaRutaListItemDto } from '@/libs/api-client/types'
import { ESTADO_HOJA_RUTA, resolverEstadoHojaRuta } from '@/libs/reglas/estados'

/** Filtros de la lista; el primero es el que cuenta el cuadro "Rutas activas" de Inicio. */
const FILTROS = [
  { clave: 'enCurso', label: 'En curso', estado: ESTADO_HOJA_RUTA.EnCurso.valor, vacio: 'No hay hojas de ruta en curso.' },
  { clave: 'programada', label: 'Programadas', estado: ESTADO_HOJA_RUTA.Programada.valor, vacio: 'No hay hojas de ruta programadas.' },
  { clave: 'finalizada', label: 'Finalizadas', estado: ESTADO_HOJA_RUTA.Finalizada.valor, vacio: 'No hay hojas de ruta finalizadas.' },
] as const

/** Tono de la tabla de estados a chip de la lámina F4. */
const CHIP_DE_TONO: Record<string, ChipEstado> = { pendiente: 'pendiente', enruta: 'enCurso', entregada: 'entregado', anulada: 'anulado' }

const codigoDe = (id: string) => `Hoja #${id.substring(0, 8).toUpperCase()}`
const entregas = (n: number) => `${n} ${n === 1 ? 'entrega' : 'entregas'}`

/** Bloque de cantidad de la fila (receta .qty del FWD): lime con texto ink; en una hoja hecha, tinta con texto lime. */
function BloqueEntregas({ cantidad, hecha }: { cantidad: number; hecha: boolean }) {
  const c = useColors()
  const texto = hecha ? c.lime : c.ink
  return (
    <View accessible={false} testID="bloque-entregas" style={{ width: 76, height: 60, paddingHorizontal: space[1], borderRadius: radii.cantidad, backgroundColor: hecha ? c.ink : c.lime, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
      <Text maxFontSizeMultiplier={maxFontScale} style={[typeScale.titulo, importe, { color: texto }]}>{cantidad}</Text>
      <Text maxFontSizeMultiplier={maxFontScale} style={[typeScale.etiquetaChip, { color: texto }]}>{cantidad === 1 ? 'entrega' : 'entregas'}</Text>
    </View>
  )
}

/** Fila con su propia tarjeta (radii.fila, sin bordes); la hoja Finalizada usa la receta "hecho": teal con texto ink. */
const FilaDeHoja = memo(function FilaDeHoja({ hoja, indice, onAbrir }: { hoja: HojaRutaListItemDto; indice: number; onAbrir: (id: string) => void }) {
  const c = useColors()
  const estado = resolverEstadoHojaRuta(hoja.estado)
  const hecha = estado?.info.tono === 'entregada'
  const etiqueta = estado ? (estado.nombre === 'EnCurso' ? 'En curso' : estado.info.etiqueta) : null
  const apagado = hecha ? c.ink : c.textSecondary
  return (
    <Entrada tipo="fila" indice={indice} style={{ marginBottom: space[2] }}>
      <PressableFx
        accessibilityRole="button"
        accessibilityLabel={`${codigoDe(hoja.id)}, ${hoja.choferNombre}, ${hoja.vehiculoPatente}, ${entregas(hoja.cantidadParadas)}`}
        onPress={() => onAbrir(hoja.id)}
        android_ripple={{ color: c.surfaceAlt }}
        style={{ minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], paddingLeft: space[3], paddingRight: space[4], overflow: 'hidden', borderRadius: radii.fila, backgroundColor: hecha ? c.teal : c.surface }}
      >
        <BloqueEntregas cantidad={hoja.cantidadParadas} hecha={hecha} />
        <View style={{ flex: 1, minWidth: 0, gap: space[1] }}>
          <Text style={[typeScale.secundario, { color: apagado }]} numberOfLines={1}>{[codigoDe(hoja.id), fechaCorta(hoja.fechaSalida)].filter(Boolean).join(' · ')}</Text>
          <Text style={[typeScale.cuerpoDestacado, { color: hecha ? c.ink : c.text }]} numberOfLines={1}>{hoja.choferNombre}</Text>
          <Text style={[typeScale.secundario, { color: apagado }]} numberOfLines={1}>{`Vehículo ${hoja.vehiculoPatente}`}</Text>
        </View>
        {estado && etiqueta ? <StatusChip estado={CHIP_DE_TONO[estado.info.tono] ?? 'pendiente'} label={etiqueta} sobreTeal={hecha} /> : null}
        <ChevronRight size={20} color={apagado} />
      </PressableFx>
    </Entrada>
  )
})

/** Hojas de ruta de toda la empresa (MOD_VIAJES:Read). Por defecto las En curso, lo que cuenta "Rutas activas" de Inicio. */
export function HojasDeRutaScreen() {
  const c = useColors()
  const router = useRouter()
  const menu = useMenuLeading()
  // P17 A / MD-16: en tablet la lista es una columna centrada de FORM_MAX_WIDTH; en teléfono no cambia.
  const columna = useColumnaDeFormulario()
  const [clave, setClave] = useState<(typeof FILTROS)[number]['clave']>('enCurso')
  const filtro = FILTROS.find((f) => f.clave === clave) ?? FILTROS[0]
  const q = useHojasDeRuta({ estado: filtro.estado })
  const hojas = q.data ?? []
  const abrirHoja = useCallback((id: string) => router.push({ pathname: '/(tabs)/logistica/consola', params: { id } } as never), [router])
  const renderHoja = useCallback(
    ({ item, index }: { item: HojaRutaListItemDto; index: number }) => <FilaDeHoja hoja={item} indice={index} onAbrir={abrirHoja} />,
    [abrirHoja],
  )

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Hojas de ruta" subtitle="Todas las hojas" leading={menu ?? { kind: 'atras', onPress: () => router.back() }} />
      <View testID="hojas-filtros" style={[{ flexDirection: 'row', gap: space[2], padding: space[4], paddingBottom: space[2] }, columna]}>
        {FILTROS.map((f) => <FiltroChip key={f.clave} label={f.label} activo={f.clave === clave} onPress={() => setClave(f.clave)} />)}
      </View>
      {q.isLoading ? (
        <ActivityIndicator color={c.brand} accessibilityLabel="Cargando las hojas de ruta" style={{ marginTop: space[8] }} />
      ) : q.isError ? (
        <EstadoDePantalla tipo="sinConexion" titulo="No se pudieron cargar las hojas de ruta." texto="Probá de nuevo en un rato." accion={{ label: 'Reintentar', onPress: () => { void q.refetch() } }} />
      ) : hojas.length === 0 ? (
        <EstadoDePantalla tipo="vacio" titulo={filtro.vacio} />
      ) : (
        <FlatList {...LISTA_LARGA_PROPS}
          data={hojas}
          keyExtractor={(h) => h.id}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { void q.refetch() }} />}
          contentContainerStyle={[{ padding: space[4] }, columna]}
          renderItem={renderHoja}
        />
      )}
    </View>
  )
}
