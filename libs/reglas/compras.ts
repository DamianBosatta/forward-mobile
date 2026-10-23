/** compra/detalle-cantidad-entera-por-bulto: en bulto o bulto madre no se compra una fracción. */
export const esCantidadEnteraSiEsBulto = (unidadCompra: unknown, cantidad: number): boolean =>
  !(unidadCompra === 'Bulto' || unidadCompra === 'BultoMadre') || Number.isInteger(cantidad)
