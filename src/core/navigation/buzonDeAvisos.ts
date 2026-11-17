/**
 * Avisos en memoria que una pantalla deja para la que abre después (SEG-11). La ruta solo lleva la clave: un enlace
 * armado afuera (`forward://…?aviso=…&mensaje=…`) no puede poner texto propio, y el aviso se consume al leerlo.
 */
export interface BuzonDeAvisos<A extends { clave: string }> {
  dejar: (id: string, aviso: A) => void
  /** Devuelve (y consume) el aviso dejado para `id`, solo si coincide con la clave que trae la ruta. */
  tomar: (id: string, clave: string | undefined) => A | null
}

export function crearBuzonDeAvisos<A extends { clave: string }>(): BuzonDeAvisos<A> {
  const pendientes = new Map<string, A>()
  return {
    dejar: (id, aviso) => { pendientes.set(id, aviso) },
    tomar: (id, clave) => {
      const a = pendientes.get(id)
      if (!a || a.clave !== clave) return null
      pendientes.delete(id)
      return a
    },
  }
}
