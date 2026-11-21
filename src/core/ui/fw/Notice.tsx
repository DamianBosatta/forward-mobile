import React from 'react'
import { Text, View } from 'react-native'
import { CircleAlert, CircleCheck, CircleX, Info, type LucideIcon } from 'lucide-react-native'
import { FONT, radii, space, typeScale, useColors, type ForwardColors } from '@/libs/theme'

export type NoticeTone = 'info' | 'advertencia' | 'peligro' | 'exito'

// Spec FWD §5 (`.notice`): relleno pleno del estado con texto e ícono `ink`; `info` es `surface` con `text`.
// El estado nunca va solo en el color: lleva ícono y el texto lo dice.
const TONOS: Record<NoticeTone, { fondo: (c: ForwardColors) => string; texto: (c: ForwardColors) => string; Icono: LucideIcon }> = {
  info: { fondo: (c) => c.surface, texto: (c) => c.text, Icono: Info },
  advertencia: { fondo: (c) => c.warning, texto: (c) => c.onState, Icono: CircleAlert },
  peligro: { fondo: (c) => c.dangerFill, texto: (c) => c.onState, Icono: CircleX },
  exito: { fondo: (c) => c.teal, texto: (c) => c.ink, Icono: CircleCheck },
}

interface NoticeProps {
  tone: NoticeTone
  /** Frase en negrita al principio, opcional. */
  title?: string
  children: string
  testID?: string
}

/** Aviso FWD: radio de fila, relleno pleno del estado con texto ink, ícono 20 y texto 14/700. */
export function Notice({ tone, title, children, testID }: NoticeProps) {
  const colors = useColors()
  const { fondo, texto, Icono } = TONOS[tone]
  const tinta = texto(colors)

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole={tone === 'peligro' ? 'alert' : 'text'}
      accessibilityLiveRegion={tone === 'peligro' ? 'assertive' : 'polite'}
      style={{
        flexDirection: 'row',
        gap: space[2],
        paddingVertical: space[3],
        paddingHorizontal: space[4],
        borderRadius: radii.fila,
        backgroundColor: fondo(colors),
      }}
    >
      <Icono size={20} color={tinta} strokeWidth={2.5} />
      <Text style={{ ...typeScale.secundario, fontFamily: FONT.bold, fontWeight: '700', color: tinta, flex: 1 }}>
        {title ? (
          <Text style={{ fontFamily: FONT.extrabold, fontWeight: '800' }}>{`${title} `}</Text>
        ) : null}
        {children}
      </Text>
    </View>
  )
}
