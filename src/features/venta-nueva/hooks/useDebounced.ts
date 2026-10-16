import { useEffect, useState } from 'react'

/** El valor, recién cuando deja de cambiar por `ms` (para no pedir una vista previa por tecla). */
export function useDebounced<T>(valor: T, ms = 400): T {
  const [quieto, setQuieto] = useState(valor)
  const clave = JSON.stringify(valor)
  useEffect(() => {
    const t = setTimeout(() => setQuieto(valor), ms)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, ms])
  return quieto
}
