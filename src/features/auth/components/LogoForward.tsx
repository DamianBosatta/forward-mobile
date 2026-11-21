import React from 'react'
import Svg, { ClipPath, Defs, Polygon, Rect } from 'react-native-svg'
import { themeColors } from '@/libs/theme'

/**
 * Marca FWD (receta de `.logo` del restyle): cuadrado lima redondeado, franja diagonal ink y cuña teal en la
 * esquina. Es una imagen de marca: los tres colores son los de la marca (iguales en claro y oscuro). Dibujada en
 * una grilla de 72 para que escale a cualquier tamaño. Decorativa: quien la usa pone el nombre en texto al lado.
 */
const MARCA = themeColors.light
const GRILLA = 72

export function LogoForward({ alto }: { alto: number }) {
  return (
    <Svg testID="logo-fwd" width={alto} height={alto} viewBox={`0 0 ${GRILLA} ${GRILLA}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <ClipPath id="logo-fwd-recorte">
          <Rect x={0} y={0} width={GRILLA} height={GRILLA} rx={24} ry={24} />
        </ClipPath>
      </Defs>
      <Rect x={0} y={0} width={GRILLA} height={GRILLA} rx={24} ry={24} fill={MARCA.lime} />
      <Rect x={28} y={-16} width={16} height={112} fill={MARCA.ink} transform="rotate(28 36 40)" clipPath="url(#logo-fwd-recorte)" />
      <Polygon points="72,38 72,72 38,72" fill={MARCA.teal} clipPath="url(#logo-fwd-recorte)" />
    </Svg>
  )
}
