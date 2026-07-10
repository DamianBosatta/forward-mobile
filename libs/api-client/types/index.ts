// ─────────────────────────────────────────────────────────────────────────────
// Forward ERP – TypeScript DTOs
// Mapeo 1:1 con los response models del backend .NET 8
// ─────────────────────────────────────────────────────────────────────────────

// #region Common
// ── Common ───────────────────────────────────────────────────────────────────

export interface PagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  hasNextPage: boolean
}

export interface ApiResponse<T> {
  succeeded: boolean
  message: string
  errors?: string[]
  data: T
}

export type Money = {
  amount: number
  currency: string
}

// #endregion

// #region Auth
// ── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  username: string
  password: string
}

export interface TokenResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: string
}

export interface UserProfile {
  id: string
  username: string
  email: string
  roles: string[]
  vendedorId?: string
  depositoId?: string
  maxDescuentoPorcentaje?: number
  maxDescuentoMonto?: number
  puedeVenderSinStock: boolean
}

export type UserRole = 'AdministradorSistemas' | 'Administrador' | 'Gerencia' | 'Empleado'

// #endregion

// #region Productos
// ── Productos ────────────────────────────────────────────────────────────────
// Types derived from the generated OpenAPI schema — do not hand-edit these aliases.

/** Slim list projection — matches GET /api/v1/productos list shape. */
export type Producto = components['schemas']['ProductoDto']

/** Full detail projection — matches GET /api/v1/productos/{id} shape. */
export type ProductoDetailDto = components['schemas']['ProductoDetailDto']

/**
 * Create producto request — maps to CreateProductoCommand.
 * stockInicial and other fields not on the server DTO are kept here for form use.
 */
export type CreateProductoRequest = components['schemas']['CreateProductoCommand']

/** Update producto request. */
export type UpdateProductoRequest = components['schemas']['UpdateProductoCommand'] & { id: string }

// #endregion

// #region Depositos
// ── Depositos ────────────────────────────────────────────────────────────────
// Types derived from the generated OpenAPI schema — do not hand-edit these aliases.

/** Deposito response — matches GET /api/v1/depositos list shape. */
export type Deposito             = components['schemas']['DepositoResponse']
export type CreateDepositoRequest = components['schemas']['CreateDepositoCommand']
export type UpdateDepositoRequest = components['schemas']['UpdateDepositoCommand']

export interface DeactivateDepositoRequest {
  id: string
  targetDepositoId?: string
}

// #endregion

// #region Stock
// ── Stock ─────────────────────────────────────────────────────────────────────
// Types derived from the generated OpenAPI schema — do not hand-edit these aliases.

/** Stock list item — matches GET /api/v1/stocks list shape. */
export type StockItem = components['schemas']['StockListResponse']

/**
 * Ajuste stock request — tipoMovimiento is numeric (1=Compra,2=Venta,3=Transferencia,4=Ajuste)
 * even though the OpenAPI spec emits a string enum. Override here keeps call sites unchanged.
 */
export interface AjusteStockRequest {
  productoId: string
  depositoId: string
  cantidad: number
  tipoMovimiento: number
  observacion?: string
}

export interface MovimientoStock {
  id: string
  productoId: string
  producto: string
  depositoId: string
  deposito: string
  tipoMovimiento: TipoMovimientoStock
  cantidad: number
  fecha: string
  referenciaId?: string
}

export type TipoMovimientoStock = 'Compra' | 'Venta' | 'Transferencia' | 'Ajuste'

/**
 * Single movement entry returned by GET /api/v1/stocks/movimientos.
 * All fields mapped 1:1 to MovimientoStockDto on the backend.
 */
