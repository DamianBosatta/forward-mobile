import { useEffect, useState } from 'react'

/**
 * Valor con retardo: devuelve `value` recién cuando dejó de cambiar por `delayMs`. Mismo hook que
 * la web (`forward-frontend/apps/web/src/shared/hooks/useDebouncedValue.ts`), con una diferencia:
 * compara por contenido, no por identidad. Las vistas previas le pasan un objeto armado en cada
 * render; comparado por identidad, el retardo se reiniciaría en cada render y nunca terminaría.
 * Para strings y números es lo mismo que la web.
 *
 * Reemplaza los `useEffect` + `setTimeout` copiados a mano en el buscador de la venta, la
 * Transferencia y las vistas previas de la venta nueva.
 */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value)
  const clave = JSON.stringify(value)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
    // `clave` representa a `value`: cambia solo cuando cambia su contenido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, delayMs])

  return debounced
}
