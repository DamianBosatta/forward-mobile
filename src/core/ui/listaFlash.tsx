import React from 'react'
import { View } from 'react-native'

/**
 * Helpers para las listas con FlashList (S9). FlashList 2 no tiene `columnWrapperStyle` ni acepta `gap` en
 * `contentContainerStyle`: el espacio entre filas va en un separador y el espacio entre columnas dentro de la celda.
 */

const separadores = new Map<number, () => React.JSX.Element>()

/** Un separador vertical de `alto` px, con identidad estable por alto (apto para `ItemSeparatorComponent`). */
export function separadorDeFilas(alto: number) {
  let s = separadores.get(alto)
  if (!s) {
    s = function SeparadorDeFilas() {
      return <View style={{ height: alto }} />
    }
    separadores.set(alto, s)
  }
  return s
}

/**
 * La celda de una grilla de `columnas` con `espacio` px entre celdas. El contenedor de la lista resta `espacio / 2`
 * de su padding horizontal para que el borde exterior quede igual que con `gap`. Con más de una columna es una fila, como el
 * contenedor de columnas de FlatList: la tarjeta con `flex: 1` ocupa todo el ancho de la celda.
 */
export function CeldaDeGrilla({ columnas, espacio, children }: { columnas: number; espacio: number; children: React.ReactNode }) {
  return <View style={{ flexDirection: columnas > 1 ? 'row' : 'column', paddingHorizontal: columnas > 1 ? espacio / 2 : 0, paddingBottom: espacio }}>{children}</View>
}

/** El padding horizontal del contenedor de una grilla de FlashList, para sumar con `CeldaDeGrilla`. */
export const paddingDeGrilla = (padding: number, columnas: number, espacio: number) => (columnas > 1 ? padding - espacio / 2 : padding)
