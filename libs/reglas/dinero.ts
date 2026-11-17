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
 * Un decimal exacto: `enteros / 10^escala` (AR-R1). Los montos se suman, se restan y se
 * multiplican acá, en enteros, como el `decimal` del backend: los `number` de JS no representan
 * 9,595 ni 0,035 (`10.1 * 0.95` da 9.594999…), y operar en binario corría el redondeo un centavo.
 */
export interface Decimal {
  readonly enteros: bigint
  readonly escala: number
}

/**
 * El valor decimal que el número muestra, sin ruido binario: `toExponential` da la representación
 * más corta que lo identifica, que es lo que el usuario escribió. Es el ÚNICO parser de montos:
 * `redondear2` y el total de la venta lo usan. El número tiene que ser finito.
 */
export function aDecimal(valor: number): Decimal {
  const [mantisa, exponente] = valor.toExponential().split('e')
  const negativo = mantisa.startsWith('-')
  const digitos = mantisa.replace('-', '').replace('.', '')
  const escala = digitos.length - 1 - Number(exponente)
  const sinSigno = BigInt(digitos)
  const base = negativo ? -sinSigno : sinSigno
  return escala >= 0
    ? { enteros: base, escala }
    : { enteros: base * 10n ** BigInt(-escala), escala: 0 }
}

/** El número más cercano al decimal exacto (una sola conversión, sin pasos intermedios en binario). */
export function aNumero(d: Decimal): number {
  return Number(`${d.enteros}e-${d.escala}`)
}

const alinear = (a: Decimal, b: Decimal): [bigint, bigint, number] => {
  const escala = Math.max(a.escala, b.escala)
  return [
    a.enteros * 10n ** BigInt(escala - a.escala),
    b.enteros * 10n ** BigInt(escala - b.escala),
    escala,
  ]
}

export const multiplicarDecimales = (a: Decimal, b: Decimal): Decimal => ({
  enteros: a.enteros * b.enteros,
  escala: a.escala + b.escala,
})

export const sumarDecimales = (a: Decimal, b: Decimal): Decimal => {
  const [x, y, escala] = alinear(a, b)
  return { enteros: x + y, escala }
}

export const restarDecimales = (a: Decimal, b: Decimal): Decimal => {
  const [x, y, escala] = alinear(a, b)
  return { enteros: x - y, escala }
}

/** a / 100, exacto. */
export const dividirPorCien = (a: Decimal): Decimal => ({
  enteros: a.enteros,
  escala: a.escala + 2,
})

/**
 * El decimal a 2 decimales con el medio hacia afuera del cero: el MISMO criterio que
 * `Dinero.Redondear` del backend (`MidpointRounding.AwayFromZero`, como el `numeric(18,2)` de
 * Postgres). Redondea el decimal exacto, no el número que lo aproxima.
 */
export function redondearDecimal(d: Decimal): Decimal {
  if (d.escala <= 2) return d
  const negativo = d.enteros < 0n
  const sinSigno = negativo ? -d.enteros : d.enteros
  const divisor = 10n ** BigInt(d.escala - 2)
  let centavos = sinSigno / divisor
  if ((sinSigno % divisor) * 2n >= divisor) centavos += 1n
  return { enteros: negativo ? -centavos : centavos, escala: 2 }
}

/**
 * Redondeo de un monto a 2 decimales con el medio hacia afuera del cero (`redondearDecimal` sobre
 * el decimal que el número muestra). 1,005 → 1,01 y 2,675 → 2,68 de los dos lados (C-015, A-1022).
 *
 * Multiplicar por cien y usar `Math.round` no sirve: `1.005 * 100` da 100,49999999999999 en binario
 * y 1,005 baja a 1,00.
 *
 * No es el desempate al par de las comisiones (`redondearDosDecimales`): esa es otra regla.
 */
export function redondear2(valor: number): number {
  if (!Number.isFinite(valor)) return valor
  const decimal = aDecimal(valor)
  return decimal.escala <= 2 ? valor : aNumero(redondearDecimal(decimal))
}

/** `redondear(a × b)`: el importe de un renglón (cantidad × precio), como `Money.ComoSePersiste`. */
export function multiplicarYRedondear(a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.NaN
  return aNumero(redondearDecimal(multiplicarDecimales(aDecimal(a), aDecimal(b))))
}

/** `redondear(base × (1 − pct / 100))`: el precio con un descuento porcentual. */
export function conDescuento(base: number, descuentoPct: number): number {
  if (!Number.isFinite(base) || !Number.isFinite(descuentoPct)) return Number.NaN
  const factor = restarDecimales(aDecimal(100), aDecimal(descuentoPct))
  return aNumero(redondearDecimal(dividirPorCien(multiplicarDecimales(aDecimal(base), factor))))
}

/**
 * La suma exacta de montos (como la suma de `decimal` del servidor): `0.1 + 0.2` da 0,3 y no
 * 0,30000000000000004. Con un monto no finito da `NaN`. No redondea: los montos ya tienen sus
 * decimales.
 */
export function sumarMontos(montos: readonly number[]): number {
  if (!montos.every(Number.isFinite)) return Number.NaN
  return aNumero(
    montos.reduce<Decimal>((suma, m) => sumarDecimales(suma, aDecimal(m)), {
      enteros: 0n,
      escala: 0,
    }),
  )
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
