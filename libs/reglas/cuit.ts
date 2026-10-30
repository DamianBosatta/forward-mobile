/**
 * Dígitos y separadores (espacio, punto, guion, barra) y nada más: lo mismo que
 * `Cuit.EsSoloNumero` del backend. Un CUIT con texto anotado no tiene forma canónica y el backend
 * lo rechaza (juicio del PR #714).
 */
const SOLO_NUMERO = /^[0-9 ./-]+$/

/**
 * Los once dígitos de un valor que es un número y nada más; `null` si está vacío, tiene texto o le
 * sobran o le faltan dígitos. Es la forma, no la validez: no mira el verificador.
 */
function onceDigitos(valor: string | null | undefined): string | null {
  if (!valor || !SOLO_NUMERO.test(valor)) return null

  const digitos = valor.replace(/\D/g, '')
  return digitos.length === 11 ? digitos : null
}

/**
 * CUIT check-digit validation (AFIP mod-11).
 *
 * Mirrors `Cuit.EsValido` on the backend: the server is authoritative, this exists so the
 * typo is caught while the person who knows the right number is still looking at the form.
 * A fabricated 11-digit CUIT passes any length check and only blows up months later when
 * an invoice hits AFIP.
 */
export function cuitEsValido(valor: string): boolean {
  const digitos = onceDigitos(valor)
  if (digitos === null) return false

  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const suma = pesos.reduce((acc, peso, i) => acc + peso * Number(digitos[i]), 0)
  const resto = suma % 11
  const verificador = resto === 0 ? 0 : resto === 1 ? -1 : 11 - resto

  return verificador === Number(digitos[10])
}

/**
 * La forma con la que se GUARDA y viaja un CUIT: once dígitos, sin guiones (C-019, bloque 11).
 *
 * Espeja `Cuit.Canonizar` del backend; los dos lados prueban el mismo fixture
 * (`Forward-Api/contrato/cuit-forma.json`). Sólo cambia un valor hecho de dígitos y separadores
 * con once dígitos; cualquier otro (texto anotado, DNI, vacío) vuelve tal cual.
 */
export function canonizarCuit(valor: string): string
export function canonizarCuit(valor: string | null): string | null
export function canonizarCuit(valor: string | null | undefined): string | null | undefined
export function canonizarCuit(valor: string | null | undefined): string | null | undefined {
  return onceDigitos(valor) ?? valor
}

/**
 * `XX-XXXXXXXX-X`, la forma de AFIP, SÓLO para mostrar: la API devuelve los once dígitos y cada
 * pantalla los formatea con esto. Espeja `Cuit.Formatear` (mismo fixture que
 * {@link canonizarCuit}); un valor que no es un CUIT de once dígitos se muestra como vino.
 */
export function formatearCuit(valor: string): string
export function formatearCuit(valor: string | null): string | null
export function formatearCuit(valor: string | null | undefined): string | null | undefined
export function formatearCuit(valor: string | null | undefined): string | null | undefined {
  const digitos = onceDigitos(valor)
  return digitos === null
    ? valor
    : `${digitos.slice(0, 2)}-${digitos.slice(2, 10)}-${digitos.slice(10)}`
}
