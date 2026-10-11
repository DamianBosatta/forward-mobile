/**
 * Pesos argentinos: `$ 12.345,67`. El espacio es duro (no corta la línea entre
 * el signo y la cifra). Sin dato muestra un guion: un importe que no llegó del
 * servidor no es $ 0. Sin Intl para no depender del ICU del motor.
 */
export function formatImporte(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return '—'
  const [entero, decimales] = Math.abs(valor).toFixed(2).split('.')
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const signo = valor < 0 && Number(entero + decimales) !== 0 ? '-' : ''
  return `${signo}$ ${conMiles},${decimales}`
}
