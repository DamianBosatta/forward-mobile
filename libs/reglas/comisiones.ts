import { redondearDosDecimales } from './dinero'

/**
 * Piso de cesión: la mitad del porcentaje configurado del vendedor (inclusive), YA redondeada a 2
 * decimales: el mismo valor que devuelve `Venta.PisoCesionComision` en el backend y el mismo que
 * se muestra en pantalla. Con un 5,05% configurado, la mitad cruda es 2,525: sin este redondeo
 * convivían tres números distintos para la misma regla.
 */
export function pisoCesionComision(porcentajeConfigurado: number): number {
  return redondearDosDecimales(porcentajeConfigurado / 2)
}
