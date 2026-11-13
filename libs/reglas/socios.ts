/**
 * Reglas de socios que comparten la web y mobile: los campos que exige un cliente nuevo y la
 * validación de la lista de condiciones de pago de un cliente (C-022, X1: una sola copia).
 * `packages/validations` las reexporta con los mismos nombres; mobile las recibe con `sync:reglas`.
 */

const enteroEnRango = (valor: string | undefined, min: number, max: number) =>
  /^\d+$/.test((valor ?? '').trim()) && Number(valor) >= min && Number(valor) <= max

/**
 * Los días que pide cada tipo de condición. Compartido por el proveedor (condición obligatoria) y
 * el cliente (opcional, bloque 7 parte B: si se eligió un plazo, el plazo tiene que estar).
 * Llama a `falla` con el campo (`dias` o `diaDelMes`) y el mensaje.
 */
export function validarPlazoCondicionPago(
  condicion: { tipo?: string; dias?: string; diaDelMes?: string },
  falla: (campo: 'dias' | 'diaDelMes', message: string) => void,
) {
  if (condicion.tipo === 'DiasDesdeEntrega' || condicion.tipo === 'DiasDesdeFactura') {
    if (!enteroEnRango(condicion.dias, 1, 365)) {
      falla('dias', 'Ingresá los días de plazo (entre 1 y 365)')
    }
  } else if (condicion.tipo === 'DiaFijoDelMes') {
    if (!enteroEnRango(condicion.diaDelMes, 1, 31)) {
      falla('diaDelMes', 'Ingresá el día del mes (entre 1 y 31)')
    }
  }
}

/** Error de una fila del editor de condiciones del cliente (`tipo`, `dias` o `diaDelMes`). */
export type ErrorCondicionPagoCliente = Partial<Record<'tipo' | 'dias' | 'diaDelMes', string>>

/**
 * Lo que adelanta la web de la lista de condiciones de un cliente: cada fila con su tipo y plazo en
 * rango (los mismos rangos que el proveedor) y sin filas repetidas. La API sigue mandando
 * (`SocioCondicionPagoRepetida`); esto evita el viaje. Devuelve un error por fila (vacío = bien).
 */
export function validarCondicionesPagoCliente(
  filas: ReadonlyArray<{ tipo?: string; dias?: string; diaDelMes?: string }>,
): ErrorCondicionPagoCliente[] {
  const vistas = new Set<string>()
  return filas.map((fila) => {
    const errores: ErrorCondicionPagoCliente = {}
    if (!fila.tipo) {
      errores.tipo = 'Elegí la condición de pago'
      return errores
    }
    validarPlazoCondicionPago(fila, (campo, message) => {
      errores[campo] = message
    })
    if (Object.keys(errores).length > 0) return errores
    const clave =
      fila.tipo === 'DiasDesdeEntrega' || fila.tipo === 'DiasDesdeFactura'
        ? `${fila.tipo}|${Number(fila.dias)}`
        : fila.tipo === 'DiaFijoDelMes'
          ? `${fila.tipo}|${Number(fila.diaDelMes)}`
          : fila.tipo
    if (vistas.has(clave)) errores.tipo = 'Hay una condición de pago repetida'
    vistas.add(clave)
    return errores
  })
}

/**
 * Fields B4-P2 requires on a NEW cliente (the `When(TipoRaw == 0 && !AltaProvisoria)` block of
 * the backend's `CreateSocioCommandValidator`), with their user-facing messages.
 *
 * Single source for everything the socio form says about them: the schema rejection, the
 * required asterisk and the "faltan completar" warning of the soft edit. The web app's
 * `socios-contrato-backend` gate reads the backend validator and fails if the asterisks drift
 * from it (#631).
 */
export const OBLIGATORIOS_CLIENTE = [
  ['telefono', 'El teléfono es obligatorio en clientes'],
  ['direccion', 'La dirección es obligatoria en clientes'],
  ['nombreFantasia', 'El nombre de fantasía es obligatorio en clientes'],
  ['nombreContacto', 'El nombre de contacto es obligatorio en clientes'],
] as const

export type CampoObligatorioCliente = (typeof OBLIGATORIOS_CLIENTE)[number][0]

/** The field names of {@link OBLIGATORIOS_CLIENTE}, in order. */
export const CAMPOS_OBLIGATORIOS_CLIENTE: readonly CampoObligatorioCliente[] =
  OBLIGATORIOS_CLIENTE.map(([campo]) => campo)
