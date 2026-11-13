import { ddmmaaaa, diaArgentina, parseDateSafe } from '@/core/utils/fecha'
import { horaDe } from '@/features/ventas/lib/agruparPorDia'

/** Instante del servidor → "dd/mm/aaaa HH:mm" con el día y la hora de Argentina (X9); null sin fecha válida. */
export function fechaHoraTexto(iso: string | null | undefined): string | null {
  const f = parseDateSafe(iso)
  if (!f) return null
  return `${ddmmaaaa(diaArgentina(f.getTime()))} ${horaDe(iso)}`
}

/** "dd/mm/aaaa" → "aaaa-mm-dd" (fecha calendario, sin zona); null si no es una fecha válida. */
export function fechaIso(texto: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto.trim())
  if (!m) return null
  const [d, mes, a] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const f = new Date(Date.UTC(a, mes - 1, d))
  if (f.getUTCFullYear() !== a || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== d) return null
  return `${a}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

/**
 * "aaaa-mm-dd" (`fechaEsperadaRecepcion` del servidor, día calendario) → "Llega jue 8".
 * Null sin fecha: servidor anterior, compra que no está por recibir o proveedor sin franja.
 */
export function llegaTexto(iso: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '')
  if (!m) return null
  const dia = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return `Llega ${DIAS_CORTOS[dia.getUTCDay()]} ${dia.getUTCDate()}`
}

/** Franja de entrega del proveedor: "lun 08:00-12:00, jue 08:00-12:00". Día como el DayOfWeek de .NET (0 = domingo). */
export function franjaTexto(f: ReadonlyArray<{ dia: number; desde: string; hasta: string }> | null | undefined): string | null {
  if (!f || f.length === 0) return null
  return f.map((x) => `${DIAS_CORTOS[x.dia] ?? x.dia} ${x.desde.slice(0, 5)}-${x.hasta.slice(0, 5)}`).join(', ')
}
