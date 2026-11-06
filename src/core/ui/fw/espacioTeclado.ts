/** Lógica pura del pie sobre el teclado (la usan PieFijo y BottomSheet). */

interface EntradaEspacio {
  tecladoAbierto: boolean
  /** Borde superior del teclado, en coordenadas de pantalla. */
  tecladoArriba: number
  /** Borde inferior del contenedor del pie, medido en la ventana, sin el espacio que ya sumamos. */
  pieAbajo: number
}

/**
 * Cuánto hay que subir el pie para que no lo tape el teclado. Se mide en vez de suponer:
 * si la ventana ya se achicó (adjustResize) el pie queda sobre el teclado y da 0, así no se suma dos veces.
 */
export function espacioBajoTeclado({ tecladoAbierto, tecladoArriba, pieAbajo }: EntradaEspacio): number {
  if (!tecladoAbierto) return 0
  return Math.max(0, Math.round(pieAbajo - tecladoArriba))
}

interface EntradaPadding {
  base: number
  inset: number
  usaInset: boolean
  tecladoAbierto: boolean
  espacio: number
}

/** Padding inferior: con el teclado abierto se quita la barra del sistema (el teclado la cubre) y se suma el espacio tapado. */
export function paddingInferiorDelPie({ base, inset, usaInset, tecladoAbierto, espacio }: EntradaPadding): number {
  return base + (usaInset && !tecladoAbierto ? inset : 0) + (tecladoAbierto ? espacio : 0)
}
