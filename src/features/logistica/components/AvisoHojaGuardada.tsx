import React from 'react'
import { Notice } from '@/core/ui/fw'
import { ddmmaaaa, diaArgentina } from '@/core/utils/fecha'

interface Props {
  enLinea: boolean
  /** Business day (Argentina, X9) when the saved sheet was last confirmed by the server; null in an old copy. */
  guardadaEl: string | null
}

/**
 * Sin conexión, la hoja guardada de otro día se sigue mostrando pero con su fecha (MR-R6-01).
 * El texto lleva la fecha y el ícono viene de `Notice`: el estado no va solo en el color.
 */
export function AvisoHojaGuardada({ enLinea, guardadaEl }: Props) {
  if (enLinea || !guardadaEl || guardadaEl === diaArgentina(Date.now())) return null
  return (
    <Notice tone="advertencia" title={`Hoja del ${ddmmaaaa(guardadaEl)}, sin conexión.`} testID="aviso-hoja-guardada">
      Es la última que se guardó en el teléfono.
    </Notice>
  )
}
