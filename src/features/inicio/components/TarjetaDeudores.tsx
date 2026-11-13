import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChevronRight, TriangleAlert } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { formatImporte, pesoSemibold } from '@/core/ui/fw'
import { BloqueCargando, ErrorConReintentar, TarjetaDeTexto } from './PiezasDeInicio'

export interface DatosDeDeudores {
  /** Clientes con deuda abierta. */
  clientes: number
  /** Lo que deben entre todos. */
  total: number
  /** La parte vencida hace más de 30 días; `null` = el servidor no la manda: no se muestra la línea. */
  vencido: number | null
}

interface Props {
  estado: 'cargando' | 'error' | 'datos'
  datos?: DatosDeDeudores | null
  /** Sin destino (sin acceso a Clientes ni a Cobros) la tarjeta se lee pero no se toca. */
  onPress?: () => void
  onReintentar?: () => void
}

/**
 * Deudores, la tarjeta que destaca en el inicio (dirección A): cuánto deben los clientes, a cuántos y
 * cuánto está vencido. Lleva a la cartera. El rojo va solo en el ícono (nunca en el texto) y siempre
 * acompañado de cifras. Presentacional: el container decide si el usuario puede ver deudas (sin permiso no se monta).
 */
export function TarjetaDeudores({ estado, datos, onPress, onReintentar }: Props) {
  const c = useColors()
  if (estado === 'cargando') return <BloqueCargando accessibilityLabel="Cargando los deudores" />
  if (estado === 'error' || !datos) {
    return <ErrorConReintentar texto="No se pudieron cargar los deudores." accessibilityLabel="Reintentar deudores" onReintentar={onReintentar ?? (() => undefined)} />
  }
  if (datos.clientes === 0) return <TarjetaDeTexto texto="Sin deudores: ningún cliente tiene deuda abierta." />

  const cuantos = `${datos.clientes} ${datos.clientes === 1 ? 'cliente te debe' : 'clientes te deben'}`
  const monto = formatImporte(datos.total)
  const vencido = datos.vencido != null && datos.vencido > 0 ? `${formatImporte(datos.vencido)} vencido hace más de 30 días` : null
  const etiqueta = ['Deudores', cuantos, monto, vencido, onPress ? 'Ver deudores' : null].filter(Boolean).join('. ')
  const estilo = { gap: space[2], padding: space[4], borderRadius: radii.hoja, backgroundColor: c.surface, borderLeftWidth: 4, borderLeftColor: c.danger }
  const contenido = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <View style={{ width: 44, height: 44, borderRadius: radii.pastilla, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
          <TriangleAlert size={22} color={c.danger} strokeWidth={2} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>Deudores</Text>
          <Text style={[typeScale.secundario, { color: c.textSecondary }]} numberOfLines={2}>{cuantos}</Text>
        </View>
      </View>
      <Text testID="deudores-monto" style={[typeScale.titulo, importe, { color: c.text, fontSize: 28, lineHeight: 36 }]} numberOfLines={1} adjustsFontSizeToFit>{monto}</Text>
      {vencido ? <Text testID="deudores-vencido" style={[typeScale.secundario, { color: c.textSecondary }]}>{vencido}</Text> : null}
      {onPress ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }}>
          <Text style={[typeScale.secundario, pesoSemibold, { color: c.brandInk }]}>Ver deudores</Text>
          <ChevronRight size={18} color={c.brandInk} strokeWidth={2} />
        </View>
      ) : null}
    </>
  )
  if (!onPress) return <View testID="tarjeta-deudores" accessible accessibilityLabel={etiqueta} style={estilo}>{contenido}</View>
  return (
    <Pressable testID="tarjeta-deudores" accessibilityRole="button" accessibilityLabel={etiqueta} onPress={onPress} android_ripple={{ color: c.surface2 }} style={estilo}>
      {contenido}
    </Pressable>
  )
}