export interface MovimientoStockHistorialDto {
  id: string
  /** UTC ISO timestamp. */
  fecha: string
  /** Numeric enum: 1=Compra, 2=Venta, 3=Transferencia, 4=Ajuste. */
  tipoMovimiento: number
  /** Human-readable label resolved server-side. */
  tipoLabel: string
  /**
   * Signed delta: positive for inbound movements, negative for outbound.
   * The backend applies semantic sign correction (e.g. Venta rows that SPs
   * stored as absolute positive are negated before returning to the client).
   */
  cantidad: number
  /**
   * Semantic direction derived from the signed Cantidad.
   * "Entrada" = stock increased, "Salida" = stock decreased, "Neutro" = no net change.
   */
  direccion: 'Entrada' | 'Salida' | 'Neutro'
  observacion?: string
  /** Full name of the user who created the movement (or "Sistema"). */
  usuarioNombre: string
  referenciaId?: string
}

// #endregion

// #region Ventas
// ── Ventas ───────────────────────────────────────────────────────────────────
// Types derived from the generated OpenAPI schema — do not hand-edit these aliases.

/**
 * Venta list item — matches GET /api/v1/ventas list shape.
 * Includes razonSocialCliente and nombreDeposito from the SQL join.
 */
export type Venta = components['schemas']['VentaDtoList']

/**
 * Venta detail response — matches GET /api/v1/ventas/{id} shape.
 * Composed of VentaHeaderDto (header), VentaDetalleItemDto[] (line items), and BultoDto[] (packages).
 */
export type VentaDetalleDto = components['schemas']['VentaDetalleDto']

/** Venta header — nested inside VentaDetalleDto. */
export type VentaHeaderDto = components['schemas']['VentaHeaderDto']

/** Venta line item — nested inside VentaDetalleDto. */
export type VentaDetalleItemDto = components['schemas']['VentaDetalleItemDto']

/** Bulto — nested inside VentaDetalleDto. */
export type BultoDto = components['schemas']['BultoDto']

// Backward-compatible aliases for call sites that use the old hand-written names.
// New code should use VentaDetalleDto / VentaHeaderDto / VentaDetalleItemDto.
export type VentaDetalle = VentaDetalleItemDto
export type Bulto = BultoDto

// ── Authorization flow (PR-2e-b) ─────────────────────────────────────────────
// Types derived from the generated OpenAPI schema — do not hand-edit these aliases.

/**
 * Preview DTO returned by GET /api/v1/Ventas/{id}/autorizacion-preview.
 * Contains per-item sacrificio breakdown and totals.
 */
export type AutorizacionPreviewDto = components['schemas']['AutorizacionPreviewDto']

/**
 * Per-item row in the authorization preview.
 */
export type AutorizacionPreviewItemDto = components['schemas']['AutorizacionPreviewItemDto']

/**
 * Command body for POST /api/v1/Ventas/{id}/autorizar.
 * The server derives the authorizing role from the JWT token — isAdminUser is ignored.
 * razon is mandatory when any item is below the floor.
 */
export type AutorizarVentaCommand = components['schemas']['AutorizarVentaCommand']

export type EstadoVenta = 'Pendiente' | 'Confirmada' | 'Empacada' | 'EnRuta' | 'Entregada' | 'NoEntregada' | 'Anulada' | 'PendienteAutorizacion'

export type TipoOperacionVenta = 'Presupuesto' | 'Pedido'

export interface CreateVentaRequest {
  clienteId: string
  vendedorId?: string
  usuarioGeneradorId?: string
  usuarioModificadorId?: string
  depositoId: string
  tipoOperacion: number  // 1 = Presupuesto, 2 = Pedido
  descuentoGeneral: number
  cargoFlete?: number
  motivoVentaSinStock?: string
  fechaEntrega?: string
  metodoEntrega?: number
  /** When true, triggers the atomic deliver-on-create (counter-sale / mostrador). */
  entregaInmediata?: boolean
  items: {
    productoId: string
    cantidad: number
    /** Per-item discount percentage (0–100). Mutually exclusive with descuentoGeneral > 0. */
    descuentoPorcentaje?: number
  }[]
}

/**
 * VentaActionResponseDto — matches empacar / entregar / anular response shape.
 */
export type VentaActionResponseDto = components['schemas']['VentaActionResponseDto']

/**
 * EmpacarVentaResponseDto — extends VentaActionResponseDto with etiquetas.
 */
