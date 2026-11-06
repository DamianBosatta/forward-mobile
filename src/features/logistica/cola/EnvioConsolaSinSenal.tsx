import { useEnvioPosiciones } from '../gps/useEnvioPosiciones'
import { useEnvioConsolaSinSenal } from './useColaConsola'

/**
 * Sin pantalla: mantiene andando el envío de lo que el chofer reportó sin señal y de las posiciones del viaje mientras
 * la app está abierta. Importarlo desde `app/_layout` también define la tarea del GPS al cargar la app.
 */
export function EnvioConsolaSinSenal() {
  useEnvioConsolaSinSenal()
  useEnvioPosiciones()
  return null
}
