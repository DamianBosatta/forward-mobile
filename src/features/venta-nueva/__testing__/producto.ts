import type { CatalogoStockItem } from '@/libs/api-client'

/** Fila del catálogo de venta como la manda el servidor (vendedor sin permisos). */
export function producto(over: Partial<CatalogoStockItem> = {}): CatalogoStockItem {
  return {
    id: 'p1',
    nombre: 'Pala c/Cabo Fija LP',
    codigoPropio: 'PRO11923',
    precioVenta: 2496,
    precioConOferta: null,
    precioCompraBase: null,
    precioMinimoRentable: 2000,
    costoDirecto: null,
    deposito: 0,
    reservado: 0,
    real: 0,
    virtual: 0,
    stockMinimo: 0,
    puedeVenderse: true,
    esPadreDeVariantes: false,
    unidadMedida: 'Unidad',
    bultoContenido: 1,
    fraccionMinimaVenta: 'Unidad',
    ventaMinimaUnidades: 1,
    almacenes: [],
    ...over,
  }
}

export const cajaDe6 = (over: Partial<CatalogoStockItem> = {}) =>
  producto({ id: 'p6', nombre: 'Bettanin Pala Rebatible', ventaMinimaUnidades: 6, fraccionMinimaVenta: 'Bulto', precioVenta: 7120.85, ...over })