export type EmpacarVentaResponseDto = components['schemas']['EmpacarVentaResponseDto']

/**
 * Real payload of GET /api/v1/Ventas/{id}.
 * The backend Dapper handler composes { venta, detalles, bultos };
 * the ApiResponse<T> envelope is unwrapped by the HTTP client.
 */
export interface VentaDetailResponse {
  venta: VentaHeaderDto
  detalles: VentaDetalleItemDto[]
  bultos: BultoDto[]
}

// #endregion

// #region Socios Comerciales
// ── Socios Comerciales (Clientes / Proveedores) ───────────────────────────────
// Types derived from the generated OpenAPI schema — do not hand-edit these.

import type { components } from '../generated/schema'

/** Full detail projection (Email, Telefono, Direccion, CondicionIva populated). */
export type SocioDetailDto  = components['schemas']['SocioDetailDto']

/** Slim list projection (no contact fields — matches GET /socios-comerciales list). */
export type SocioListDto    = components['schemas']['SocioListDto']

/**
 * Backward-compatible alias: list call sites already typed as SocioComercial
 * continue to work without changes. For detail queries use SocioDetailDto.
 */
export type SocioComercial  = SocioListDto

export type ClienteLightDto = components['schemas']['ClienteLightDto']

/** CreateSocio request — omits server-assigned usuarioId. */
export type CreateSocioRequest = Omit<components['schemas']['CreateSocioCommand'], 'usuarioId'>

/** UpdateSocio request — omits server-assigned usuarioId; id is provided by caller. */
export type UpdateSocioRequest = Omit<components['schemas']['UpdateSocioCommand'], 'usuarioId'> & { id: string }

// #endregion

// #region Compras
// ── Compras ──────────────────────────────────────────────────────────────────
// Types derived from the generated OpenAPI schema — do not hand-edit these aliases.

/** Compra detail — matches GET /api/v1/compras/{id} shape. */
export type CompraDto = components['schemas']['CompraDto']

/** Compra list item — matches GET /api/v1/compras list shape. */
export type CompraDtoList = components['schemas']['CompraDtoList']

/** Compra detail line item — nested inside CompraDto. */
export type CompraDetalleResponseDto = components['schemas']['CompraDetalleResponseDto']

/** EstadoCompra string union — matches the generated backend enum. */
export type EstadoCompra = components['schemas']['EstadoCompra']

// Backward-compatible aliases: list/detail call sites that used the hand-written Compra shape
// can continue using these until they are updated to use the canonical field names
// (razonSocialProveedor, nombreDeposito, nombreProducto).
export type Compra = CompraDtoList
export type CompraDetalle = CompraDetalleResponseDto

export interface CreateCompraRequest {
  proveedorId: string
  depositoId: string
  gastosOperativos: number
  detalles: {
    productoId: string
    cantidad: number
    costoUnitario: number
    descuentoPorcentaje: number
    monedaCosto: string
  }[]
}

// #endregion

// #region Finanzas: Caja
// ── Finanzas: Caja ────────────────────────────────────────────────────────────
// Types derived from the generated OpenAPI schema — do not hand-edit these aliases.

/**
 * Caja activa response — matches GET /api/v1/cajas/activa shape.
 * Fields use Money value-object decomposition (amount + currency).
 */
export type CajaActivaDto = components['schemas']['CajaActivaDto']

/**
 * Movimiento de caja — matches GET /api/v1/cajas/{id}/movimientos item shape.
 * `tipo` is the movement type enum; `montoAmount`/`montoMoneda` are the Money VO.
 */
export type MovimientoCajaDto = components['schemas']['MovimientoCajaDto']

// Backward-compatible interface kept for caja.store.ts and legacy consumers.
// New code should use CajaActivaDto from the generated schema.
export interface Caja {
  id: string
  fecha: string
  usuarioAperturaId: string
  usuarioApertura: string
  saldoInicial: number
  estado: EstadoCaja
  fechaCierre?: string
  saldoFinalDeclarado?: number
  saldoFinalSistema?: number
  diferencia?: number
}

