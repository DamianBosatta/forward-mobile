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

/**
 * Redondeo de un monto a 2 decimales con el medio hacia afuera del cero: el MISMO criterio que
 * `Dinero.Redondear` del backend (`MidpointRounding.AwayFromZero`, como el `numeric(18,2)` de
 * Postgres). 1,005 → 1,01 y 2,675 → 2,68 de los dos lados (C-015, A-1022).
 *
 * Multiplicar por cien y usar `Math.round` no sirve: `1.005 * 100` da 100,49999999999999 en binario
 * y 1,005 baja a 1,00.
 * Acá se redondea sobre el valor decimal que el número muestra (`toExponential` da la
 * representación más corta que lo identifica, que es lo que el usuario escribió), con enteros.
 *
 * No es el desempate al par de las comisiones (`redondearDosDecimales`): esa es otra regla.
 */
export function redondear2(valor: number): number {
  if (!Number.isFinite(valor)) return valor
  const [mantisa, exponente] = valor.toExponential().split('e')
  const negativo = mantisa.startsWith('-')
  const digitos = mantisa.replace('-', '').replace('.', '')
  const decimales = digitos.length - 1 - Number(exponente)
  if (decimales <= 2) return valor

  const enteros = BigInt(digitos)
  const divisor = 10n ** BigInt(decimales - 2)
  let centavos = enteros / divisor
  if ((enteros % divisor) * 2n >= divisor) centavos += 1n

  const resultado = Number(centavos) / 100
  return negativo && resultado !== 0 ? -resultado : resultado
}

const SIMBOLOS_DE_MONEDA: Readonly<Record<string, string>> = { ARS: '$', USD: 'US$' }

/**
 * El monto con formato argentino, igual que `Dinero.Formatear` del backend: se redondea con
 * `redondear2` y se escribe con punto de miles y coma decimal, siempre dos decimales (`1.234,56`).
 * Con moneda lleva el símbolo: `$ 1.234,56` (ARS) o `US$ 1.234,56` (USD).
 *
 * No usa `Intl`: el resultado no depende del motor ni de los datos de idioma instalados (en mobile
 * `Intl` cambia según el dispositivo). Un valor no finito se muestra como cero.
 */
export function formatearMonto(valor: number, moneda?: string): string {
  const redondeado = redondear2(Number.isFinite(valor) ? valor : 0)
  const [enteros, centavos] = Math.abs(redondeado).toFixed(2).split('.')
  const conMiles = enteros.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const texto = `${redondeado < 0 ? '-' : ''}${conMiles},${centavos}`
  return moneda === undefined ? texto : `${SIMBOLOS_DE_MONEDA[moneda] ?? moneda} ${texto}`
}
