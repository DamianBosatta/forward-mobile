import { useVentasSinSenal } from '../hooks/useVentasSinSenal'

/** Sin pantalla: mantiene andando el envío de las ventas guardadas en el teléfono mientras la app está abierta (V9). */
export function EnvioVentasSinSenal() {
  useVentasSinSenal()
  return null
}
