import type { SocioListDto } from '@/libs/api-client/types'

export const SECCION_OTROS = '#'
export const SECCION_SIN_DIRECCION = 'Sin dirección'

export interface SeccionDeClientes {
  title: string
  data: SocioListDto[]
}

/** Primera letra de la dirección, en mayúscula y sin tilde; "#" si no empieza con una letra. */
export function letraDeDireccion(direccion?: string | null): string {
  const inicial = (direccion ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').charAt(0).toUpperCase()
  return /^[A-Z]$/.test(inicial) ? inicial : SECCION_OTROS
}

/**
 * Agrupa por la letra de la dirección conservando el orden en que el servidor los dio (ordenados por
 * dirección): un encabezado por letra, y los que no tienen dirección en una sección final.
 */
export function seccionesPorLetra(clientes: readonly SocioListDto[]): SeccionDeClientes[] {
  const porTitulo = new Map<string, SocioListDto[]>()
  const sinDireccion: SocioListDto[] = []
  for (const c of clientes) {
    if (!c.direccion?.trim()) {
      sinDireccion.push(c)
      continue
    }
    const titulo = letraDeDireccion(c.direccion)
    const grupo = porTitulo.get(titulo)
    if (grupo) grupo.push(c)
    else porTitulo.set(titulo, [c])
  }
  const secciones = [...porTitulo].map(([title, data]) => ({ title, data }))
  if (sinDireccion.length > 0) secciones.push({ title: SECCION_SIN_DIRECCION, data: sinDireccion })
  return secciones
}
