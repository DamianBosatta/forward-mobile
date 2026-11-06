import React from 'react'
import { PieFijo } from '@/core/ui/fw'

/** Pie fijo de los formularios de socios (láminas Nuevo y Editar): el botón de guardar siempre a mano, sobre el teclado. */
export function PieDeFormulario({ children }: { children: React.ReactNode }) {
  return <PieFijo>{children}</PieFijo>
}
