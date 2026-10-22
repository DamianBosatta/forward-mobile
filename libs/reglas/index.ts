/**
 * @forward/reglas: lógica de negocio PURA que comparten la web y mobile (C-022, D25).
 *
 * Sin React, sin fetch, sin zod y sin imports fuera de esta carpeta: mobile copia `src/` entera
 * con `sync:reglas` y verifica el hash con `check:reglas`. Lo que deriva del backend (tipos,
 * esquemas, códigos de error) NO vive acá: se genera en cada repo desde `openapi.json`.
 */
export { cuitEsValido } from './cuit'
export { tieneComoMuchoDosDecimales, redondearDosDecimales } from './dinero'
export { pisoCesionComision } from './comisiones'
export { MONEDAS_PERMITIDAS } from './monedas'
export type { MonedaPermitida } from './monedas'
export { esCantidadEnteraSiEsBulto } from './compras'
export { CASOS } from './casos'
export { ejecutarCasos } from './casos/ejecutar'
export type { Caso, FallaDeCaso } from './casos/ejecutar'
