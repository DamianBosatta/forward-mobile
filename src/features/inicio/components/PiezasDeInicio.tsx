import React from 'react'
import { Pressable, Text, View, type TextStyle } from 'react-native'
import Svg, { Polygon, Rect } from 'react-native-svg'
import { ChevronRight } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Notice, pesoSemibold } from '@/core/ui/fw'
import { PressableFx } from '@/core/ui/fw/PressableFx'

/**
 * Piezas de Inicio con el modelo de la venta y de la galería v2 (propuesta de Inicio, frames 1 a 9):
 * el hero, las listas como filas de una tarjeta, los títulos de sección, los avisos con
 * "Reintentar" y los bloques de carga. Presentacionales: reciben todo por props.
 */

/** Colores del hero (receta FWD: tarjeta protagonista lima, texto y bloques siempre en ink, iguales en claro y oscuro). */
function useColoresHero() {
  const c = useColors()
  return { fondo: c.lime, texto: c.ink, carga: c.ink }
}
/** El texto de apoyo sobre lima: ink al 78 % (receta `.secondary` de la tarjeta protagonista). */
const APOYO_SOBRE_LIMA = { opacity: 0.78 } as const
/** La cifra protagonista del hero (spec §3: 38-40, 800, cifras tabulares). */
const CIFRA_HERO: TextStyle = { ...typeScale.numeroProtagonista, ...importe }

/**
 * Motivo del logo de la tarjeta protagonista de Inicio (receta `.motif`): franja diagonal ink y cuña teal que
 * asoman por la esquina derecha. Decorativo; la tarjeta recorta lo que sobra.
 */
function MotivoDeHero() {
  const c = useColors()
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', right: -96, top: -34, width: 150, height: 190 }}>
      <Svg width={150} height={190} viewBox="0 0 150 190">
        <Rect x={40} y={-40} width={34} height={280} fill={c.ink} transform="rotate(28 57 100)" />
        <Polygon points="150,100 150,190 60,190" fill={c.teal} />
      </Svg>
    </View>
  )
}
const TOCABLE = { minHeight: 44, minWidth: 44, justifyContent: 'center' as const }

export function HeroDeInicio({ etiqueta, cifra, meta, accessibilityLabel, children, testID }: {
  etiqueta: string
  cifra: string
  meta?: string | null
  accessibilityLabel?: string
  children?: React.ReactNode
  testID?: string
}) {
  const hero = useColoresHero()
  return (
    <View testID={testID} style={{ backgroundColor: hero.fondo, borderRadius: radii.tarjetaGrande, padding: space[5], gap: space[2], minHeight: 168, justifyContent: 'center', overflow: 'hidden' }}>
      <MotivoDeHero />
      <View accessible accessibilityLabel={accessibilityLabel ?? [`${etiqueta}: ${cifra}`, meta].filter(Boolean).join(', ')} style={{ gap: space[1] }}>
        <Text style={[typeScale.secundario, APOYO_SOBRE_LIMA, { color: hero.texto }]}>{etiqueta}</Text>
        <Text style={[CIFRA_HERO, { color: hero.texto }]} numberOfLines={1} adjustsFontSizeToFit>{cifra}</Text>
        {meta ? <Text style={[typeScale.secundario, APOYO_SOBRE_LIMA, { color: hero.texto }]}>{meta}</Text> : null}
      </View>
      {children ? <View style={{ marginTop: space[1] }}>{children}</View> : null}
    </View>
  )
}

/** Hero mientras carga: bloques con su forma en lugar de la ruedita (frame 3). */
export function HeroCargando({ accessibilityLabel }: { accessibilityLabel: string }) {
  const hero = useColoresHero()
  return (
    <View
      testID="hero-cargando"
      accessible
      accessibilityLabel={accessibilityLabel}
      style={{ backgroundColor: hero.fondo, borderRadius: radii.tarjetaGrande, padding: space[5], gap: space[3], minHeight: 168, justifyContent: 'center' }}
    >
      <View style={{ height: space[4], width: '40%', borderRadius: radii.campo, backgroundColor: hero.carga, opacity: 0.15 }} />
      <View style={{ height: space[8], width: '70%', borderRadius: radii.campo, backgroundColor: hero.carga, opacity: 0.15 }} />
    </View>
  )
}

/** Bloque gris con la forma de una tarjeta mientras carga (frame 3). */
export function BloqueCargando({ accessibilityLabel }: { accessibilityLabel: string }) {
  const c = useColors()
  return <View testID="bloque-cargando" accessible accessibilityLabel={accessibilityLabel} style={{ height: 76, borderRadius: radii.fila, backgroundColor: c.surface2 }} />
}

