export { 
  productosKeys, 
  useCatalogoStock, 
  useProductos, 
  useProducto, 
  useCreateProducto, 
  useUpdateProducto, 
  useToggleProductoStatus,
  type ProductoParams,
  type CatalogoStockItem
} from '@/libs/api-client/productos'

export {
  stockKeys,
  useStock,
  useAjustarStock,
  type StockParams
} from '@/libs/api-client/stock'

export {
  depositosKeys,
  useDepositos,
  useCreateDeposito,
  useUpdateDeposito,
  useDeactivateDeposito
} from '@/libs/api-client/depositos'
