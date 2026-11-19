// ─────────────────────────────────────────────────────────────────────────────
// @forward/api-client – Public API
// ─────────────────────────────────────────────────────────────────────────────

// Client base
export { api, configureApiClient, ApiError, API_URL, ENV_PROD, ENV_LOCAL, loadSavedApiUrl, setApiUrl } from './client'

// Types / DTOs
export type {
  // Common
  PagedResult,
  ApiResponse,
  Money,
  // Auth
  LoginRequest,
  TokenResponse,
  UserProfile,
  UserRole,
  // Productos
  Producto,
  ProductoDetailDto,
  CreateProductoRequest,
  // Depositos
  Deposito,
  // Stock
  StockItem,
  MovimientoStock,
  MovimientoStockHistorialDto,
  TipoMovimientoStock,
  // Ventas
  Venta,
  VentaDetalle,
  EstadoVenta,
  CreateVentaRequest,
  // Ventas — authorization flow (PR-2e-b)
  AutorizacionPreviewDto,
  AutorizacionPreviewItemDto,
  AutorizarVentaCommand,
  // Compras
  Compra,
  CompraDetalle,
  CompraDto,
  CompraDtoList,
  EstadoCompra,
  // Socios
  SocioComercial,
  // Finanzas
  Caja,
  EstadoCaja,
  MovimientoCaja,
  TipoMovimientoCaja,
  MedioPago,
  Pago,
  TipoPago,
  Conciliacion,
  MovimientoCuenta,
  TipoMovimientoCuenta,
  // Logística
  HojaDeRuta,
  ParadaHojaRuta,
  EstadoHojaRuta,
  EstadoParada,
  // Tesoreria
  TesoreriaListDto,
  TesoreriaTipoDto,
  AnularTransaccionRequest,
} from './types'

// Ventas hooks
export {
  ventasKeys,
  useVentas,
  useVenta,
  useAutorizacionPreview,
  useConvertirPresupuesto,
  useAnularVenta,
  useAutorizarVenta,
  getNotaEntregaUrl,
  getVentaPdfUrl,
} from './ventas'

// Productos hooks
export { productosKeys, useInfiniteCatalogoStock, useProducto, useVariantesProducto, getCatalogoPdfUrl } from './productos'
export { catalogoKeys, useInfiniteCatalogo } from './catalogo'
export type { CatalogoComercialItem, CatalogoParams } from './catalogo'
export type { CatalogoPdfFiltros, CatalogoStockItem, AlmacenStockItem, VarianteProducto } from './productos'

// Finanzas hooks
export {
  finanzasKeys,
  useCajaActiva,
  useAbrirCaja,
} from './finanzas'


// Stock
export * from './stock'

// Depositos
export * from './depositos'

// Media
export * from './media'

// Compras & Logística
export * from './compras'
export type { CreateCompraRequest } from './types'

// Socios Comerciales (Clientes / Proveedores)
export * from './socios'

// Administración (Usuarios y Auditoría)
export * from './admin'

// Cuentas Corrientes
export * from './cuentas-corrientes'

// Tesorería
export * from './tesoreria'

// Configuración del sistema
export { configuracionKeys } from './configuracion'
export type { MargenMinimoResponse } from './configuracion'

// Logística hooks
export {
  logisticaKeys,
  pickingKeys,
  useHojasDeRuta,
  useHojaRuta,
  useIniciarHojaRuta,
  useFinalizarHojaRuta,
  useReportarParada,
  useEntregarParada,
  useMediosCobroChofer,
  useLineasParada,
  // Picking board (Batch 1)
  useVentasParaPreparacion,
  // Vehiculos CRUD
  // URL builders (consumed by sharePdf)
  getManifiestoUrl,
} from './logistica'

export type {
  VentaPreparacion,
  VentasPreparacionParams,
  IniciarPreparacionMasivaResult,
  SkippedItem,
  VehiculoCrudPayload,
  VehiculoCrudResult,
  CuerpoEntregaParada,
  EntregaParadaResultado,
  MedioCobroChofer,
  LineaParada,
} from './logistica'
