import React from 'react'
import { screen, userEvent } from '@testing-library/react-native'

/**
 * Cámara propia del chofer (lámina ChoferCamara) simulada para jest. Uso:
 * `jest.mock('expo-camera', () => require('@/features/logistica/__testing__/camara').expoCameraSimulada)`.
 * El disparador llama a `tomarFoto`; por defecto devuelve una foto nueva por disparo.
 */
export const tomarFoto = jest.fn()
export const permisoCamara = { actual: { granted: true, canAskAgain: true } as { granted: boolean; canAskAgain: boolean } | null }

export const expoCameraSimulada = {
  useCameraPermissions: () => [permisoCamara.actual, jest.fn()],
  CameraView: React.forwardRef(function CameraSimulada(_props: object, ref: React.Ref<{ takePictureAsync: (o?: object) => Promise<unknown> }>) {
    React.useImperativeHandle(ref, () => ({ takePictureAsync: (o?: object) => tomarFoto(o) }))
    return null
  }),
}

/** Vuelve la cámara al estado de arranque: permiso dado y una foto distinta por disparo. */
export function reiniciarCamara() {
  let n = 0
  permisoCamara.actual = { granted: true, canAskAgain: true }
  tomarFoto.mockReset()
  tomarFoto.mockImplementation(() => Promise.resolve({ uri: `file:///foto-${++n}.jpg` }))
}

/** Toca "Sacar foto …" del formulario y después el disparador de la cámara propia. */
export async function sacarFoto(etiqueta: string) {
  await userEvent.press(screen.getByLabelText(etiqueta))
  await userEvent.press(await screen.findByLabelText('Sacar la foto'))
}
