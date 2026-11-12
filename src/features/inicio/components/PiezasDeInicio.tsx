import React from 'react'
import { Pressable, Text, View, type TextStyle } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import { FONT, importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Notice } from '@/core/ui/fw'

/**
 * Piezas de Inicio con el modelo de la venta y de la galería v2 (propuesta de Inicio, frames 1 a 9):
 * el hero, las listas como filas de una tarjeta, los títulos de sección, los avisos con
 * "Reintentar" y los bloques de carga. Presentacionales: reciben todo por props.
 */

/** Colores del hero con los del tema: fondo marca-suave, cifra en el texto, apoyo en el secundario (en oscuro, los de la galería v2). */
function useColoresHero() {
  const c = useColors()
  return { fondo: c.brandSoft, texto: c.text, apoyo: c.textSecondary, carga: c.surface2 }
}
/** La cifra grande del hero (galería v2: 32/40, 700). Es la única medida fuera de la escala de texto. */
const CIFRA_HERO: TextStyle = { fontFamily: FONT.semibold, fontSize: 32, lineHeight: 40, fontWeight: '700', ...importe }
const semibold = { fontFamily: FONT.semibold, fontWeight: '600' as const }
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
    <View testID={testID} style={{ backgroundColor: hero.fondo, borderRadius: radii.hoja, padding: space[4], gap: space[2] }}>
      <View accessible accessibilityLabel={accessibilityLabel ?? [`${etiqueta}: ${cifra}`, meta].filter(Boolean).join(', ')} style={{ gap: space[1] }}>
        <Text style={[typeScale.secundario, { color: hero.apoyo }]}>{etiqueta}</Text>
        <Text style={[CIFRA_HERO, { color: hero.texto }]} numberOfLines={1} adjustsFontSizeToFit>{cifra}</Text>
        {meta ? <Text style={[typeScale.secundario, { color: hero.apoyo }]}>{meta}</Text> : null}
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
      style={{ backgroundColor: hero.fondo, borderRadius: radii.hoja, padding: space[4], gap: space[3] }}
    >
      <View style={{ height: space[4], width: '40%', borderRadius: radii.campo, backgroundColor: hero.carga }} />
      <View style={{ height: space[8], width: '70%', borderRadius: radii.campo, backgroundColor: hero.carga }} />
    </View>
  )
}

/** Bloque gris con la forma de una tarjeta mientras carga (frame 3). */
export function BloqueCargando({ accessibilityLabel }: { accessibilityLabel: string }) {
  const c = useColors()
  return <View testID="bloque-cargando" accessible accessibilityLabel={accessibilityLabel} style={{ height: 76, borderRadius: radii.tarjeta, backgroundColor: c.surface2 }} />
}

/** Título de sección con un enlace opcional a la derecha ("Todos los clientes", "Ver todo"). */
export function SeccionDeInicio({ titulo, enlace, children }: { titulo: string; enlace?: { label: string; onPress: () => void } | null; children: React.ReactNode }) {
  const c = useColors()
  return (
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 }}>
        <Text accessibilityRole="header" style={[typeScale.seccion, { color: c.text, flexShrink: 1 }]}>{titulo}</Text>
        {enlace ? (
          <Pressable accessibilityRole="link" accessibilityLabel={enlace.label} onPress={enlace.onPress} style={TOCABLE}>
            <Text style={[typeScale.secundario, semibold, { color: c.brandInk }]}>{enlace.label}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  )
}

/** Filas en una tarjeta sin borde, separadas por una línea suave (frame 2 y 8 de la venta). */
export function ListaEnTarjeta({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const c = useColors()
  const filas = React.Children.toArray(children).filter(Boolean)
  return (
    <View testID={testID} style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, overflow: 'hidden' }}>
      {filas.map((f, i) => (
        <View key={i} style={i > 0 ? { borderTopWidth: 1, borderTopColor: c.surface2 } : null}>{f}</View>
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
  const colorPunto = { neutro: c.textSecondary, atencion: c.warning, peligro: c.danger, info: c.info }
  const etiqueta = accessibilityLabel ?? [titulo, apoyo].filter(Boolean).join('. ')
  const estilo = { minHeight: 64, flexDirection: 'row' as const, alignItems: 'center' as const, gap: space[3], paddingVertical: space[3], paddingLeft: space[4], paddingRight: onPress ? space[1] : space[4] }
  const contenido = (
    <>
      {punto ? <View testID={testID ? `${testID}-punto` : undefined} style={{ width: space[2], height: space[2], borderRadius: radii.pastilla, backgroundColor: colorPunto[punto] }} /> : null}
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
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={etiqueta} onPress={onPress} android_ripple={{ color: c.surface2 }} style={estilo}>
      {contenido}
    </Pressable>
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
        <Text style={[typeScale.secundario, semibold, { color: c.brandInk }]}>Reintentar</Text>
      </Pressable>
    </View>
  )
}

/** Texto suelto dentro de una tarjeta (vacíos: "Todavía no hay ventas hoy."). */
export function TarjetaDeTexto({ texto }: { texto: string }) {
  const c = useColors()
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[4] }}>
      <Text style={[typeScale.secundario, { color: c.textSecondary }]}>{texto}</Text>
    </View>
  )
}
