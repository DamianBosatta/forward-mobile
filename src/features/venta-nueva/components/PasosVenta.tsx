import React from 'react'
import { PasosNumerados } from '@/core/ui/fw/PasosNumerados'

const PASOS = ['Cliente', 'Productos', 'Confirmar'] as const

interface Props {
  /** El paso en el que está la venta: 1 cliente, 2 productos, 3 revisar y confirmar. */
  paso: 1 | 2 | 3
}

/** Barra de pasos de la venta nueva (mockups ventas-nueva-1/2/3): `PasosNumerados` con los nombres fijos de la venta. */
export function PasosVenta({ paso }: Props) {
  return <PasosNumerados nombres={PASOS} paso={paso} />
}
