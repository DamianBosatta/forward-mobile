/** Solo para tests: arma lo que responde GET /api/v1/catalogo a partir de productos con la forma de /Productos. */
interface ProductoBase {
  id: string
  nombre: string
  codigoPropio: string
  precioVenta: number
}

export function fichaDeCatalogo(p: ProductoBase, extra: object = {}) {
  return {
    productoId: p.id,
    nombre: p.nombre,
    codigoPropio: p.codigoPropio,
    marca: null,
    categoria: null,
    linea: '',
    familia: '',
    tipo: '',
    subtipo: '',
    imageUrl: null,
    precioVenta: p.precioVenta,
    disponible: true,
    precioConOferta: null,
    fragancias: [] as string[],
    ...extra,
  }
}

export function paginaDeCatalogo(items: object[], totalCount: number = items.length, hasNextPage = false) {
  return { items, page: 1, pageSize: 20, totalCount, totalPages: hasNextPage ? 2 : 1, hasNextPage }
}
