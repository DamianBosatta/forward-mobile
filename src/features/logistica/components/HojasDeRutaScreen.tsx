import React, { useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronRight } from 'lucide-react-native'
import { radii, space, typeScale, useColors, type ChipEstado } from '@/libs/theme'
import { StatusChip, TopBar, useMenuLeading } from '@/core/ui/fw'
import { EstadoDePantalla } from '@/core/ui/fw/EstadoDePantalla'
import { FiltroChip } from '@/core/ui/fw/FiltroChip'
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

function Fila({ hoja, ultima, onPress }: { hoja: HojaRutaListItemDto; ultima: boolean; onPress: () => void }) {
  const c = useColors()
  const estado = resolverEstadoHojaRuta(hoja.estado)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${codigoDe(hoja.id)}, ${hoja.choferNombre}, ${hoja.vehiculoPatente}, ${entregas(hoja.cantidadParadas)}`}
      onPress={onPress}
      style={{ minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3], borderBottomWidth: ultima ? 0 : 1, borderBottomColor: c.border }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: space[1] }}>
        <Text style={[typeScale.secundario, { color: c.textSecondary }]} numberOfLines={1}>{codigoDe(hoja.id)}</Text>
        <Text style={[typeScale.cuerpoDestacado, { color: c.text }]} numberOfLines={1}>{hoja.choferNombre}</Text>
        <Text style={[typeScale.secundario, { color: c.textSecondary }]} numberOfLines={1}>{hoja.vehiculoPatente}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: space[1] }}>
        {estado ? <StatusChip estado={CHIP_DE_TONO[estado.info.tono] ?? 'pendiente'} label={estado.nombre === 'EnCurso' ? 'En curso' : estado.info.etiqueta} /> : null}
        <Text style={[typeScale.secundario, { color: c.textSecondary }]}>{entregas(hoja.cantidadParadas)}</Text>
      </View>
      <ChevronRight size={20} color={c.textSecondary} />
    </Pressable>
  )
}

/** Hojas de ruta de toda la empresa (MOD_VIAJES:Read). Por defecto las En curso, lo que cuenta "Rutas activas" de Inicio. */
export function HojasDeRutaScreen() {
  const c = useColors()
  const router = useRouter()
  const menu = useMenuLeading()
  const [clave, setClave] = useState<(typeof FILTROS)[number]['clave']>('enCurso')
  const filtro = FILTROS.find((f) => f.clave === clave) ?? FILTROS[0]
  const q = useHojasDeRuta({ estado: filtro.estado })
  const hojas = q.data ?? []

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Hojas de ruta" subtitle="De toda la empresa" leading={menu ?? { kind: 'atras', onPress: () => router.back() }} />
      <View style={{ flexDirection: 'row', gap: space[2], padding: space[4], paddingBottom: space[2] }}>
        {FILTROS.map((f) => <FiltroChip key={f.clave} label={f.label} activo={f.clave === clave} onPress={() => setClave(f.clave)} />)}
      </View>
      {q.isLoading ? (
        <ActivityIndicator color={c.brand} accessibilityLabel="Cargando las hojas de ruta" style={{ marginTop: space[8] }} />
      ) : q.isError ? (
        <EstadoDePantalla tipo="sinConexion" titulo="No se pudieron cargar las hojas de ruta." texto="Probá de nuevo en un rato." accion={{ label: 'Reintentar', onPress: () => { void q.refetch() } }} />
      ) : hojas.length === 0 ? (
        <EstadoDePantalla tipo="vacio" titulo={filtro.vacio} />
      ) : (
        <FlatList
          data={hojas}
          keyExtractor={(h) => h.id}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { void q.refetch() }} />}
          contentContainerStyle={{ padding: space[4] }}
          renderItem={({ item, index }) => {
            const primera = index === 0
            const ultima = index === hojas.length - 1
            return (
              <View
                style={{
                  backgroundColor: c.surface, borderColor: c.border, overflow: 'hidden',
                  borderLeftWidth: 1, borderRightWidth: 1, borderTopWidth: primera ? 1 : 0, borderBottomWidth: ultima ? 1 : 0,
                  borderTopLeftRadius: primera ? radii.tarjeta : 0, borderTopRightRadius: primera ? radii.tarjeta : 0,
                  borderBottomLeftRadius: ultima ? radii.tarjeta : 0, borderBottomRightRadius: ultima ? radii.tarjeta : 0,
                }}
              >
                <Fila hoja={item} ultima={ultima} onPress={() => router.push({ pathname: '/(tabs)/logistica/consola', params: { id: item.id } } as never)} />
              </View>
            )
          }}
        />
      )}
    </View>
  )
}
