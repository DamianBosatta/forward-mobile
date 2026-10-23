/**
 * Campos sensibles de un socio (razón social, CUIT y dirección): identidad fiscal y destino del camión.
 * Misma regla que la web (`SocioFormPage`, B10-P5): en EDICIÓN solo los cambia un administrador
 * (`isAdmin()`); quien no lo es los ve bloqueados y pide el cambio por solicitud. En el alta no hay
 * identidad que proteger, y completar un hueco (campo vacío) tampoco requiere trámite.
 */
export interface SensiblesDelSocio {
  razonSocial?: string | null
  cuit?: string | null
  direccion?: string | null
}

export interface BloqueoDeSensibles {
  razonSocial: boolean
  cuit: boolean
  direccion: boolean
}

const lleno = (v?: string | null) => Boolean(v?.trim())

export function sensiblesBloqueados(esAdmin: boolean, editando: boolean, guardado?: SensiblesDelSocio | null): BloqueoDeSensibles {
  const bloquea = editando && !esAdmin
  return {
    // La web bloquea la razón social siempre en edición no-admin; CUIT y dirección, solo si ya tienen valor.
    razonSocial: bloquea,
    cuit: bloquea && lleno(guardado?.cuit),
    direccion: bloquea && lleno(guardado?.direccion),
  }
}

/** El pedido de cambio (y su aviso) aplica a quien edita el cliente sin ser administrador. */
export function puedePedirCambio(esAdmin: boolean, puedeEditar: boolean): boolean {
  return puedeEditar && !esAdmin
}
