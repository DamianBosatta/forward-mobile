/** Clave de idempotencia de una operación (forward-system): única por intento del usuario, < 200 caracteres. */
export const nuevaClaveIdempotencia = () =>
  `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`

const MAX_INTENTOS = 50

/**
 * Una clave por intento del usuario, para las llamadas que no la guardan en un formulario propio.
 *
 * - `paraCuerpo(cuerpo, ruta)` devuelve SIEMPRE la misma clave mientras el cuerpo (sin la clave) y la ruta (el id que va en la URL y no en
 *   el cuerpo; el servidor lo cuenta como parte del cuerpo) sea el mismo: un doble toque, un reintento tras un corte de red o un reenvío de la cola mandan la misma
 *   clave y el servidor devuelve lo ya grabado. Si el usuario editó el formulario tras un error el cuerpo cambió: es
 *   otro intento y sale otra clave, porque el servidor responde 409 a la misma clave con otro cuerpo.
 * - `terminar(cuerpo)` se llama al terminar bien: lo que venga después con el mismo cuerpo es otra operación.
 * - Cada cuerpo tiene su clave: dos operaciones distintas a la par (dos compras) no se pisan.
 */
export function crearIntento() {
  const claves = new Map<string, string>()
  const huella = (cuerpo: unknown, ruta: string) => JSON.stringify([ruta, cuerpo])
  return {
    paraCuerpo(cuerpo: unknown, ruta = ''): string {
      const h = huella(cuerpo, ruta)
      const guardada = claves.get(h)
      if (guardada) return guardada
      const nueva = nuevaClaveIdempotencia()
      claves.set(h, nueva)
      if (claves.size > MAX_INTENTOS) claves.delete(claves.keys().next().value as string)
      return nueva
    },
    terminar(cuerpo: unknown, ruta = '') { claves.delete(huella(cuerpo, ruta)) },
  }
}
export type Intento = ReturnType<typeof crearIntento>

/**
 * Manda `cuerpo` con la clave del intento. Si sale bien, el intento termina (la próxima vez es otra clave); si falla
 * (red, 4xx, 5xx) la clave queda: el servidor no guarda los fallos, así que reintentar con la misma es seguro.
 */
export async function conClave<C extends object, R>(
  intento: Intento,
  cuerpo: C,
  enviar: (conClave: C & { claveIdempotencia: string }) => Promise<R>,
  ruta = '',
): Promise<R> {
  const respuesta = await enviar({ ...cuerpo, claveIdempotencia: intento.paraCuerpo(cuerpo, ruta) })
  intento.terminar(cuerpo, ruta)
  return respuesta
}
