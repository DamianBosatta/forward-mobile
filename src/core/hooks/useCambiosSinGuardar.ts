import { useEffect, useRef, useState } from 'react'
import { Alert } from 'react-native'
import { usePreventRemove } from 'expo-router/react-navigation'

export const TITULO_SALIR_SIN_GUARDAR = 'Salir sin guardar'
export const MENSAJE_SALIR_SIN_GUARDAR = 'Hay cambios sin guardar. Si salís, se pierden.'

type Opciones = {
  /** Cuándo `valor` ya es el punto de partida (por ejemplo, tras cargar el registro a editar). Por defecto, desde el primer render. */
  listo?: boolean
  /** `false` cuando ya se guardó o no corresponde avisar. Por defecto, activo. */
  activo?: boolean
}

/**
 * Avisa antes de salir de un formulario con cambios sin guardar: flecha de la barra, botón atrás de Android y
 * gesto pasan por el mismo aviso. Los cambios son lo que difiere de `valor` tal como estaba cuando `listo`
 * se hizo verdadero. Tras guardar, `soltar()` deja navegar sin preguntar.
 */
export function useCambiosSinGuardar(valor: unknown, { listo = true, activo = true }: Opciones = {}) {
  const base = useRef<string | null>(null)
  const actual = JSON.stringify(valor)
  if (listo && base.current === null) base.current = actual
  const [suelto, setSuelto] = useState(false)
  const hayCambios = listo && base.current !== null && base.current !== actual
  const prevenir = hayCambios && activo && !suelto

  const desactivar = usePreventRemove(prevenir, ({ repeat }) => {
    Alert.alert(TITULO_SALIR_SIN_GUARDAR, MENSAJE_SALIR_SIN_GUARDAR, [
      { text: 'Seguir editando', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => { setSuelto(true); repeat() } },
    ])
  })

  // Un cambio nuevo después de soltar (formulario que sigue abierto) vuelve a avisar.
  useEffect(() => { if (suelto) setSuelto(false) }, [actual]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    hayCambios,
    soltar: () => { setSuelto(true); desactivar() },
  }
}
