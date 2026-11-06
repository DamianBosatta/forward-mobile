import { useCallback, useEffect, useRef, useState } from 'react'
import type { ViewInstance } from 'react-native'
import { useTeclado } from '@/core/utils/useTecladoVisible'
import { espacioBajoTeclado } from './espacioTeclado'

/**
 * Espacio que el teclado le tapa al contenedor de `ref` (0 con el teclado cerrado).
 * Se re-mide en cada cambio de layout: en Android la ventana puede achicarse después del evento.
 * Solo JS: sirve por OTA. Pasale `ref` y `onLayout` al View que llega hasta abajo de la pantalla o del Modal.
 */
export function useEspacioTeclado() {
  const teclado = useTeclado()
  const ref = useRef<ViewInstance>(null)
  const [espacio, setEspacio] = useState(0)

  const medir = useCallback(() => {
    if (!teclado.visible) { setEspacio(0); return }
    // `measure` (pageY) y no `measureInWindow`: en Android éste resta la barra de estado fuera de un Modal
    // translúcido y queda en otro sistema de coordenadas que `screenY` del teclado (medido: 144 px de error).
    ref.current?.measure((_x, _y, _w, h, _pageX, pageY) => {
      setEspacio(espacioBajoTeclado({ tecladoAbierto: true, tecladoArriba: teclado.arriba, pieAbajo: pageY + h }))
    })
  }, [teclado.visible, teclado.arriba])

  useEffect(medir, [medir])
  return { ref, onLayout: medir, tecladoAbierto: teclado.visible, espacio }
}
