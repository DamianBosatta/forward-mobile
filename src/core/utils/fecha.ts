import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Convierte un string de fecha (generalmente UTC del backend) a un objeto Date seguro.
 * Si la fecha no es válida, devuelve null.
 */
export function parseDateSafe(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;
  const parsed = parseISO(dateString);
  return isValid(parsed) ? parsed : null;
}

/**
 * Formatea una fecha con el calendario y el reloj de Argentina, sin importar el huso del teléfono (X9).
 * Con offset (Z, ±hh:mm) es un instante y se convierte a hora argentina; sin offset se muestra tal cual está escrita.
 * Formato por defecto: dd/MM/yyyy HH:mm
 */
export function formatToLocalTime(dateString: string | null | undefined, formatStr: string = 'dd/MM/yyyy HH:mm'): string {
  const date = parseDateSafe(dateString);
  if (!date) return 'Sin registro';

  const p = diaCalendarioSinOffset(dateString) ?? partesArgentina(date.getTime());
  // Fecha con los campos de pared de Argentina en el huso del dispositivo: format los lee sin volver a convertir.
  return format(new Date(p.anio, p.mes, p.dia, p.hora, p.minuto), formatStr, { locale: es });
}

/**
 * Devuelve un formato amigable y relativo como "hace 5 minutos"
 */
export function formatRelativeTime(dateString: string | null | undefined): string {
  const date = parseDateSafe(dateString);
  if (!date) return 'Sin registro';

  return formatDistanceToNow(date, { addSuffix: true, locale: es });
}

/**
 * Formato específico para sólo mostrar la fecha "dd/MM/yyyy"
 */
export function formatToLocalDate(dateString: string | null | undefined): string {
  return formatToLocalTime(dateString, 'dd/MM/yyyy');
}

/** Argentina no tiene horario de verano: UTC-3 fijo. No se usa Intl (Hermes no garantiza timeZone). */
const OFFSET_ARGENTINA_MS = -3 * 60 * 60 * 1000;

export type PartesArgentina = { anio: number; mes: number; dia: number; diaSemana: number; hora: number; minuto: number };

/** Calendario y reloj de Argentina para un instante, sin importar el huso del teléfono. mes: 0-11. */
export function partesArgentina(ms: number): PartesArgentina {
  const d = new Date(ms + OFFSET_ARGENTINA_MS);
  return {
    anio: d.getUTCFullYear(),
    mes: d.getUTCMonth(),
    dia: d.getUTCDate(),
    diaSemana: d.getUTCDay(),
    hora: d.getUTCHours(),
    minuto: d.getUTCMinutes(),
  };
}

/** Día calendario argentino de un instante como YYYY-MM-DD (el que interpreta el servidor). */
export function diaArgentina(ms: number): string {
  const p = partesArgentina(ms);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${p.anio}-${dos(p.mes + 1)}-${dos(p.dia)}`;
}

const SIN_OFFSET = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?$/;

/**
 * Business calendar day (and clock, when written) in an offset-less string ("2026-10-22" or
 * "2026-10-22T09:15:00"), read as written: it is not an instant, so the device time zone must not move it (X9).
 * Without a time part hora and minuto are 0. Null when the string has an offset (Z, ±hh:mm) or is not a date;
 * those are instants and go through `partesArgentina`. mes: 0-11.
 */
export function diaCalendarioSinOffset(texto: string | null | undefined): Pick<PartesArgentina, 'anio' | 'mes' | 'dia' | 'hora' | 'minuto'> | null {
  const m = texto ? SIN_OFFSET.exec(texto.trim()) : null;
  if (!m) return null;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const [hora, minuto] = [Number(m[4] ?? 0), Number(m[5] ?? 0)];
  const d = new Date(Date.UTC(anio, mes, dia));
  const diaValido = d.getUTCMonth() === mes && d.getUTCDate() === dia;
  return diaValido && hora < 24 && minuto < 60 ? { anio, mes, dia, hora, minuto } : null;
}

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Milisegundos hasta la próxima 00:00 de Argentina (a las 00:00:00 exactas falta un día entero). */
export function msHastaProximaMedianocheArgentina(nowMs: number): number {
  const enDia = (((nowMs + OFFSET_ARGENTINA_MS) % MS_POR_DIA) + MS_POR_DIA) % MS_POR_DIA;
  return MS_POR_DIA - enDia;
}

/** "aaaa-mm-dd" (or an ISO datetime, time part ignored) → "dd/mm/aaaa". Calendar date, no timezone conversion. */
export const ddmmaaaa = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

/** Today's Argentina calendar day as "dd/mm/aaaa". */
export const hoyTexto = () => ddmmaaaa(diaArgentina(Date.now()))
