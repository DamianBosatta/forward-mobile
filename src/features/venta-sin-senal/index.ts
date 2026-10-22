// Vender sin señal (V9, D4): módulo suelto, para conectar en la venta después de #112.
export {
  encolarVenta, leerCola, cambiarEstado, quitarDeCola, limpiarEnviadasViejas, suscribirCola, loQueVio,
  type VentaEnCola, type EstadoEnCola, type FaseEnvio, type LoQueVio, type DatosParaEncolar,
} from './lib/cola'
export { enviarPendientes, cambioElPrecio, type ResultadoRonda } from './lib/enviar'
export { useVentasSinSenal, esperaDeReintento, agrupar } from './hooks/useVentasSinSenal'
export { useHoraDelCatalogo, CLAVE_CATALOGO_VENTA } from './hooks/useHoraDelCatalogo'
export { VentasSinSenalLista, avisoSinSenal } from './components/VentasSinSenalLista'
