import { useEffect, useState } from 'react'
import { Keyboard, Platform, type KeyboardEvent } from 'react-native'

export interface EstadoTeclado {
  visible: boolean
  /** Borde superior del teclado en coordenadas de pantalla (0 si está cerrado o no se sabe). */
  arriba: number
}

const CERRADO: EstadoTeclado = { visible: false, arriba: 0 }

/** Estado del teclado: visible y dónde empieza. Una sola suscripción por componente. */
export function useTeclado(): EstadoTeclado {
  const [estado, setEstado] = useState<EstadoTeclado>(CERRADO)
  useEffect(() => {
    const ios = Platform.OS === 'ios'
    const mostrar = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e: KeyboardEvent) =>
      setEstado({ visible: true, arriba: e?.endCoordinates?.screenY ?? 0 }),
    )
    const ocultar = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setEstado(CERRADO))
    return () => { mostrar.remove(); ocultar.remove() }
  }, [])
  return estado
}

/** true mientras el teclado está abierto (en Android con edge-to-edge el KeyboardAvoidingView no alcanza). */
export function useTecladoVisible(): boolean {
  return useTeclado().visible
}
