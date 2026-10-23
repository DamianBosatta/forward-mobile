import type { CategoriaItem } from '@/libs/api-client/categorias'

export interface OpcionCategoria {
  id: string
  nombre: string
  /** 1 = Línea, 2 = Familia (se muestra con sangría bajo su Línea). */
  nivel: 1 | 2
}

const porNombre = (a: CategoriaItem, b: CategoriaItem) => (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es')

/**
 * Opciones del selector "Línea / Familia" a partir de la lista plana de GET /Categorias:
 * cada Línea (nivel 1) seguida de sus Familias (nivel 2), ordenadas por nombre. Las inactivas
 * y las de otro nivel no se ofrecen.
 */
export function opcionesLineaFamilia(categorias: CategoriaItem[] | undefined): OpcionCategoria[] {
  const activas = (categorias ?? []).filter((c) => c.id && c.nombre && c.activo !== false)
  const lineas = activas.filter((c) => c.nivel === 1).sort(porNombre)
  return lineas.flatMap((linea) => [
    { id: linea.id!, nombre: linea.nombre!, nivel: 1 as const },
    ...activas
      .filter((c) => c.nivel === 2 && c.categoriaPadreId === linea.id)
      .sort(porNombre)
      .map((f) => ({ id: f.id!, nombre: f.nombre!, nivel: 2 as const })),
  ])
}
