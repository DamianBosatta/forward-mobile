import React from 'react'
import { Notice } from '@/core/ui/fw'

/**
 * Lo que mobile no hace y se resuelve en la web. Una sola frase por acción, para que toda la app lo diga igual.
 * Sin botón: el aviso informa, no ofrece una acción que el teléfono no puede cumplir.
 */
export const SOLO_WEB = {
  abrirCaja: 'La caja se abre desde la web.',
  anularPago: 'Anular el pago y bajar el comprobante se hace desde la web.',
  operacionesDeDeposito: 'Las operaciones del depósito se hacen desde la web.',
  armarViaje: 'Armar y documentar el viaje se hace desde la web.',
  rendicion: 'La rendición del chofer se hace desde la web.',
} as const

export type AccionSoloWeb = keyof typeof SOLO_WEB

/** Aviso informativo "Se hace en la web" (tono info, sin acción). */
export function AvisoSoloWeb({ accion, detalle, testID }: { accion: AccionSoloWeb; detalle?: string; testID?: string }) {
  return (
    <Notice tone="info" title="Se hace en la web." testID={testID ?? 'aviso-solo-web'}>
      {detalle ? `${SOLO_WEB[accion]} ${detalle}` : SOLO_WEB[accion]}
    </Notice>
  )
}
