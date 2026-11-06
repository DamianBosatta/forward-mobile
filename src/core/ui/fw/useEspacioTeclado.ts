import { useCallback, useEffect, useRef, useState } from 'react'
import type { View } from 'react-native'
import { useTeclado } from '@/core/utils/useTecladoVisible'
import { espacioBajoTeclado } from './espacioTeclado'

/**
 * Espacio que el teclado le tapa al contenedor de `ref` (0 con el teclado cerrado).
 * Se re-mide en cada cambio de layout: en Android la ventana puede achicarse después del evento.
 * Solo JS: sirve por OTA. Pasale `ref` y `onLayout` al View que llega hasta abajo de la pantalla o del Modal.
 */
export function useEspacioTeclado() {
  const teclado = useTeclado()
  const ref = useRef<View>(null)
  const [espacio, setEspacio] = useState(0)

  const medir = useCallback(() => {
    if (!teclado.visible) { setEspacio(0); return }
    ref.current?.measureInWindow((_x, y, _w, h) => {
      setEspacio(espacioBajoTeclado({ tecladoAbierto: true, tecladoArriba: teclado.arriba, pieAbajo: y + h }))
    })
  }, [teclado.visible, teclado.arriba])

  useEffect(medir, [medir])
  return { ref, onLayout: medir, tecladoAbierto: teclado.visible, espacio }
}
