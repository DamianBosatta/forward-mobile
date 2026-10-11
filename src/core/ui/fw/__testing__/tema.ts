import { StyleSheet } from 'react-native'
import { useThemeStore } from '@/libs/theme'

export const TEMAS = ['light', 'dark'] as const

export function conTema(tema: 'light' | 'dark') {
  useThemeStore.setState({ mode: tema })
}

/** Estilo aplanado de un elemento (resuelve el estilo-función de Pressable). */
export function estilo(el: { props: { style?: unknown } }) {
  const s = el.props.style
  return StyleSheet.flatten(typeof s === 'function' ? s({ pressed: false }) : s) ?? {}
}