export type EstadoCaja = 'Abierta' | 'Cerrada'

// Backward-compatible interface kept for legacy consumers.
// New code should use MovimientoCajaDto from the generated schema.
export interface MovimientoCaja {
  id: string
  cajaId: string
  tipoMovimiento: TipoMovimientoCaja
  monto: number
  medioPago: MedioPago
  referenciaId?: string
  fecha: string
  descripcion?: string
}

export type TipoMovimientoCaja =
  | 'IngresoVenta'
  | 'Cobranza'
  | 'PagoProveedor'
  | 'Gasto'
  | 'Ajuste'

export type MedioPago = 'Efectivo' | 'Transferencia' | 'Tarjeta'

// #endregion

// #region Finanzas: Pagos & Conciliación
// ── Finanzas: Pagos & Conciliación ────────────────────────────────────────────

export interface Pago {
  id: string
  fecha: string
  monto: number
  tipo: TipoPago
  entidadId: string
  entidad: string
  medioPago: MedioPago
  conciliaciones?: Conciliacion[]
}

export type TipoPago = 'Cobranza' | 'PagoProveedor'

export interface Conciliacion {
  id: string
  pagoId: string
  movimientoCuentaId: string
  montoAplicado: number
}

// #endregion

// #region Cuentas Corrientes
// ── Cuentas Corrientes ────────────────────────────────────────────────────────

export interface MovimientoCuenta {
  id: string
  entidadId: string
  entidad: string
  tipo: TipoMovimientoCuenta
  debe: number
  haber: number
  saldoParcial: number
  fecha: string
  referenciaId?: string
}

export type TipoMovimientoCuenta = 'Venta' | 'Pago' | 'NotaCredito' | 'Compra'

// #endregion

// #region Cuentas Corrientes — generated aliases
// Types derived from the generated OpenAPI schema — do not hand-edit these aliases.

export type CuentaCorrienteResumenDto = components['schemas']['CuentaCorrienteResumenDto']
export type MovimientoCuentaDto       = components['schemas']['MovimientoCuentaDto']
export type GetMovimientosCuentaDto   = components['schemas']['GetMovimientosCuentaDto']
export type LiquidezConsolidadaDto    = components['schemas']['LiquidezConsolidadaDto']
export type EstadoCuentaDto           = components['schemas']['EstadoCuentaDto']
export type MovimientoPendienteDto    = components['schemas']['MovimientoPendienteDto']

// Payload for creating a new cuenta corriente.
export interface CreateCuentaCorrientePayload {
  nombre: string
  socioComercialId?: string | null
  esPrincipal?: boolean
}

// #endregion

// #region Reportes
// ── Reportes ─────────────────────────────────────────────────────────────────

export interface ReporteDiario {
  fecha: string
  totalVentas: number
  cantidadVentas: number
  totalCobranzas: number
  totalPagosProveedor: number
  totalGastos: number
  resultadoNeto: number
}

/**
 * Dashboard KPI summary — matches GET /api/v1/dashboard/summary shape.
 * Derived from the generated OpenAPI schema.
 */
export type KpiDashboard = components['schemas']['DashboardSummaryDto']

// #endregion

// #region Usuarios y Permisos
// ── Usuarios y Permisos ───────────────────────────────────────────────────────
// Types derived from the generated OpenAPI schema — do not hand-edit these aliases.

export type UserListDto    = components['schemas']['UserListDto']
export type UserDetailDto  = components['schemas']['UserDetailDto']
export type ModulePermissionDto = components['schemas']['ModulePermissionDto']

// Backward-compatible aliases for call sites using the old hand-written names.
export type UserListItem    = UserListDto
export type UserDetail      = UserDetailDto
export type ModulePermission = ModulePermissionDto

// AppRole and AppModule remain hand-written because they are not modelled
// as enums in the OpenAPI schema (roles/modules are string literals at runtime).
export type AppRole =
  | 'AdministradorSistemas'
  | 'Administrador'
  | 'Gerencia'
  | 'Empleado'

