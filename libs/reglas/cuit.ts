/**
 * CUIT check-digit validation (AFIP mod-11).
 *
 * Mirrors `Cuit.EsValido` on the backend: the server is authoritative, this exists so the
 * typo is caught while the person who knows the right number is still looking at the form.
 * A fabricated 11-digit CUIT passes any length check and only blows up months later when
 * an invoice hits AFIP.
 */
export function cuitEsValido(valor: string): boolean {
  // Sólo dígitos y separadores (espacio, punto, guion, barra), igual que Cuit.EsValido: un CUIT
  // con texto anotado no tiene forma canónica y el backend lo rechaza (juicio del PR #714).
  if (!/^[0-9 ./-]+$/.test(valor ?? '')) return false

  const digitos = (valor ?? '').replace(/\D/g, '')
  if (digitos.length !== 11) return false

  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const suma = pesos.reduce((acc, peso, i) => acc + peso * Number(digitos[i]), 0)
  const resto = suma % 11
  const verificador = resto === 0 ? 0 : resto === 1 ? -1 : 11 - resto

  return verificador === Number(digitos[10])
}
