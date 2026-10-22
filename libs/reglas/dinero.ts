/** pago/monto-dos-decimales: la base guarda numeric(18,2); lo mismo que `Money.CabeEnLaEscala`. */
export const tieneComoMuchoDosDecimales = (n: number): boolean =>
  Math.abs(n * 100 - Math.round(n * 100)) < 1e-9

/**
 * Redondeo a 2 decimales con desempate al par: el MISMO criterio que
 * `Math.Round(x, 2, MidpointRounding.ToEven)` del backend, que redondea ANTES de validar porque
 * el porcentaje se persiste como `numeric(5,2)`.
 *
 * Sin esto, cliente y servidor comparaban números distintos EN LAS DOS DIRECCIONES: `4,999` contra
 * un 5% configurado pasaba acá y el servidor lo rechazaba (redondea a 5,00, que ya no es menor al
 * configurado), y `3,749` contra un 7,5% configurado se rechazaba acá cuando el servidor lo
 * aceptaba (redondea a 3,75, justo el piso).
 */
export function redondearDosDecimales(valor: number): number {
  const escalado = valor * 100
  const entero = Math.floor(escalado)
  const resto = escalado - entero
  // Tolerancia de punto flotante: el empate exacto (.5) casi nunca es exacto en binario, y sin el
  // margen el desempate al par no se aplicaría jamás.
  const EPSILON_EMPATE = 1e-9
  if (Math.abs(resto - 0.5) < EPSILON_EMPATE) {
    return (entero % 2 === 0 ? entero : entero + 1) / 100
  }
  return Math.round(escalado) / 100
}
