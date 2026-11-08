import { useCallback } from 'react'
import { create } from 'zustand'

/**
 * Filtros de las pantallas con lista (S4): un valor por pantalla (la `clave`), en memoria y mientras
 * dure la sesión de la app. Al volver de un detalle, una edición o una alta, la pantalla se monta de
 * nuevo y encuentra la búsqueda y los filtros como los dejó el usuario; sólo cambian cuando él los
 * cambia o los limpia. No se guarda en el teléfono: al cerrar la app arranca limpio.
 */
interface FiltrosStore {
  valores: Record<string, unknown>
  poner: (clave: string, valor: unknown) => void
  quitar: (clave: string) => void
}

export const useFiltrosStore = create<FiltrosStore>((set) => ({
  valores: {},
  poner: (clave, valor) => set((s) => ({ valores: { ...s.valores, [clave]: valor } })),
  quitar: (clave) =>
    set((s) => {
      const { [clave]: _quitado, ...resto } = s.valores
      return { valores: resto }
    }),
}))

/** Vacía todos los filtros guardados (cierre de sesión y tests). */
export function olvidarFiltros(): void {
  useFiltrosStore.setState({ valores: {} })
}

/**
 * Como `useState`, pero el valor sobrevive a que la pantalla se desmonte. `limpiar` vuelve al valor
 * inicial. Claves por pantalla, p. ej. `'socios.lista'`.
 */
export function useFiltroPersistente<T>(clave: string, inicial: T): [T, (siguiente: T | ((previo: T) => T)) => void, () => void] {
  const guardado = useFiltrosStore((s) => s.valores[clave])
  const valor = (clave in useFiltrosStore.getState().valores ? guardado : inicial) as T

  const poner = useCallback(
    (siguiente: T | ((previo: T) => T)) => {
      const { valores, poner: guardar } = useFiltrosStore.getState()
      const previo = (clave in valores ? valores[clave] : inicial) as T
      guardar(clave, typeof siguiente === 'function' ? (siguiente as (p: T) => T)(previo) : siguiente)
    },
    // `inicial` es un literal nuevo en cada render: la clave es lo que identifica el filtro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clave],
  )
  const limpiar = useCallback(() => useFiltrosStore.getState().quitar(clave), [clave])
  return [valor, poner, limpiar]
}
