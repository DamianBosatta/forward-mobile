import React from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native'
import { importe as cifras, radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, Notice } from '@/core/ui/fw'
import { useDescartarBorradorVenta, type BorradorVenta } from '@/libs/api-client/ventas'
import { horaDe, tituloDelDia } from '../lib/agruparPorDia'
import { identidadDeBorrador } from '../lib/borradorCliente'

/**
 * La confirmación de descartar, con el texto de la web (`ConfirmarDescartarBorradorDialog`): un borrador puede
 * tener muchas líneas cargadas y un toque no alcanza para perderlo.
 */
export function textoDescartarBorrador(b: Pick<BorradorVenta, 'clienteNombre' | 'cantidadLineas'>): string {
  const lineas = b.cantidadLineas === 1 ? '1 línea' : `${b.cantidadLineas} líneas`
  return `Se va a descartar la venta en curso con ${b.clienteNombre} (${lineas}). No se puede deshacer.`
}

interface Props {
  borradores: BorradorVenta[]
  cargando: boolean
  error: boolean
  /** Retomar el borrador en la venta nueva (pregunta el tipo si el servidor no lo guardó). */
  onSeguir: (b: BorradorVenta) => void
}

/** Borradores (lámina ResBorradores): las ventas que se empezaron y no se terminaron; seguir o descartar. */
export function ListaBorradores({ borradores, cargando, error, onSeguir }: Props) {
  const c = useColors()
  const descartar = useDescartarBorradorVenta()
  const secundario = [typeScale.secundario, { color: c.textSecondary }]

  const pedirDescarte = (b: BorradorVenta) => Alert.alert('¿Descartar este borrador?', textoDescartarBorrador(b), [
    { text: 'Volver', style: 'cancel' },
    { text: 'Descartar', style: 'destructive', onPress: () => descartar.mutate(b.id) },
  ])

  return (
    <FlatList<BorradorVenta>
      data={borradores}
      keyExtractor={(b) => b.id}
      contentContainerStyle={{ padding: space[4], gap: space[3] }}
      ListHeaderComponent={<Notice tone="info">Los borradores se guardan solos y se descartan a las 48 h sin cambios. Tocá uno para seguirlo.</Notice>}
      renderItem={({ item: b }) => {
        const { titulo, subtitulo, total } = identidadDeBorrador(b)
        const guardado = <Text style={secundario}>{`${b.cantidadLineas} ${b.cantidadLineas === 1 ? 'línea' : 'líneas'} · Guardado ${tituloDelDia(new Date(b.fechaModificacion)).toLowerCase()} ${horaDe(b.fechaModificacion)}`}</Text>
        return (
          <View style={{ borderRadius: radii.tarjeta, backgroundColor: c.surface, padding: space[4], gap: space[3] }}>
            <Pressable accessibilityRole="button" accessibilityHint="Retomar el borrador" onPress={() => onSeguir(b)} style={{ minHeight: 48, gap: space[1] }}>
              <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>{titulo}</Text>
              {subtitulo ? <Text style={[typeScale.secundario, { color: c.text }]}>{subtitulo}</Text> : null}
              {/* Sin importe (servidor anterior a forward-system #898) la fila queda como siempre: solo el texto. */}
              {total === null ? guardado : (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space[2] }}>
                  {guardado}
                  <Text style={[typeScale.titulo, cifras, { color: c.text, textAlign: 'right' }]}>{total}</Text>
                </View>
              )}
            </Pressable>
            <View style={{ flexDirection: 'row', gap: space[3] }}>
              <View style={{ flex: 1 }}><Button label="Descartar" variant="secundario" onPress={() => pedirDescarte(b)} /></View>
              <View style={{ flex: 1 }}><Button label="Seguir" onPress={() => onSeguir(b)} /></View>
            </View>
          </View>
        )
      }}
      ListEmptyComponent={
        cargando ? <ActivityIndicator color={c.brand} />
          : error ? <Notice tone="peligro">No se pudieron cargar los borradores.</Notice>
          : <Text style={secundario}>No tenés borradores.</Text>
      }
    />
  )
}
