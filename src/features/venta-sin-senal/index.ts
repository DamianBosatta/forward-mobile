// Vender sin señal (V9, D4): la cola en el teléfono, su envío (montado en app/_layout) y el encolado cuando el alta falla por la conexión.
export {
  encolarVenta, leerCola, cambiarEstado, quitarDeCola, limpiarEnviadasViejas, limpiarBorradoresResueltos, suscribirCola, loQueVio,
  type VentaEnCola, type EstadoEnCola, type FaseEnvio, type LoQueVio, type DatosParaEncolar, type AltaEnCola,
} from './lib/cola'
export { encolarSiFaltaSenal } from './lib/encolarSinSenal'
export { EnvioVentasSinSenal } from './components/EnvioVentasSinSenal'
export { enviarPendientes, cambioElPrecio, type ResultadoRonda } from './lib/enviar'
export { useVentasSinSenal, esperaDeReintento, agrupar } from './hooks/useVentasSinSenal'
export { useHoraDelCatalogo, CLAVE_CATALOGO_VENTA } from './hooks/useHoraDelCatalogo'
export { VentasSinSenalLista, avisoSinSenal } from './components/VentasSinSenalLista'
export { PendientesDeEnviar } from './components/PendientesDeEnviar'