/** Título de sección con un enlace opcional a la derecha ("Todos los clientes", "Ver todo"). */
export function SeccionDeInicio({ titulo, enlace, children }: { titulo: string; enlace?: { label: string; onPress: () => void } | null; children: React.ReactNode }) {
  const c = useColors()
  return (
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 }}>
        <Text accessibilityRole="header" style={[typeScale.titulo, { color: c.text, flexShrink: 1 }]}>{titulo}</Text>
        {enlace ? (
          <Pressable accessibilityRole="link" accessibilityLabel={enlace.label} onPress={enlace.onPress} style={TOCABLE}>
            <Text style={[typeScale.secundario, pesoSemibold, { color: c.brandInk }]}>{enlace.label}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  )
}

/** Filas sueltas de 22 de radio sobre `bg`, sin bordes ni sombras: las separa el contraste y el espacio (receta `.row`). */
export function ListaEnTarjeta({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const c = useColors()
  const filas = React.Children.toArray(children).filter(Boolean)
  return (
    <View testID={testID} style={{ gap: space[2] }}>
      {filas.map((f, i) => (
        <View key={i} style={{ backgroundColor: c.surface, borderRadius: radii.fila, overflow: 'hidden' }}>{f}</View>
      ))}
    </View>
  )
}

export type TonoPunto = 'neutro' | 'atencion' | 'peligro' | 'info'

/**
 * Una fila de lista: a la izquierda un punto de color o un avatar, título y apoyo, algo a la derecha
 * (un importe) y la flecha solo si tiene a dónde ir. Sin `onPress` se lee, no se toca.
 */
export function FilaDeInicio({ titulo, apoyo, izquierda, punto, derecha, onPress, accessibilityLabel, testID }: {
  titulo: string
  apoyo?: string | null
  izquierda?: React.ReactNode
  punto?: TonoPunto
  derecha?: React.ReactNode
  onPress?: () => void
  accessibilityLabel?: string
  testID?: string
}) {
  const c = useColors()
  const colorPunto = { neutro: c.textSecondary, atencion: c.warning, peligro: c.dangerFill, info: c.teal }
  const etiqueta = accessibilityLabel ?? [titulo, apoyo].filter(Boolean).join('. ')
  const estilo = { minHeight: 68, flexDirection: 'row' as const, alignItems: 'center' as const, gap: space[3], paddingVertical: space[3], paddingLeft: space[4], paddingRight: onPress ? space[1] : space[4] }
  const contenido = (
    <>
      {punto ? <View testID={testID ? `${testID}-punto` : undefined} style={{ width: space[3], height: space[3], borderRadius: radii.pastilla, backgroundColor: colorPunto[punto] }} /> : null}
      {izquierda}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[typeScale.cuerpoDestacado, { color: c.text }]} numberOfLines={2}>{titulo}</Text>
        {apoyo ? <Text style={[typeScale.secundario, { color: c.textSecondary }]} numberOfLines={2}>{apoyo}</Text> : null}
      </View>
      {derecha}
      {onPress ? <ChevronRight size={20} color={c.textSecondary} strokeWidth={2} /> : null}
    </>
  )
  if (!onPress) {
    return <View testID={testID} accessible accessibilityLabel={etiqueta} style={estilo}>{contenido}</View>
  }
  return (
    <PressableFx testID={testID} accessibilityRole="button" accessibilityLabel={etiqueta} onPress={onPress} android_ripple={{ color: c.surface2 }} style={estilo}>
      {contenido}
    </PressableFx>
  )
}

/** Importe a la derecha de una fila (frame 8 de la venta): cifras tabulares, sin cortar. */
export function ImporteDeFila({ texto, resaltado = false }: { texto: string; resaltado?: boolean }) {
  const c = useColors()
  return <Text style={[typeScale.titulo, importe, { color: resaltado ? c.brandInk : c.text, textAlign: 'right' }]} numberOfLines={1}>{texto}</Text>
}

/** Error de una sección con el texto de hoy y "Reintentar" (frames 3 y 8). */
export function ErrorConReintentar({ texto, detalle, accessibilityLabel, onReintentar }: { texto: string; detalle?: string | null; accessibilityLabel: string; onReintentar: () => void }) {
  const c = useColors()
  return (
    <View style={{ gap: space[1], alignItems: 'stretch' }}>
      <Notice tone="peligro">{texto}</Notice>
      {detalle ? <Text style={[typeScale.secundario, { color: c.text }]}>{detalle}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onReintentar} style={[TOCABLE, { alignSelf: 'flex-start' }]}>
        <Text style={[typeScale.secundario, pesoSemibold, { color: c.brandInk }]}>Reintentar</Text>
      </Pressable>
    </View>
  )
}

/** Texto suelto dentro de una tarjeta (vacíos: "Todavía no hay ventas hoy."). */
export function TarjetaDeTexto({ texto }: { texto: string }) {
  const c = useColors()
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: radii.fila, padding: space[4] }}>
      <Text style={[typeScale.secundario, { color: c.textSecondary }]}>{texto}</Text>
    </View>
  )
}
