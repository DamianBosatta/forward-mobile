// Consola del chofer sin señal: la cola en el teléfono, su envío (montado en app/_layout) y la píldora del viaje.
export { encolarAccion, leerCola, quitarDeCola, type AccionEnCola, type DatosAccion, type CuerpoNoEntrega } from './colaConsola'
export { enviarPendientesConsola, type ResultadoRonda } from './enviarConsola'
export { useColaConsola, useEnvioConsolaSinSenal } from './useColaConsola'
export { ColaConsola } from './PildoraColaConsola'
export { EnvioConsolaSinSenal } from './EnvioConsolaSinSenal'
