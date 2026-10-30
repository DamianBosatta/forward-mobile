import { useEnvioConsolaSinSenal } from './useColaConsola'

/** Sin pantalla: mantiene andando el envío de lo que el chofer reportó sin señal mientras la app está abierta. */
export function EnvioConsolaSinSenal() {
  useEnvioConsolaSinSenal()
  return null
}
