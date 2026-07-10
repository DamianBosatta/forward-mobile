// ─────────────────────────────────────────────────────────────────────────────
// @forward/api-client – Public API
// ─────────────────────────────────────────────────────────────────────────────

// Client base
export { api, configureApiClient, ApiError, API_URL, ENV_PROD, ENV_DEV, ENV_LOCAL, loadSavedApiUrl, setApiUrl } from './client'

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
  // Reportes
  ReporteDiario,
  KpiDashboard,
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
  useCreateVenta,
  useEntregarVenta,
  useConvertirPresupuesto,
  useAnularVenta,
  useUpdateVenta,
  useAutorizarVenta,
  useEmpacarVenta,
  getNotaEntregaUrl,
  getEtiquetasUrl
} from './ventas'

// Productos hooks
export { productosKeys, useProductos, useCatalogoStock, useProducto, useCreateProducto, useUpdateProducto, useToggleProductoStatus } from './productos'
export type { CatalogoStockItem, AlmacenStockItem } from './productos'

// Finanzas hooks
export {
  finanzasKeys,
  useCajaActiva,
  useMovimientosCaja,
  useAbrirCaja,
  useCerrarCaja,
  useKpiDashboard,
  useReporteDiario,
  usePagos,
  useMovimientosCuenta
} from './finanzas'

// Realtime
export { realtimeClient } from './realtime'
export type { RealtimeEvent } from './realtime'

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
export { useProveedores, useClientesActivos } from './socios'

// Administración (Usuarios y Auditoría)
export * from './admin'

// Cuentas Corrientes
export * from './cuentas-corrientes'

// Tesorería
export * from './tesoreria'

// Configuración del sistema
export { useConfiguracionSistema, configuracionKeys } from './configuracion'
export type { MargenMinimoResponse } from './configuracion'

// Logística hooks
export {
  logisticaKeys,
  pickingKeys,
  useVentasEmpacadas,
  useChoferes,
  useVehiculos,
  useHojasDeRuta,
  useInfiniteHojasDeRuta,
  useHojaRuta,
  useCrearHojaRuta,
  useIniciarHojaRuta,
  useFinalizarHojaRuta,
  useReportarParada,
  // Picking board (Batch 1)
  useVentasParaPreparacion,
  useIniciarPreparacion,
  usePickingEmpacarVenta,
  useRevertirAPreparacion,
  useRevertirAConfirmada,
  // Vehiculos CRUD
  useCreateVehiculo,
  useUpdateVehiculo,
  useDeactivateVehiculo,
  // URL builders (consumed by sharePdf)
  getManifiestoUrl,
  getEtiquetasMasivasUrl,
  getSurtidoPdfUrl,
} from './logistica'

export type {
  VentaPreparacion,
  VentasPreparacionParams,
  IniciarPreparacionMasivaResult,
  SkippedItem,
  VehiculoCrudPayload,
  VehiculoCrudResult,
} from './logistica'
