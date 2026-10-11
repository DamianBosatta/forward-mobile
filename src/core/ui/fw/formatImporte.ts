/**
 * Pesos argentinos: `$ 12.345,67`. El espacio es duro (no corta la línea entre
 * el signo y la cifra). Sin dato muestra un guion: un importe que no llegó del
 * servidor no es $ 0. Sin Intl para no depender del ICU del motor.
 * `moneda`: otra que ARS va con su código en lugar del signo (`USD 1.200,00`).
 * `centavos: false` redondea a la unidad, para los totales de un vistazo (Inicio).
 */
export function formatImporte(
  valor: number | null | undefined,
  { moneda, centavos = true }: { moneda?: string | null; centavos?: boolean } = {},
): string {
  if (valor == null || !Number.isFinite(valor)) return '—'
  const [entero, decimales = ''] = Math.abs(valor).toFixed(centavos ? 2 : 0).split('.')
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const signo = valor < 0 && Number(entero + decimales) !== 0 ? '-' : ''
  const simbolo = !moneda || moneda === 'ARS' ? '$' : moneda
  return `${signo}${simbolo} ${conMiles}${decimales ? `,${decimales}` : ''}`
}
