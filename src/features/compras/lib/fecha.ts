import { diaArgentina } from '@/src/utils/date'

/** "dd/mm/aaaa" → "aaaa-mm-dd" (fecha calendario, sin zona); null si no es una fecha válida. */
export function fechaIso(texto: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto.trim())
  if (!m) return null
  const [d, mes, a] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const f = new Date(Date.UTC(a, mes - 1, d))
  if (f.getUTCFullYear() !== a || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== d) return null
  return `${a}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** "aaaa-mm-dd" → "dd/mm/aaaa". */
export const ddmmaaaa = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
export const hoyTexto = () => ddmmaaaa(diaArgentina(Date.now()))
