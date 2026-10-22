import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Convierte un string de fecha (generalmente UTC del backend) a un objeto Date seguro.
 * Si la fecha no es válida, devuelve null.
 */
/** Argentina no tiene horario de verano: UTC-3 fijo. No se usa Intl (Hermes no garantiza timeZone). */
const OFFSET_ARGENTINA_MS = -3 * 60 * 60 * 1000;

export function parseDateSafe(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;
  const parsed = parseISO(dateString);
  return isValid(parsed) ? parsed : null;
}

/** Día calendario sin hora ("2026-10-10"): no es un instante, no se corre de huso. */
const ES_DIA_CALENDARIO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Formatea un instante (UTC del backend) en hora de Argentina, reloj de 24 h, sin importar el huso
 * del teléfono. Un día calendario `YYYY-MM-DD` (fecha de entrega, por ejemplo) se muestra tal cual,
 * sin correrse un día en ningún huso.
 * Formato por defecto: dd/MM/yyyy HH:mm
 */
export function formatToLocalTime(dateString: string | null | undefined, formatStr: string = 'dd/MM/yyyy HH:mm'): string {
  const date = parseDateSafe(dateString);
  if (!date) return 'Sin registro';

  if (dateString && ES_DIA_CALENDARIO.test(dateString)) {
    // parseISO lo dejó en 00:00 local: sus campos locales ya son el día calendario.
    return format(date, formatStr, { locale: es });
  }
  const p = partesArgentina(date.getTime());
  const segundos = new Date(date.getTime() + OFFSET_ARGENTINA_MS).getUTCSeconds();
  // Fecha local con los mismos campos argentinos, solo para dar formato (igual que tituloDelDia).
  return format(new Date(p.anio, p.mes, p.dia, p.hora, p.minuto, segundos), formatStr, { locale: es });
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
 * Formato específico para sólo mostrar la fecha "dd/MM/yyyy" (día de Argentina)
 */
export function formatToLocalDate(dateString: string | null | undefined): string {
  return formatToLocalTime(dateString, 'dd/MM/yyyy');
}

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

const dos = (n: number) => String(n).padStart(2, '0');

/** Ms (UTC) de un día calendario `YYYY-MM-DD`, o null si no es una fecha válida (el 2026-02-30 no existe). */
export function diaCalendarioAMs(dia: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return diaDeUtc(ms) === dia ? ms : null;
}

const diaDeUtc = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getUTCFullYear()).padStart(4, '0')}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())}`;
};

/** Suma (o resta, con negativos) días a un día calendario `YYYY-MM-DD`; aritmética de calendario pura. */
export function sumarDiasADia(dia: string, dias: number): string {
  return diaDeUtc((diaCalendarioAMs(dia) ?? 0) + dias * MS_POR_DIA);
}

/** Primer y último día (YYYY-MM-DD) de un mes del calendario. mes: 0-11. */
export function rangoDelMes(anio: number, mes: number): { desde: string; hasta: string } {
  const ultimo = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  return { desde: `${anio}-${dos(mes + 1)}-01`, hasta: `${anio}-${dos(mes + 1)}-${dos(ultimo)}` };
}

/** Primer día (YYYY-MM-DD) del mes argentino de un instante. */
export function primerDiaDelMesArgentina(ms: number): string {
  const p = partesArgentina(ms);
  return `${p.anio}-${dos(p.mes + 1)}-01`;
}

/** Instante en que empieza (00:00 de Argentina) un día calendario `YYYY-MM-DD`. */
export function inicioDeDiaArgentinaMs(dia: string): number {
  return (diaCalendarioAMs(dia) ?? 0) - OFFSET_ARGENTINA_MS;
}
