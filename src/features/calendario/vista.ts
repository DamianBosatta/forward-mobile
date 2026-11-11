import { storage } from '@/core/utils/storage'

/**
 * La vista del calendario que eligió la persona, recordada en este teléfono (la web la recuerda por navegador:
 * `vista-preferida.ts`). Es una comodidad: si el almacenamiento falla, abre en la vista por defecto, sin avisar.
 */
export type Vista = 'semana' | 'mes' | 'dia' | 'agenda'

export const VISTA_POR_DEFECTO: Vista = 'semana'

export const VISTAS: { label: string; value: Vista }[] = [
  { label: 'Semana', value: 'semana' },
  { label: 'Mes', value: 'mes' },
  { label: 'Día', value: 'dia' },
  { label: 'Agenda', value: 'agenda' },
]

export const CLAVE_VISTA = 'forward:calendario:vista'

const esVista = (v: string | undefined): v is Vista => VISTAS.some((x) => x.value === v)

export function cargarVista(): Vista {
  try {
    const guardada = storage.getString(CLAVE_VISTA)
    return esVista(guardada) ? guardada : VISTA_POR_DEFECTO
  } catch {
    return VISTA_POR_DEFECTO
  }
}

export function guardarVista(vista: Vista): void {
  try {
    storage.set(CLAVE_VISTA, vista)
  } catch {
    // Recordar la vista es una comodidad, no un requisito.
  }
}
