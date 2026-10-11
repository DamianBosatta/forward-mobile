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
 * Formatea una fecha UTC al huso horario local del dispositivo (Argentina o donde esté el usuario).
 * Formato por defecto: dd/MM/yyyy HH:mm
 */
export function formatToLocalTime(dateString: string | null | undefined, formatStr: string = 'dd/MM/yyyy HH:mm'): string {
  const date = parseDateSafe(dateString);
  if (!date) return 'Sin registro';

  // Al pasarle un objeto Date (creado con parseISO) a la función format, 
  // date-fns automáticamente utiliza la zona horaria del sistema local.
  return format(date, formatStr, { locale: es });
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

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Milisegundos hasta la próxima 00:00 de Argentina (a las 00:00:00 exactas falta un día entero). */
export function msHastaProximaMedianocheArgentina(nowMs: number): number {
  const enDia = (((nowMs + OFFSET_ARGENTINA_MS) % MS_POR_DIA) + MS_POR_DIA) % MS_POR_DIA;
  return MS_POR_DIA - enDia;
}
