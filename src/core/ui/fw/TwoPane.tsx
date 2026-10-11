import React from 'react'
import { View } from 'react-native'
import { useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'

/** Ancho de la lista en tablet horizontal (lámina TabVentas). */
export const TWO_PANE_LIST_WIDTH = 420

interface TwoPaneProps {
  list: React.ReactNode
  /** El documento elegido; null o undefined si no hay ninguno. */
  detail?: React.ReactNode
  /** Qué ocupa el panel derecho en tablet horizontal mientras no hay nada elegido. */
  emptyDetail?: React.ReactNode
}

/**
 * Lista y detalle (plan §8). En tablet horizontal (≥ 900) van lado a lado: la
 * lista a la izquierda y el detalle a la derecha, sin salir de la lista. En
 * teléfono y tablet vertical se ve uno solo: el detalle si hay uno elegido; si
 * no, la lista.
 */
export function TwoPane({ list, detail, emptyDetail = null }: TwoPaneProps) {
  const colors = useColors()
  const { isTabletLandscape } = useResponsive()
  const hayDetalle = detail !== null && detail !== undefined

  if (!isTabletLandscape) {
    return (
      <View testID={hayDetalle ? 'two-pane-detail' : 'two-pane-list'} style={{ flex: 1 }}>
        {hayDetalle ? detail : list}
      </View>
    )
  }

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.bg }}>
      <View
        testID="two-pane-list"
        style={{ width: TWO_PANE_LIST_WIDTH, borderRightWidth: 1, borderRightColor: colors.border }}
      >
        {list}
      </View>
      <View testID="two-pane-detail" style={{ flex: 1, minWidth: 0 }}>
        {hayDetalle ? detail : emptyDetail}
      </View>
    </View>
  )
}
