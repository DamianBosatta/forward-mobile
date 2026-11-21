import React from 'react'
import Svg, { G, Path, Text as SvgText } from 'react-native-svg'
import { FONT } from '@/libs/theme'

/**
 * Marca FWD, la misma de la web (forward-frontend/apps/web/public/icon.svg), con el viewBox recortado
 * como en la galería v2 (`0 31 281 219`). Los colores son los del logo, no del tema: es una imagen de
 * marca y se ve igual en claro y en oscuro. Decorativa: quien la usa pone el nombre en texto al lado.
 */
const ANCHO = 281
const ALTO = 219
const LIMA = '#98d14d'
const FLECHA = '#00c19e'
const LETRAS = '#00a385'

export function LogoForward({ alto }: { alto: number }) {
  const ancho = Math.round((alto * ANCHO) / ALTO)
  return (
    <Svg testID="logo-fwd" width={ancho} height={alto} viewBox={`0 31 ${ANCHO} ${ALTO}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <G transform="translate(0,31.5)">
        <Path d="M280.5 0.5L280.5 217.5L0.5 217.5L280.5 0.5Z" fill={LIMA} fillOpacity={0.85} />
        <Path d="M20 160C80 150 160 145 270 155L200 120M270 155L200 190" stroke={FLECHA} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <SvgText x="10" y="100" fontFamily={FONT.semibold} fontWeight="800" fontSize="110" letterSpacing={-6} fill={LETRAS}>
          FWD
        </SvgText>
      </G>
    </Svg>
  )
}
