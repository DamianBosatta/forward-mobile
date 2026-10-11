import React from 'react'
import { Text, View } from 'react-native'
import { CircleAlert, CircleCheck, CircleX, Info, type LucideIcon } from 'lucide-react-native'
import { FONT, radii, space, typeScale, useColors, type ChipEstado } from '@/libs/theme'

export type NoticeTone = 'info' | 'advertencia' | 'peligro' | 'exito'

// Cada tono usa el par de chip que ya pasa 4,5:1: el fondo suave y el color
// del estado para el ícono. El texto va en color de texto.
const TONOS: Record<NoticeTone, { chip: ChipEstado; Icono: LucideIcon }> = {
  info: { chip: 'enCurso', Icono: Info },
  advertencia: { chip: 'porAutorizar', Icono: CircleAlert },
  peligro: { chip: 'anulado', Icono: CircleX },
  exito: { chip: 'entregado', Icono: CircleCheck },
}

interface NoticeProps {
  tone: NoticeTone
  /** Frase en negrita al principio, opcional. */
  title?: string
  children: string
  testID?: string
}

/** Aviso de la lámina F4: relleno 12, radio 10, ícono 20 y texto 14/20. */
export function Notice({ tone, title, children, testID }: NoticeProps) {
  const colors = useColors()
  const { chip, Icono } = TONOS[tone]
  const par = colors.chip[chip]

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole={tone === 'peligro' ? 'alert' : 'text'}
      accessibilityLiveRegion={tone === 'peligro' ? 'assertive' : 'polite'}
      style={{
        flexDirection: 'row',
        gap: space[2],
        padding: space[3],
        borderRadius: radii.campo,
        backgroundColor: par.bg,
      }}
    >
      <Icono size={20} color={par.text} strokeWidth={2} />
      <Text style={{ ...typeScale.secundario, color: colors.text, flex: 1 }}>
        {title ? (
          <Text style={{ fontFamily: FONT.semibold, fontWeight: '600' }}>{`${title} `}</Text>
        ) : null}
        {children}
      </Text>
    </View>
  )
}
