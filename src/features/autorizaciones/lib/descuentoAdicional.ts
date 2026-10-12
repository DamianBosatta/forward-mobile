/**
 * Descuento adicional al autorizar (`descuentoAdicionalPorcentaje` de AutorizarVentaCommand): se
 * revisa solo el formato y el rango, como pide el validador del servidor (más de 0, hasta 100,
 * hasta 2 decimales). Si el descuento deja una línea debajo del costo, lo dice el servidor.
 * Vacío o 0 = sin descuento adicional: no se manda el campo.
 */
export function leerDescuentoAdicional(texto: string): { valor: number | null; error?: string } {
  const limpio = texto.trim().replace(',', '.')
  if (limpio === '') return { valor: null }
  if (!/^\d+(\.\d*)?$/.test(limpio)) return { valor: null, error: 'Escribí un número, por ejemplo 5 o 2,5.' }
  if ((limpio.split('.')[1] ?? '').length > 2) return { valor: null, error: 'Admite hasta 2 decimales.' }
  const valor = Number(limpio)
  if (valor > 100) return { valor: null, error: 'Tiene que estar entre 0 y 100.' }
  return { valor: valor === 0 ? null : valor }
}
