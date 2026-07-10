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
