import React, { createContext, useContext } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { space } from '@/libs/theme'

/** `true` cuando la pantalla ya está sobre una barra inferior que absorbe la barra del sistema (BottomBar). */
const SobreBarraInferior = createContext(false)

/** Lo pone ConAccesosRapidos alrededor del contenido: dentro, ni PieFijo ni Fab ni los scrolls suman la barra del sistema otra vez. */
export function SobreBarraInferiorProvider({ children }: { children: React.ReactNode }) {
  return <SobreBarraInferior.Provider value>{children}</SobreBarraInferior.Provider>
}

/** Alto de la barra del sistema (gestos / 3 botones) que el contenido tiene que respetar abajo; 0 si ya hay una BottomBar debajo. */
export function useInsetInferior(): number {
  const { bottom } = useSafeAreaInsets()
  return useContext(SobreBarraInferior) ? 0 : bottom
}

/**
 * Relleno inferior del contenido de un scroll o lista que termina la pantalla sin pie:
 * el último elemento queda sobre la barra del sistema. `base` por defecto space[4].
 */
export function usePaddingFinalDePantalla(base: number = space[4]): number {
  return base + useInsetInferior()
}
