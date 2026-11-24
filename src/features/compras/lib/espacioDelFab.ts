import { space } from '@/libs/theme'

/** Alto del botón flotante (`fw/Fab`: 56). */
export const ALTO_FAB = 56

/**
 * Receta del espacio bajo una lista con botón flotante: alto del botón + su separación del borde
 * (`space[6]`, la misma que usa `Fab`) + un respiro (`space[4]`) + el inset inferior.
 * Va en el `contentContainerStyle.paddingBottom` de CADA lista que lleve un `Fab` (también Borradores).
 * Solo libera la última tarjeta al final del desplazamiento.
 */
export const espacioBajoElFab = (insetInferior: number) => ALTO_FAB + space[6] + space[4] + insetInferior