export type AppModule =
  | 'MOD_VENTAS'
  | 'MOD_COMPRAS'
  | 'MOD_STOCK'
  | 'MOD_PEDIDOS'
  | 'MOD_VIAJES'
  | 'MOD_CC'
  | 'MOD_PAGOS'
  | 'MOD_PRODUCTOS'
  | 'MOD_CLIENTES'
  | 'MOD_PROVEEDORES'
  | 'MOD_REPORTES'
  | 'MOD_USUARIOS'
  | 'MOD_CONFIGURACION'

export interface CreateUserRequest {
  nombre:      string
  apellido:    string
  email:       string
  password:    string
  role:        AppRole
  permissions: ModulePermissionDto[]
}

export interface UpdateUserRequest {
  nombre:      string
  apellido:    string
  email:       string
  role:        AppRole
  password?:   string
}

export interface UpdatePermissionsRequest {
  permissions: ModulePermissionDto[]
}

// #endregion

// #region Finanzas: Tesorería
// ── Finanzas: Tesorería (Pagos y Transferencias) ─────────────────────────────
// Types derived from the generated OpenAPI schema — do not hand-edit these aliases.

/** Tesorería list item — matches GET /api/v1/tesoreria list shape. */
export type TesoreriaListDto = components['schemas']['TesoreriaListDto']

/** Tesorería movement type — matches GET /api/v1/tesoreria/tipos shape. */
export type TesoreriaTipoDto = components['schemas']['TesoreriaTipoDto']

export interface RegistrarTransaccionRequest {
  monto: number
  moneda: string
  tipoMovimientoId: string
  cuentaOrigenId: string
  cuentaDestinoId?: string
  socioComercialId?: string
  observaciones: string
}

export interface AnularTransaccionRequest {
  transaccionId: string
  motivo: string
}

// #endregion

// ── Logística ─────────────────────────────────────────────────────────────────
// Types derived from the generated OpenAPI schema — do not hand-edit these aliases.

/**
 * Venta empacada — matches GET /api/v1/logistica/ventas-empacadas item shape.
 */
export type VentaEmpacada = components['schemas']['VentaEmpacadaDto']

/**
 * Chofer — matches GET /api/v1/logistica/choferes item shape.
 */
export type Chofer = components['schemas']['ChoferDto']

/**
 * Vehiculo — matches GET /api/v1/logistica/vehiculos item shape.
 */
export type Vehiculo = components['schemas']['VehiculoDto']

/**
 * HojaRuta list item — matches GET /api/v1/logistica/hojas-ruta list item shape.
 * estado is a numeric int (1=Programada, 2=EnCurso, 3=Finalizada, 4=Cancelada).
 */
export type HojaRutaListItemDto = components['schemas']['HojaRutaListItemDto']

/**
 * HojaRuta detail — matches GET /api/v1/logistica/hojas-ruta/{id} shape.
 * detalles contains ParadaDto[] (stops).
 */
export type HojaRutaDetalleDto = components['schemas']['HojaRutaDetalleDto']

/**
 * Parada (stop) — nested inside HojaRutaDetalleDto.
 */
export type ParadaDto = components['schemas']['ParadaDto']

// Must match backend Domain/Enum/EstadoParada.cs (1-based). The API returns these
// numeric values on ParadaDto.estado; a 0-based enum mislabels Pendiente as Entregado.
export enum EstadoParada {
  Pendiente    = 1,
  Entregado    = 2,
  NoEntregado  = 3,
}

// Backward-compatible enum kept for call sites that compare estado as string.
export enum EstadoHojaRuta {
  Programada = 1,
  EnCurso = 2,
  Finalizada = 3,
  Cancelada = 4
}

// Backward-compatible alias for screens using HojaDeRuta.
// Maps to detail shape (contains detalles: ParadaDto[]).
// Note: backend field is `detalles` not `paradas`; `fechaSalida` not `fecha`.
export type HojaDeRuta = HojaRutaDetalleDto

// Backward-compatible alias for screens using ParadaHojaRuta.
export type ParadaHojaRuta = ParadaDto