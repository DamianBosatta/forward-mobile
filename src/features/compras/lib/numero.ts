/**
 * Cómo se nombra una compra en pantalla: "C-00232" con el número correlativo del servidor
 * (forward-system 9C). Un servidor anterior no lo manda: se cae a los primeros 8 caracteres del
 * id, que es lo que el buscador del servidor también entiende.
 */
export function numeroDeCompra(compra: { id: string; numero?: number | null }): string {
  return typeof compra.numero === 'number' && compra.numero > 0
    ? `C-${String(compra.numero).padStart(5, '0')}`
    : compra.id.slice(0, 8).toUpperCase()
}
