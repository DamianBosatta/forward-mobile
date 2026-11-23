/** Valores del enum MetodoEntrega del backend y sus nombres. */
const POR_NOMBRE: Record<string, number> = { LogisticaPropia: 1, RetiroEnLocal: 2, Expreso: 3 }

type Metodo = number | null | undefined

const resolver = (metodo: Metodo, nombre: string | null | undefined): number | undefined =>
  metodo != null ? metodo : nombre ? POR_NOMBRE[nombre] : undefined

/** ¿Es retiro en el local? Acepta el número del enum o, si no hay, su nombre. */
export function esRetiroEnLocal(metodo: Metodo, nombre?: string | null): boolean {
  return resolver(metodo, nombre) === 2
}

/**
 * Método de entrega como la web (MetodoBadge). Corta: "Logística", "Retiro", "Expreso" (tablero y detalle de preparación).
 * Larga (`larga: true`): "Retiro en el local" (pantallas de venta). Un método desconocido muestra su nombre.
 */
export function etiquetaMetodo(metodo: Metodo, nombre: string | null | undefined, opciones?: { larga?: boolean }): string {
  switch (resolver(metodo, nombre)) {
    case 1: return 'Logística'
    case 2: return opciones?.larga ? 'Retiro en el local' : 'Retiro'
    case 3: return 'Expreso'
    default: return nombre ?? ''
  }
}
