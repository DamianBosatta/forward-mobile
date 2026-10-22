// Generado, no editar: `pnpm generate:schemas` lo escribe desde Forward-Api/openapi.json.
// Reglas simples de los validadores del backend (L-23). Todo es opcional porque el contrato
// no publica `required`; las reglas entre campos (Must) viven en ../reglas.
import { z } from 'zod'

export const AbrirCajaCommandSchema = z.object({
  depositoId: z.string().optional(),
  moneda: z.string().min(1).max(3).nullable().optional(),
  saldoInicialDeclarado: z.number().min(0).optional(),
  usuarioId: z.string().optional(),
})

export const AcreditarTarjetaCommandSchema = z.object({
  acreditacionTarjetaId: z.string().optional(),
  cuentaDestinoId: z.string().optional(),
})

export const ActualizarAvisosTalonarioCommandSchema = z.object({
  diasAvisoCai: z.number().int().optional(),
  porcentajeAvisoRangoCai: z.number().int().optional(),
})

export const AmbienteArcaSchema = z.enum(['Homologacion', 'Produccion'])

export const ActualizarConfiguracionArcaCommandSchema = z.object({
  ambiente: AmbienteArcaSchema.optional(),
  certificadoRuta: z.string().nullable().optional(),
  cuit: z.string().nullable().optional(),
  habilitada: z.boolean().optional(),
  puntoVentaId: z.string().nullable().optional(),
})

export const ActualizarMisPreferenciasCommandSchema = z.object({
  foto: z.string().nullable().optional(),
  temaPreferido: z.string().nullable().optional(),
})

export const TipoOfertaSchema = z.enum(['Porcentaje', 'PrecioFijo'])

export const ActualizarOfertaCommandSchema = z.object({
  desde: z.string().optional(),
  hasta: z.string().nullable().optional(),
  id: z.string().optional(),
  nota: z.string().nullable().optional(),
  tipo: TipoOfertaSchema.optional(),
  valor: z.number().optional(),
})

export const TipoNotificacionSchema = z.enum([
  'CajaSinCerrar',
  'PedidoEditadoPorDeposito',
  'SocioProvisorioPorVencer',
  'SocioDesactivadoAutomaticamente',
  'SolicitudCambioSocio',
  'SolicitudCambioResuelta',
  'ImportacionCompletada',
  'VentaNoEntregada',
  'PresupuestoPorVencer',
  'ChequePorVencer',
  'VentaRechazadaAutorizacion',
  'VentaPendienteAutorizacion',
  'VentaAutorizada',
  'PagoProveedorPorVencer',
  'PagoProveedorVencido',
  'VentaRegularizadaPorCobro',
  'VencimientoCalendario',
  'RecordatorioPersonal',
  'ResumenSemanal',
  'ResumenMensual',
  'EntregasPasadasAlProximoDia',
  'FiscalSuperaStockReal',
  'TalonarioRemitoPorVencer',
  'TalonarioRemitoPorAgotarse',
  'RemitosSinFacturaAntesDelCierre',
  'RemitosEntregadosSinFactura',
  'RemitosSinFacturaAlCierre',
])

export const PreferenciaToastDtoSchema = z.object({
  tipo: TipoNotificacionSchema.optional(),
  toast: z.boolean().optional(),
})

export const ActualizarPreferenciasNotificacionCommandSchema = z.object({
  preferencias: z.array(PreferenciaToastDtoSchema).nullable().optional(),
})

export const TipoMovimientoStockSchema = z.enum(['Compra', 'Venta', 'Transferencia', 'Ajuste'])

export const AdjustStockCommandSchema = z.object({
  cantidad: z.number().optional(),
  depositoId: z.string().optional(),
  observacion: z.string().min(3).nullable().optional(),
  productoId: z.string().optional(),
  tipoMovimiento: TipoMovimientoStockSchema.optional(),
})

export const AgregarParadaRequestSchema = z.object({ ventaId: z.string().optional() })

export const AjustarStockFiscalCommandSchema = z.object({
  cantidad: z.number().optional(),
  costoUnitario: z.number().nullable().optional(),
  motivo: z.string().max(500).nullable().optional(),
})

export const AnalizarImportacionCommandSchema = z.object({
  importacionJobId: z.string().optional(),
  mapeo: z.record(z.string(), z.string()).nullable().optional(),
})

export const AnularDevolucionProveedorCommandSchema = z.object({
  compraId: z.string().optional(),
  devolucionId: z.string().optional(),
  motivo: z.string().min(1).max(280).nullable().optional(),
  version: z.number().int().nullable().optional(),
})

export const AnularFacturaCommandSchema = z.object({
  id: z.string().optional(),
  motivo: z.string().min(1).max(500).nullable().optional(),
})

export const AnularMovimientoInternoCommandSchema = z.object({
  motivo: z.string().min(1).max(500).nullable().optional(),
  movimientoInternoId: z.string().optional(),
})

export const AnularPagoCommandSchema = z.object({
  motivoAnulacion: z.string().min(1).max(500).nullable().optional(),
  pagoId: z.string().optional(),
  usuarioId: z.string().optional(),
})

export const AnularRecepcionCompraCommandSchema = z.object({
  compraId: z.string().optional(),
  motivo: z.string().min(1).max(280).nullable().optional(),
  version: z.number().int().nullable().optional(),
})

export const AnularRemitoCommandSchema = z.object({
  id: z.string().optional(),
  motivo: z.string().min(1).max(500).nullable().optional(),
})

export const AnularTransaccionCommandSchema = z.object({
  motivo: z.string().min(1).max(500).nullable().optional(),
  transaccionId: z.string().optional(),
  usuarioId: z.string().optional(),
})

export const AnularVentaCommandSchema = z.object({
  motivoAnulacion: z.string().min(1).nullable().optional(),
  usuarioModificadorId: z.string().optional(),
  ventaId: z.string().optional(),
  version: z.number().int().optional(),
})

export const AccionMasivaProductoSchema = z.enum([
  'Activar',
  'Desactivar',
  'AjustarMarkup',
  'AumentarCosto',
])

export const AplicarAccionMasivaProductosCommandSchema = z.object({
  accion: AccionMasivaProductoSchema.optional(),
  aumentoCostoPorcentaje: z.number().nullable().optional(),
  markupPorcentaje: z.number().nullable().optional(),
  productoIds: z.array(z.string()).optional(),
})

export const AsignarComprobantePagoCommandSchema = z.object({
  comprobanteUrl: z.string().nullable().optional(),
  pagoId: z.string().optional(),
})

export const AsignarDepositosProductoCommandSchema = z.object({
  depositoIds: z.array(z.string()).min(1).nullable().optional(),
  productoId: z.string().optional(),
})

export const AsignarDepositosSocioCommandSchema = z.object({
  depositoIds: z.array(z.string()).min(1).nullable().optional(),
  socioId: z.string().optional(),
})

export const AsignarImagenChequeCommandSchema = z.object({
  chequeId: z.string().optional(),
  imagenUrl: z.string().nullable().optional(),
})

export const AsignarVendedorResponsableCommandSchema = z.object({
  socioId: z.string().optional(),
  vendedorResponsableId: z.string().optional(),
})

export const AsignarVendedorResponsableMasivoCommandSchema = z.object({
  socioIds: z.array(z.string()).min(1).nullable().optional(),
  vendedorResponsableId: z.string().optional(),
})

export const AssignRoleRequestDtoSchema = z.object({ roleName: z.string().nullable().optional() })

export const AutorizarCotPesoIncompletoRequestSchema = z.object({
  motivo: z.string().nullable().optional(),
})

export const AutorizarCotPesoIncompletoTransferenciaCommandSchema = z.object({
  motivo: z.string().nullable().optional(),
  version: z.number().int().nullable().optional(),
})

export const AutorizarVentaCommandSchema = z.object({
  descuentoAdicionalPorcentaje: z.number().nullable().optional(),
  isAdminUser: z.boolean().optional(),
  razon: z.string().max(500).nullable().optional(),
  usuarioId: z.string().optional(),
  ventaId: z.string().optional(),
  version: z.number().int().optional(),
})

export const CambiarEstadoOfertaCommandSchema = z.object({
  habilitada: z.boolean().optional(),
  id: z.string().optional(),
})

export const CambiarEstadoVarianteRequestSchema = z.object({ activo: z.boolean().optional() })

export const CancelCompraCommandSchema = z.object({
  compraId: z.string().optional(),
  motivoAnulacion: z.string().min(1).nullable().optional(),
})

export const CancelarFacturaCommandSchema = z.object({
  id: z.string().optional(),
  motivo: z.string().min(1).max(500).nullable().optional(),
})

export const CancelarTransferenciaStockCommandSchema = z.object({
  motivo: z.string().max(280).nullable().optional(),
  version: z.number().int().nullable().optional(),
})

export const CargarCodigoCotRequestSchema = z.object({ codigo: z.string().nullable().optional() })

export const CargarCodigoCotTransferenciaCommandSchema = z.object({
  codigo: z.string().nullable().optional(),
  version: z.number().int().nullable().optional(),
})

export const AlicuotaIvaSchema = z.enum([
  'Cero',
  'DiezComaCinco',
  'Veintiuno',
  'Veintisiete',
  'Cinco',
  'DosComaCinco',
])

export const AlicuotaComprobanteInputSchema = z.object({
  alicuota: AlicuotaIvaSchema.optional(),
  iva: z.number().min(0).optional(),
  netoGravado: z.number().min(0).optional(),
})

export const LetraComprobanteSchema = z.enum(['A', 'B', 'C'])

export const TipoComprobanteRecibidoSchema = z.enum([
  'Factura',
  'NotaCredito',
  'NotaDebito',
  'Recibo',
  'Ticket',
  'Otro',
])

export const TipoTributoRecibidoSchema = z.enum([
  'PercepcionIva',
  'PercepcionIibb',
  'PercepcionNacional',
  'PercepcionMunicipal',
  'ImpuestoInterno',
  'Otro',
])

export const TributoComprobanteInputSchema = z.object({
  importe: z.number().min(0).optional(),
  jurisdiccion: z.string().max(10).nullable().optional(),
  tipo: TipoTributoRecibidoSchema.optional(),
})

export const ComprobanteCompraInputSchema = z.object({
  alicuotas: z.array(AlicuotaComprobanteInputSchema).nullable().optional(),
  cuitEmisor: z.string().nullable().optional(),
  exento: z.number().min(0).optional(),
  fecha: z.string().optional(),
  letra: LetraComprobanteSchema.optional(),
  noGravado: z.number().min(0).optional(),
  numero: z.number().int().min(1).max(99999999).optional(),
  puntoVenta: z.number().int().min(1).max(99999).optional(),
  razonSocialEmisor: z.string().min(1).max(200).nullable().optional(),
  tipo: TipoComprobanteRecibidoSchema.optional(),
  total: z.number().min(0).optional(),
  tributos: z.array(TributoComprobanteInputSchema).nullable().optional(),
})

export const CargarNotaCreditoDevolucionCommandSchema = z.object({
  compraId: z.string().optional(),
  devolucionId: z.string().optional(),
  notaCredito: ComprobanteCompraInputSchema.optional(),
  version: z.number().int().nullable().optional(),
})

export const CatalogoExcelRequestSchema = z.object({
  categoriaId: z.string().nullable().optional(),
  columnas: z.array(z.string()).nullable().optional(),
  marca: z.string().nullable().optional(),
  searchTerm: z.string().nullable().optional(),
  stockIds: z.array(z.string()).nullable().optional(),
})

export const CerrarCajaCommandSchema = z.object({
  cajaId: z.string().optional(),
  moneda: z.string().min(1).max(3).nullable().optional(),
  saldoFinalDeclarado: z.number().min(0).optional(),
  usuarioId: z.string().optional(),
})

export const CerrarVigenciaReglaComisionCommandSchema = z.object({
  hasta: z.string().optional(),
  id: z.string().optional(),
})

export const ChangePasswordCommandSchema = z.object({
  confirmNewPassword: z.string().nullable().optional(),
  currentPassword: z.string().min(1).nullable().optional(),
  email: z.string().min(1).nullable().optional(),
  newPassword: z.string().nullable().optional(),
})

export const ConciliacionDtoSchema = z.object({
  montoAplicar: z.number().optional(),
  movimientoCuentaId: z.string().optional(),
})

export const ConciliarPagoCommandSchema = z.object({
  aplicaciones: z.array(ConciliacionDtoSchema).min(1).nullable().optional(),
  pagoId: z.string().optional(),
  usuarioGeneradorId: z.string().optional(),
})

export const ConfirmarCompraCommandSchema = z.object({
  compraId: z.string().optional(),
  usuarioId: z.string().optional(),
})

export const PoliticaDuplicadosSchema = z.enum(['Omitir', 'Actualizar', 'CrearIgual'])

export const ConfirmarImportacionCommandSchema = z.object({
  importacionJobId: z.string().optional(),
  politicaDuplicados: PoliticaDuplicadosSchema.optional(),
})

export const ConfirmarRetiroCommandSchema = z.object({
  dni: z.string().max(20).nullable().optional(),
  fotoUrl: z.string().max(500).nullable().optional(),
  nombreRetira: z.string().min(1).max(160).nullable().optional(),
  observacion: z.string().max(500).nullable().optional(),
  ventaId: z.string().optional(),
  version: z.number().int().optional(),
})

export const ConfirmarYRecibirCompraCommandSchema = z.object({
  comprobante: ComprobanteCompraInputSchema.optional(),
  fechaFacturaProveedor: z.string().nullable().optional(),
  version: z.number().int().nullable().optional(),
})

export const ConvertirPresupuestoCommandSchema = z.object({
  motivoVentaSinStock: z.string().nullable().optional(),
  usuarioGeneradorId: z.string().optional(),
  ventaId: z.string().optional(),
  version: z.number().int().optional(),
})

export const CorregirCesionComisionCommandSchema = z.object({
  nuevoPorcentaje: z.number().gt(0).lt(100).nullable().optional(),
  ventaId: z.string().optional(),
  version: z.number().int().optional(),
})

export const FrecuenciaRecurrenciaSchema = z.enum([
  'Mensual',
  'Anual',
  'CadaNDias',
  'CadaNMeses',
  'Semanal',
])

export const RecurrenciaDtoSchema = z.object({
  diaDelMes: z.number().int().nullable().optional(),
  diasSemana: z.array(z.number().int()).nullable().optional(),
  fechaFin: z.string().nullable().optional(),
  frecuencia: FrecuenciaRecurrenciaSchema.optional(),
  intervalo: z.number().int().optional(),
})

export const TipoEventoCalendarioSchema = z.enum([
  'VencimientoCompra',
  'ChequeEmitido',
  'ChequeRecibido',
  'ServicioRecurrente',
  'ObligacionPeriodica',
  'Manual',
])

export const VisibilidadEventoSchema = z.enum(['Personal', 'Administracion'])

export const CrearEventoCommandSchema = z.object({
  avisarDiasAntes: z.number().int().min(0).max(30).optional(),
  descripcion: z.string().max(500).nullable().optional(),
  fechaInicio: z.string().optional(),
  hora: z.string().nullable().optional(),
  montoEstimado: z.number().nullable().optional(),
  recurrencia: RecurrenciaDtoSchema.optional(),
  socioComercialId: z.string().nullable().optional(),
  subtipo: z.string().max(60).nullable().optional(),
  tipo: TipoEventoCalendarioSchema.optional(),
  titulo: z.string().min(1).max(150).optional(),
  ventaId: z.string().nullable().optional(),
  visibilidad: VisibilidadEventoSchema.optional(),
})

export const LineaConceptoDtoSchema = z.object({
  alicuota: AlicuotaIvaSchema.optional(),
  cantidad: z.number().optional(),
  descripcion: z.string().nullable().optional(),
  precioUnitario: z.number().optional(),
})

export const CrearFacturaPorConceptoCommandSchema = z.object({
  clienteId: z.string().optional(),
  lineas: z.array(LineaConceptoDtoSchema).min(1).nullable().optional(),
  puntoVentaId: z.string().optional(),
})

export const CrearFeriadoCommandSchema = z.object({
  descripcion: z.string().nullable().optional(),
  fecha: z.string().optional(),
})

export const ParadaRequestSchema = z.object({
  direccionDestino: z.string().nullable().optional(),
  latitud: z.number().optional(),
  longitud: z.number().optional(),
  ventaId: z.string().optional(),
})

export const CrearHojaRutaCommandSchema = z.object({
  choferId: z.string().optional(),
  depositoId: z.string().nullable().optional(),
  fechaSalida: z.string().optional(),
  paradas: z.array(ParadaRequestSchema).min(1).nullable().optional(),
  usuarioGeneradorId: z.string().optional(),
  vehiculoId: z.string().optional(),
})

export const CrearNotaCreditoDescuentoCommandSchema = z.object({
  facturaId: z.string().optional(),
  importe: z.number().gt(0).optional(),
  motivo: z.string().min(1).max(186).nullable().optional(),
})

export const CrearOfertaCommandSchema = z.object({
  desde: z.string().optional(),
  hasta: z.string().nullable().optional(),
  nota: z.string().nullable().optional(),
  productoId: z.string().optional(),
  tipo: TipoOfertaSchema.optional(),
  valor: z.number().optional(),
})

export const LineaTransferenciaInputSchema = z.object({
  cantidad: z.number().optional(),
  productoId: z.string().optional(),
})

export const CrearPedidoTransferenciaCommandSchema = z.object({
  depositoOrigenId: z.string().optional(),
  items: z.array(LineaTransferenciaInputSchema).min(1).nullable().optional(),
  observacion: z.string().max(280).nullable().optional(),
})

export const UsoPuntoVentaSchema = z.enum([
  'RemitosCai',
  'FacturasManuales',
  'FacturasElectronicas',
  'FacturasAPedido',
])

export const CrearPuntoVentaCommandSchema = z.object({
  nombre: z.string().nullable().optional(),
  numero: z.number().int().optional(),
  uso: UsoPuntoVentaSchema.optional(),
})

export const AlcanceReglaComisionSchema = z.enum([
  'Articulo',
  'Subcategoria',
  'Categoria',
  'Familia',
  'Linea',
])

export const CrearReglaComisionCommandSchema = z.object({
  alcance: AlcanceReglaComisionSchema.optional(),
  motivo: z.string().max(200).nullable().optional(),
  porcentaje: z.number().optional(),
  targetId: z.string().optional(),
  vendedorId: z.string().nullable().optional(),
  vigenciaDesde: z.string().optional(),
  vigenciaHasta: z.string().nullable().optional(),
})

export const DatosImprentaRequestSchema = z.object({
  cuit: z.string().nullable().optional(),
  fecha: z.string().optional(),
  habilitacion: z.string().nullable().optional(),
  razonSocial: z.string().nullable().optional(),
})

export const OrigenTalonarioRemitoSchema = z.enum(['Autoimpresor', 'Imprenta'])

export const CrearTalonarioRemitoCommandSchema = z.object({
  cai: z.string().nullable().optional(),
  esContingencia: z.boolean().optional(),
  fechaVencimientoCai: z.string().optional(),
  imprenta: DatosImprentaRequestSchema.optional(),
  numeroDesde: z.number().int().optional(),
  numeroHasta: z.number().int().optional(),
  origen: OrigenTalonarioRemitoSchema.optional(),
  puntoVentaId: z.string().optional(),
})

export const CrearTransferenciaStockCommandSchema = z.object({
  depositoDestinoId: z.string().optional(),
  depositoOrigenId: z.string().optional(),
  items: z.array(LineaTransferenciaInputSchema).min(1).nullable().optional(),
  observacion: z.string().max(280).nullable().optional(),
})

export const CrearUmbralCotCommandSchema = z.object({
  importeNeto: z.number().optional(),
  pesoKg: z.number().optional(),
  vigenteDesde: z.string().nullable().optional(),
})

export const CreateCategoriaCommandSchema = z.object({
  categoriaPadreId: z.string().nullable().optional(),
  codigo: z.string().nullable().optional(),
  nivel: z.number().int().min(1).max(4).optional(),
  nombre: z.string().min(1).max(150).nullable().optional(),
})

export const CreateCompraBorradorCommandSchema = z.object({
  depositoId: z.string().optional(),
  proveedorId: z.string().optional(),
})

export const UnidadCompraSchema = z.enum(['Unidad', 'Bulto', 'BultoMadre'])

export const CompraDetalleDtoSchema = z.object({
  cantidad: z.number().min(0).optional(),
  costoUnitario: z.number().min(0).optional(),
  monedaCosto: z.string().nullable().optional(),
  productoId: z.string().optional(),
  unidadCompra: UnidadCompraSchema.optional(),
})

export const CreateCompraCommandSchema = z.object({
  depositoId: z.string().optional(),
  descuentoPorcentaje: z.number().min(0).max(100).optional(),
  detalles: z.array(CompraDetalleDtoSchema).min(1).nullable().optional(),
  gastosOperativos: z.number().min(0).optional(),
  proveedorId: z.string().optional(),
  usuarioGeneradorId: z.string().optional(),
})

export const CreateCuentaBancariaSocioCommandSchema = z.object({
  alias: z.string().min(1).max(120).nullable().optional(),
  banco: z.string().max(120).nullable().optional(),
  cbu: z.string().max(30).nullable().optional(),
  socioComercialId: z.string().optional(),
  titular: z.string().max(150).nullable().optional(),
})

export const CreateCuentaCorrienteCommandSchema = z.object({
  esPrincipal: z.boolean().optional(),
  nombre: z.string().nullable().optional(),
  socioComercialId: z.string().nullable().optional(),
  vendedorId: z.string().nullable().optional(),
})

export const CreateDepositoCommandSchema = z.object({
  direccion: z.string().max(250).nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  nombre: z.string().min(1).max(100).nullable().optional(),
})

export const CreateFraganciaCommandSchema = z.object({
  nombre: z.string().min(1).max(150).nullable().optional(),
  productoPadreId: z.string().nullable().optional(),
})

export const CreateMedioPagoCommandSchema = z.object({
  comisionPorcentaje: z.number().min(0).max(100).optional(),
  diasAcreditacion: z.number().int().min(0).optional(),
  nombre: z.string().min(1).max(150).nullable().optional(),
  requiereCaja: z.boolean().optional(),
})

export const CreateProductoCommandSchema = z.object({
  activo: z.boolean().optional(),
  alicuotaIva: z.number().int().nullable().optional(),
  bultoContenido: z.number().optional(),
  bultoMadreContenido: z.number().nullable().optional(),
  categoriaId: z.string().nullable().optional(),
  codigoBarra: z.string().max(64).nullable().optional(),
  codigoPropio: z.string().nullable().optional(),
  codigoProveedor: z.string().max(100).nullable().optional(),
  cotUmbralPropioKg: z.number().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  esCargaMasiva: z.boolean().optional(),
  fraccionMinimaVenta: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  marca: z.string().max(100).nullable().optional(),
  markupPorcentaje: z.number().min(0).max(100000).nullable().optional(),
  nombre: z.string().min(1).max(150).nullable().optional(),
  pesoKg: z.number().nullable().optional(),
  precioCompraBase: z.number().min(0).optional(),
  stockInicial: z.number().min(0).optional(),
  stockMinimo: z.number().min(0).max(2147483647).optional(),
  ubicacionDeposito: z.string().nullable().optional(),
  unidadMedida: z.string().nullable().optional(),
  ventaMinimaUnidades: z.number().optional(),
})

export const TipoCondicionPagoSchema = z.enum([
  'Contado',
  'DiasDesdeEntrega',
  'DiasDesdeFactura',
  'DiaFijoDelMes',
])

export const CondicionPagoDtoSchema = z.object({
  descripcion: z.string().nullable().optional(),
  diaDelMes: z.number().int().nullable().optional(),
  dias: z.number().int().nullable().optional(),
  tipo: TipoCondicionPagoSchema.optional(),
})

export const FranjaHorariaDtoSchema = z.object({
  desde: z.string().min(1).optional(),
  dia: z.number().int().optional(),
  esValida: z.boolean().optional(),
  hasta: z.string().min(1).optional(),
})

export const TopeCreditoDtoSchema = z.object({ monto: z.number().nullable().optional() })

export const CreateSocioCommandSchema = z.object({
  altaProvisoria: z.boolean().optional(),
  condicionIva: z.string().nullable().optional(),
  condicionIvaId: z.number().int().nullable().optional(),
  condicionPago: CondicionPagoDtoSchema.optional(),
  cuit: z.string().nullable().optional(),
  direccion: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  franjaEntrega: z.array(FranjaHorariaDtoSchema).nullable().optional(),
  horario: z.array(FranjaHorariaDtoSchema).nullable().optional(),
  localidad: z.string().max(100).nullable().optional(),
  nombreContacto: z.string().max(160).nullable().optional(),
  nombreFantasia: z.string().max(160).nullable().optional(),
  razonSocial: z.string().min(1).nullable().optional(),
  saldoInicial: z.number().min(0).optional(),
  telefono: z.string().nullable().optional(),
  tipoRaw: z.number().int().optional(),
  topeCredito: TopeCreditoDtoSchema.optional(),
  usuarioId: z.string().optional(),
})

export const CreateTipoGastoCommandSchema = z.object({
  nombre: z.string().min(1).max(150).nullable().optional(),
})

export const CreateTipoMovimientoInternoCommandSchema = z.object({
  nombre: z.string().min(1).max(150).nullable().optional(),
})

export const CreateUserPermissionRequestSchema = z.object({
  canCreate: z.boolean().optional(),
  canDelete: z.boolean().optional(),
  canRead: z.boolean().optional(),
  canUpdate: z.boolean().optional(),
  module: z.string().nullable().optional(),
})

export const CreateUserCommandSchema = z.object({
  apellido: z.string().min(1).max(50).nullable().optional(),
  email: z.string().min(1).nullable().optional(),
  nombre: z.string().min(1).max(50).nullable().optional(),
  password: z.string().nullable().optional(),
  permissions: z.array(CreateUserPermissionRequestSchema).nullable().optional(),
  puestoId: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
})

export const CreateVehiculoCommandSchema = z.object({
  capacidadCargaKg: z.number().gt(0).optional(),
  modelo: z.string().min(1).max(100).nullable().optional(),
  patente: z.string().min(1).max(20).nullable().optional(),
})

export const TipoOperacionVentaSchema = z.enum(['Presupuesto', 'Pedido'])

export const CreateVentaBorradorCommandSchema = z.object({
  clienteId: z.string().optional(),
  depositoId: z.string().optional(),
  tipoOperacion: TipoOperacionVentaSchema.optional(),
})

export const CreateVentaCommandItemDtoSchema = z.object({
  cantidad: z.number().gt(0).optional(),
  descuentoPorcentaje: z.number().min(0).max(100).optional(),
  productoId: z.string().optional(),
})

export const MetodoEntregaSchema = z.enum(['LogisticaPropia', 'RetiroEnLocal', 'Expreso'])

export const CreateVentaCommandSchema = z.object({
  cargoFlete: z.number().min(0).optional(),
  claveIdempotencia: z.string().max(200).nullable().optional(),
  clienteId: z.string().optional(),
  conFactura: z.boolean().nullable().optional(),
  depositoId: z.string().optional(),
  descuentoGeneral: z.number().min(0).max(100).optional(),
  entregaInmediata: z.boolean().optional(),
  fechaEntrega: z.string().nullable().optional(),
  items: z.array(CreateVentaCommandItemDtoSchema).min(1).nullable().optional(),
  metodoEntrega: MetodoEntregaSchema.optional(),
  motivoVentaSinStock: z.string().nullable().optional(),
  observaciones: z.string().max(500).nullable().optional(),
  porcentajeComisionCedido: z.number().nullable().optional(),
  tipoOperacion: TipoOperacionVentaSchema.optional(),
  usuarioGeneradorId: z.string().optional(),
  vendedorId: z.string().optional(),
})

export const DepositarChequeCommandSchema = z.object({
  chequeId: z.string().optional(),
  cuentaDestinoId: z.string().optional(),
})

export const DepositarChequesCommandSchema = z.object({
  chequeIds: z.array(z.string()).min(1).nullable().optional(),
  cuentaDestinoId: z.string().optional(),
})

export const DespacharExpresoCommandSchema = z.object({
  numeroGuia: z.string().min(1).max(80).nullable().optional(),
  observacion: z.string().max(500).nullable().optional(),
  transportista: z.string().min(1).max(160).nullable().optional(),
  ventaId: z.string().optional(),
  version: z.number().int().optional(),
})

export const DespacharTransferenciaStockCommandSchema = z.object({
  version: z.number().int().nullable().optional(),
})

export const EditarEventoCommandSchema = z.object({
  avisarDiasAntes: z.number().int().min(0).max(30).optional(),
  descripcion: z.string().max(500).nullable().optional(),
  fechaInicio: z.string().optional(),
  hora: z.string().nullable().optional(),
  montoEstimado: z.number().nullable().optional(),
  recurrencia: RecurrenciaDtoSchema.optional(),
  socioComercialId: z.string().nullable().optional(),
  subtipo: z.string().max(60).nullable().optional(),
  tipo: TipoEventoCalendarioSchema.optional(),
  titulo: z.string().min(1).max(150).optional(),
})

export const CambioCantidadDtoSchema = z.object({
  detalleId: z.string().optional(),
  nuevaCantidad: z.number().optional(),
})

export const EditarVentaDepositoCommandSchema = z.object({
  cambios: z.array(CambioCantidadDtoSchema).min(1).nullable().optional(),
  motivo: z.string().min(1).max(500).nullable().optional(),
  ventaId: z.string().optional(),
  version: z.number().int().optional(),
})

export const EliminarCompraCommandSchema = z.object({
  compraId: z.string().optional(),
  motivo: z.string().min(1).max(280).nullable().optional(),
  version: z.number().int().nullable().optional(),
})

export const EliminarDispositivoPushCommandSchema = z.object({
  token: z.string().nullable().optional(),
})

export const DestinoNotaCreditoSchema = z.enum(['SaldoAFavor', 'DevolucionDinero'])

export const NotaCreditoItemInputSchema = z.object({
  cantidad: z.number().optional(),
  ventaDetalleId: z.string().optional(),
})

export const EmitirNotaCreditoCommandSchema = z.object({
  cuentaPropiaId: z.string().nullable().optional(),
  destino: DestinoNotaCreditoSchema.optional(),
  items: z.array(NotaCreditoItemInputSchema).min(1).nullable().optional(),
  motivo: z.string().min(1).max(500).nullable().optional(),
  ventaId: z.string().optional(),
})

export const EmpacarVentaCommandSchema = z.object({
  cantidadBultos: z.number().int().gt(0).optional(),
  ventaId: z.string().optional(),
  version: z.number().int().optional(),
})

export const ImputacionCobroChoferSchema = z.enum(['PedidoActual', 'DeudaAnterior'])

export const ChequeDetalleItemSchema = z.object({
  banco: z.string().min(1).nullable().optional(),
  fechaEmision: z.string().optional(),
  fechaPago: z.string().optional(),
  imagenUrl: z.string().nullable().optional(),
  monto: z.number().gt(0).optional(),
  numero: z.string().min(1).nullable().optional(),
  titular: z.string().min(1).nullable().optional(),
})

export const LineaCobroEntregaInputSchema = z.object({
  cheques: z.array(ChequeDetalleItemSchema).nullable().optional(),
  fotoUrl: z.string().nullable().optional(),
  medioPagoId: z.string().optional(),
  monto: z.number().optional(),
})

export const CobroEnEntregaInputSchema = z.object({
  imputacion: ImputacionCobroChoferSchema.optional(),
  lineas: z.array(LineaCobroEntregaInputSchema).nullable().optional(),
})

export const DevolucionEnEntregaInputSchema = z.object({
  items: z.array(NotaCreditoItemInputSchema).nullable().optional(),
  motivo: z.string().nullable().optional(),
})

export const FirmaEnEntregaInputSchema = z.object({ fotoUrl: z.string().nullable().optional() })

export const EntregarParadaCommandSchema = z.object({
  claveIdempotencia: z.string().nullable().optional(),
  cobro: CobroEnEntregaInputSchema.optional(),
  devolucion: DevolucionEnEntregaInputSchema.optional(),
  evidenciaUrl: z.string().nullable().optional(),
  firma: FirmaEnEntregaInputSchema.optional(),
  nombreReceptor: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
})

export const EntregarVentaCommandSchema = z.object({
  usuarioModificadorId: z.string().optional(),
  ventaId: z.string().optional(),
  version: z.number().int().optional(),
})

export const ExecutePasswordResetCommandSchema = z.object({
  confirmNewPassword: z.string().nullable().optional(),
  email: z.string().min(1).nullable().optional(),
  newPassword: z.string().nullable().optional(),
  token: z.string().min(1).nullable().optional(),
})

export const FacturarAPedidoCommandSchema = z.object({
  confirmarFueraDeTermino: z.boolean().optional(),
  motivo: z.string().max(500).nullable().optional(),
})

export const GenerarVariantesProductoCommandSchema = z.object({
  fraganciaIds: z.array(z.string()).nullable().optional(),
  productoPadreId: z.string().optional(),
  stockInicialPorFragancia: z.record(z.string(), z.number()).nullable().optional(),
})

export const DisponibilidadItemRequestSchema = z.object({
  cantidad: z.number().optional(),
  productoId: z.string().optional(),
})

export const GetDisponibilidadVentaQuerySchema = z.object({
  depositoId: z.string().optional(),
  items: z.array(DisponibilidadItemRequestSchema).min(1).nullable().optional(),
})

export const GetVistaPreviaPrecioQuerySchema = z.object({
  markupPorcentaje: z.number().min(0).max(100000).optional(),
  precioCompraBase: z.number().min(0).optional(),
  precioVenta: z.number().nullable().optional(),
})

export const GetVistaPreviaRentabilidadCompraQuerySchema = z.object({
  descuentoPorcentaje: z.number().optional(),
  detalles: z.array(CompraDetalleDtoSchema).nullable().optional(),
  gastosOperativos: z.number().optional(),
})

export const GuardarNotaPedidoCommandSchema = z.object({
  compraId: z.string().optional(),
  version: z.number().int().optional(),
})

export const GuardarPresupuestoCommandSchema = z.object({
  ventaId: z.string().optional(),
  version: z.number().int().optional(),
})

export const IniciarPreparacionMasivaRequestSchema = z.object({
  ventaIds: z.array(z.string()).nullable().optional(),
})

export const ListaSurtidoPdfRequestSchema = z.object({
  ventaIds: z.array(z.string()).nullable().optional(),
})

export const MarcarNotificacionesLeidasCommandSchema = z.object({
  ids: z.array(z.string()).nullable().optional(),
  tipo: TipoNotificacionSchema.optional(),
})

export const EstadoOcurrenciaEventoSchema = z.enum(['Pagado', 'Omitido'])

export const MarcarOcurrenciaCommandSchema = z.object({
  estado: EstadoOcurrenciaEventoSchema.optional(),
  fechaReprogramada: z.string().nullable().optional(),
  montoReal: z.number().nullable().optional(),
})

export const PagarComisionVendedorCommandSchema = z.object({
  comprobanteUrl: z.string().nullable().optional(),
  medioPagoId: z.string().optional(),
  moneda: z.string().nullable().optional(),
  monto: z.number().gt(0).optional(),
  numeroComprobante: z.string().min(1).max(100).nullable().optional(),
  observaciones: z.string().max(400).nullable().optional(),
  vendedorId: z.string().optional(),
})

export const ReabrirPeriodoFiscalCommandSchema = z.object({
  motivo: z.string().min(1).max(500).nullable().optional(),
  periodo: z.number().int().optional(),
})

export const ReactivarSocioCommandSchema = z.object({
  cuit: z.string().nullable().optional(),
  direccion: z.string().nullable().optional(),
  nombreFantasia: z.string().max(160).nullable().optional(),
  socioId: z.string().optional(),
  telefono: z.string().nullable().optional(),
})

export const RechazarAutorizacionVentaCommandSchema = z.object({
  motivoRechazo: z.string().min(1).max(500).nullable().optional(),
  ventaId: z.string().optional(),
  version: z.number().int().optional(),
})

export const RechazarChequeCommandSchema = z.object({
  chequeId: z.string().optional(),
  motivo: z.string().min(1).nullable().optional(),
})

export const RechazarDevolucionRequestSchema = z.object({
  motivo: z.string().nullable().optional(),
})

export const RechazarPedidoTransferenciaCommandSchema = z.object({
  motivo: z.string().nullable().optional(),
  pedidoId: z.string().optional(),
})

export const RecibirCompraCommandSchema = z.object({
  compraId: z.string().optional(),
  comprobante: ComprobanteCompraInputSchema.optional(),
  fechaFacturaProveedor: z.string().nullable().optional(),
  usuarioId: z.string().optional(),
})

export const RecibirTransferenciaStockCommandSchema = z.object({
  version: z.number().int().nullable().optional(),
})

export const ReemplazarReglaComisionCommandSchema = z.object({
  id: z.string().optional(),
  motivo: z.string().max(200).nullable().optional(),
  porcentaje: z.number().optional(),
})

export const RegisterUserCommandSchema = z.object({
  apellido: z.string().min(1).max(50).nullable().optional(),
  confirmPassword: z.string().nullable().optional(),
  email: z.string().min(1).nullable().optional(),
  nombre: z.string().min(1).max(50).nullable().optional(),
  password: z.string().nullable().optional(),
})

export const RegistrarCaeFacturaCommandSchema = z.object({
  cae: z.string().min(1).nullable().optional(),
  caeVencimiento: z.string().optional(),
  fechaComprobante: z.string().optional(),
  id: z.string().optional(),
  numero: z.number().int().min(1).max(99999999).optional(),
})

export const LineaDevolucionInputSchema = z.object({
  cantidad: z.number().optional(),
  compraDetalleId: z.string().optional(),
})

export const RegistrarDevolucionProveedorCommandSchema = z.object({
  compraId: z.string().optional(),
  items: z.array(LineaDevolucionInputSchema).min(1).nullable().optional(),
  motivo: z.string().min(1).max(280).nullable().optional(),
  notaCredito: ComprobanteCompraInputSchema.optional(),
  version: z.number().int().nullable().optional(),
})

export const RegistrarDispositivoPushCommandSchema = z.object({
  plataforma: z.string().nullable().optional(),
  token: z.string().nullable().optional(),
})

export const RegistrarGastoCommandSchema = z.object({
  comprobante: ComprobanteCompraInputSchema.optional(),
  comprobanteUrl: z.string().nullable().optional(),
  cuentaOrigenId: z.string().nullable().optional(),
  depositoId: z.string().nullable().optional(),
  descripcion: z.string().min(1).max(200).nullable().optional(),
  fecha: z.string().nullable().optional(),
  medioPagoId: z.string().optional(),
  moneda: z.string().nullable().optional(),
  monto: z.number().gt(0).optional(),
  observaciones: z.string().nullable().optional(),
  tipoGastoId: z.string().optional(),
  usuarioId: z.string().optional(),
})

export const RegistrarMovimientoEntreCuentasCommandSchema = z.object({
  cuentaDestinoId: z.string().nullable().optional(),
  cuentaOrigenId: z.string().optional(),
  moneda: z.string().nullable().optional(),
  monto: z.number().gt(0).optional(),
  observaciones: z.string().nullable().optional(),
  retiradoPorNombre: z.string().nullable().optional(),
  retiradoPorUsuarioId: z.string().nullable().optional(),
  tipoMovimientoInternoId: z.string().optional(),
})

export const TipoAjusteManualVendedorSchema = z.enum(['Credito', 'Debito'])

export const RegistrarMovimientoManualVendedorCommandSchema = z.object({
  cuentaCorrienteId: z.string().optional(),
  moneda: z.string().nullable().optional(),
  monto: z.number().gt(0).optional(),
  motivo: z.string().min(1).max(400).nullable().optional(),
  tipo: TipoAjusteManualVendedorSchema.optional(),
})

export const ImputacionManualItemSchema = z.object({
  documentoId: z.string().optional(),
  monto: z.number().optional(),
})

export const TipoCuentaSocioSchema = z.enum(['Tst', 'Normal'])

export const RegistrarPagoCommandSchema = z.object({
  chequesAEndosar: z.array(z.string()).nullable().optional(),
  chequesPropiosEntregados: z.array(ChequeDetalleItemSchema).nullable().optional(),
  chequesRecibidos: z.array(ChequeDetalleItemSchema).nullable().optional(),
  claveIdempotencia: z.string().max(200).nullable().optional(),
  fechaOperacion: z.string().nullable().optional(),
  imputaciones: z.array(ImputacionManualItemSchema).nullable().optional(),
  medioPago: z.string().min(1).nullable().optional(),
  medioPagoId: z.string().nullable().optional(),
  moneda: z.string().nullable().optional(),
  monto: z.number().gt(0).optional(),
  referencia: z.string().nullable().optional(),
  socioComercialId: z.string().optional(),
  tipoCuenta: TipoCuentaSocioSchema.optional(),
  usuarioId: z.string().optional(),
})

export const PagoLineaInputSchema = z.object({
  chequesAEndosar: z.array(z.string()).nullable().optional(),
  chequesPropiosEntregados: z.array(ChequeDetalleItemSchema).nullable().optional(),
  chequesRecibidos: z.array(ChequeDetalleItemSchema).nullable().optional(),
  comprobanteUrl: z.string().nullable().optional(),
  cuentaClienteId: z.string().nullable().optional(),
  cuentaClienteInfo: z.string().nullable().optional(),
  cuentaPropiaId: z.string().nullable().optional(),
  medioPagoId: z.string().optional(),
  monto: z.number().optional(),
})

export const RegistrarPagoMultilineaCommandSchema = z.object({
  claveIdempotencia: z.string().max(200).nullable().optional(),
  comprobanteUrl: z.string().nullable().optional(),
  depositoId: z.string().nullable().optional(),
  fechaOperacion: z.string().nullable().optional(),
  imputaciones: z.array(ImputacionManualItemSchema).nullable().optional(),
  lineas: z.array(PagoLineaInputSchema).min(1).nullable().optional(),
  moneda: z.string().nullable().optional(),
  referencia: z.string().nullable().optional(),
  socioComercialId: z.string().optional(),
  tipoCuenta: TipoCuentaSocioSchema.optional(),
})

export const RegistrarPagoPorCuentaDeTercerosCommandSchema = z.object({
  claveIdempotencia: z.string().max(200).nullable().optional(),
  clienteId: z.string().optional(),
  fechaOperacion: z.string().nullable().optional(),
  imputacionesCompra: z.array(ImputacionManualItemSchema).nullable().optional(),
  imputacionesVenta: z.array(ImputacionManualItemSchema).nullable().optional(),
  moneda: z.string().min(1).nullable().optional(),
  monto: z.number().gt(0).optional(),
  proveedorId: z.string().optional(),
  referencia: z.string().max(200).nullable().optional(),
  tipoCuentaCliente: TipoCuentaSocioSchema.optional(),
  tipoCuentaProveedor: TipoCuentaSocioSchema.optional(),
})

export const ReportarResultadoParadaCommandSchema = z.object({
  entregado: z.boolean().optional(),
  evidenciaUrl: z.string().nullable().optional(),
  hojaDeRutaId: z.string().optional(),
  motivoRechazo: z.string().nullable().optional(),
  nombreReceptor: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
  paradaId: z.string().optional(),
})

export const ReprogramarEntregaCommandSchema = z.object({
  nuevaFechaEntrega: z.string().optional(),
  ventaId: z.string().optional(),
})

export const RequestPasswordResetCommandSchema = z.object({
  email: z.string().min(1).nullable().optional(),
})

export const ResolverNotaCreditoCommandSchema = z.object({
  aprobar: z.boolean().optional(),
  motivoRechazo: z.string().nullable().optional(),
  notaCreditoId: z.string().optional(),
})

export const ResolverSolicitudCambioCommandSchema = z.object({
  aprobar: z.boolean().optional(),
  comentario: z.string().max(500).nullable().optional(),
  solicitudId: z.string().optional(),
})

export const RevertirEndosoEntregaChequesCommandSchema = z.object({
  confirmaRecuperoFisico: z.boolean().optional(),
  motivo: z.string().min(1).max(500).nullable().optional(),
  pagoId: z.string().optional(),
})

export const SalidaSinFacturaRequestSchema = z.object({ motivo: z.string().nullable().optional() })

export const SetPasswordRequestDtoSchema = z.object({
  confirmNewPassword: z.string().nullable().optional(),
  newPassword: z.string().nullable().optional(),
})

export const SimularComisionBorradorLineaDtoSchema = z.object({
  productoId: z.string().optional(),
  subtotal: z.number().optional(),
})

export const SimularComisionBorradorQuerySchema = z.object({
  cargoFlete: z.number().min(0).max(1000000000000).optional(),
  descuentoGeneral: z.number().min(0).max(100).optional(),
  fecha: z.string().nullable().optional(),
  lineas: z.array(SimularComisionBorradorLineaDtoSchema).min(1).optional(),
  monto: z.number().nullable().optional(),
  porcentajeComisionCedido: z.number().nullable().optional(),
  vendedorId: z.string().nullable().optional(),
})

export const SolicitarCambioSocioCommandSchema = z.object({
  cuit: z.string().nullable().optional(),
  direccion: z.string().nullable().optional(),
  motivo: z.string().min(1).max(500).nullable().optional(),
  razonSocial: z.string().nullable().optional(),
  socioId: z.string().optional(),
})

export const SolicitarDevolucionCommandSchema = z.object({
  items: z.array(NotaCreditoItemInputSchema).min(1).nullable().optional(),
  motivo: z.string().min(1).max(500).nullable().optional(),
  ventaId: z.string().optional(),
})

export const TipoImportacionSchema = z.enum([
  'Socios',
  'Productos',
  'Compras',
  'Ventas',
  'Categorias',
  'ReglasComision',
])

export const ToggleProductoStatusCommandSchema = z.object({
  activo: z.boolean().optional(),
  productoId: z.string().optional(),
})

export const ToggleSocioStatusCommandSchema = z.object({
  id: z.string().optional(),
  usuarioId: z.string().optional(),
})

export const UpdateCategoriaCommandSchema = z.object({
  activo: z.boolean().optional(),
  id: z.string().optional(),
  nombre: z.string().min(1).max(150).nullable().optional(),
})

export const UpdateCompraCommandSchema = z.object({
  depositoId: z.string().optional(),
  descuentoPorcentaje: z.number().min(0).max(100).optional(),
  detalles: z.array(CompraDetalleDtoSchema).nullable().optional(),
  gastosOperativos: z.number().min(0).optional(),
  id: z.string().optional(),
  proveedorId: z.string().optional(),
  usuarioGeneradorId: z.string().optional(),
  version: z.number().int().nullable().optional(),
})

export const CondicionFiscalEmpresaSchema = z.enum(['ResponsableInscripto', 'Monotributo'])

export const UpdateCondicionFiscalEmpresaCommandSchema = z.object({
  condicionFiscal: CondicionFiscalEmpresaSchema.optional(),
})

export const UpdateCuentaCajaEfectivoCommandSchema = z.object({
  cuentaCajaEfectivoId: z.string().nullable().optional(),
})

export const UpdateCuentaCarteraChequesCommandSchema = z.object({
  cuentaCarteraChequesId: z.string().nullable().optional(),
})

export const UpdateDatosEmpresaCommandSchema = z.object({
  cuit: z.string().nullable().optional(),
  domicilioComercial: z.string().nullable().optional(),
  domicilioDeposito: z.string().nullable().optional(),
  domicilioFiscal: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  ingresosBrutos: z.string().nullable().optional(),
  inicioActividades: z.string().nullable().optional(),
  nombreFantasia: z.string().nullable().optional(),
  razonSocial: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
})

export const UpdateDepositoCommandSchema = z.object({
  activo: z.boolean().optional(),
  direccion: z.string().nullable().optional(),
  id: z.string().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  nombre: z.string().nullable().optional(),
})

export const UpdateDiasEntregaCommandSchema = z.object({
  domingo: z.boolean().optional(),
  jueves: z.boolean().optional(),
  lunes: z.boolean().optional(),
  martes: z.boolean().optional(),
  miercoles: z.boolean().optional(),
  sabado: z.boolean().optional(),
  viernes: z.boolean().optional(),
})

export const UpdateEtiquetaPiezaCommandSchema = z.object({
  altoMm: z.number().optional(),
  anchoMm: z.number().optional(),
  conLineaDeCorte: z.boolean().optional(),
})

export const UpdateExigirFotoRemitoAlEntregarCommandSchema = z.object({
  exigirFotoRemitoAlEntregar: z.boolean().nullable().optional(),
})

export const UpdateFraganciaCommandSchema = z.object({
  activo: z.boolean().optional(),
  id: z.string().optional(),
  nombre: z.string().min(1).max(150).nullable().optional(),
})

export const UpdateMargenMinimoCommandSchema = z.object({ nuevoMargen: z.number().optional() })

export const UpdateMedioPagoCommandSchema = z.object({
  activo: z.boolean().optional(),
  comisionPorcentaje: z.number().min(0).max(100).optional(),
  cuentaPropiaDefaultId: z.string().nullable().optional(),
  diasAcreditacion: z.number().int().min(0).optional(),
  id: z.string().optional(),
  nombre: z.string().min(1).max(150).nullable().optional(),
  requiereCaja: z.boolean().optional(),
})

export const UpdateParametrosCostoCommandSchema = z.object({
  absorcionVentanaDias: z.number().int().min(1).optional(),
  costoFleteCompraPct: z.number().min(0).optional(),
  margenAltoPct: z.number().gt(0).lt(100).optional(),
  margenObjetivoPct: z.number().gt(0).lt(100).optional(),
  percepcionesPct: z.number().min(0).optional(),
  umbralDesvioRatioPct: z.number().min(0).max(9999.99).optional(),
  ventanaPricingMeses: z.number().int().min(3).max(24).optional(),
})

export const UpdatePermissionRequestSchema = z.object({
  canCreate: z.boolean().optional(),
  canDelete: z.boolean().optional(),
  canRead: z.boolean().optional(),
  canUpdate: z.boolean().optional(),
  module: z.string().nullable().optional(),
})

export const UpdateProductoCommandSchema = z.object({
  activo: z.boolean().nullable().optional(),
  alicuotaIva: z.number().int().nullable().optional(),
  bultoContenido: z.number().optional(),
  bultoMadreContenido: z.number().nullable().optional(),
  categoriaId: z.string().nullable().optional(),
  codigoBarra: z.string().max(64).nullable().optional(),
  codigoPropio: z.string().nullable().optional(),
  codigoProveedor: z.string().max(100).nullable().optional(),
  cotUmbralPropioKg: z.number().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  esCargaMasiva: z.boolean().optional(),
  fraccionMinimaVenta: z.string().nullable().optional(),
  id: z.string().optional(),
  imageUrl: z.string().nullable().optional(),
  marca: z.string().max(100).nullable().optional(),
  markupPorcentaje: z.number().min(0).max(100000).nullable().optional(),
  nombre: z.string().min(1).max(150).nullable().optional(),
  pesoKg: z.number().nullable().optional(),
  precioCompraBase: z.number().min(0).optional(),
  stockMinimo: z.number().int().nullable().optional(),
  ubicacionDeposito: z.string().nullable().optional(),
  unidadMedida: z.string().nullable().optional(),
  ventaMinimaUnidades: z.number().optional(),
})

export const UpdateSocioCommandSchema = z.object({
  condicionIva: z.string().nullable().optional(),
  condicionIvaId: z.number().int().nullable().optional(),
  condicionPago: CondicionPagoDtoSchema.optional(),
  cuit: z.string().nullable().optional(),
  direccion: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  franjaEntrega: z.array(FranjaHorariaDtoSchema).nullable().optional(),
  horario: z.array(FranjaHorariaDtoSchema).nullable().optional(),
  id: z.string().optional(),
  limpiarCondicionIva: z.boolean().optional(),
  localidad: z.string().max(100).nullable().optional(),
  nombreContacto: z.string().max(160).nullable().optional(),
  nombreFantasia: z.string().max(160).nullable().optional(),
  razonSocial: z.string().min(1).nullable().optional(),
  telefono: z.string().nullable().optional(),
  topeCredito: TopeCreditoDtoSchema.optional(),
  usuarioId: z.string().optional(),
})

export const UpdateTipoGastoCommandSchema = z.object({
  activo: z.boolean().optional(),
  id: z.string().optional(),
  nombre: z.string().min(1).max(150).nullable().optional(),
})

export const UpdateTipoMovimientoInternoCommandSchema = z.object({
  activo: z.boolean().optional(),
  id: z.string().optional(),
  nombre: z.string().min(1).max(150).nullable().optional(),
})

export const UpdateUserCommandSchema = z.object({
  apellido: z.string().nullable().optional(),
  depositoId: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  id: z.string().optional(),
  nombre: z.string().nullable().optional(),
  quitarDeposito: z.boolean().optional(),
  role: z.string().nullable().optional(),
})

export const UpdateVehiculoCommandSchema = z.object({
  capacidadCargaKg: z.number().gt(0).optional(),
  id: z.string().optional(),
  modelo: z.string().min(1).max(100).nullable().optional(),
  patente: z.string().min(1).max(20).nullable().optional(),
})

export const UpdateVentaCommandItemDtoSchema = z.object({
  cantidad: z.number().gt(0).optional(),
  descuentoPorcentaje: z.number().min(0).max(100).optional(),
  productoId: z.string().optional(),
})

export const UpdateVentaCommandSchema = z.object({
  cargoFlete: z.number().min(0).nullable().optional(),
  conFactura: z.boolean().nullable().optional(),
  descuentoGeneral: z.number().min(0).max(100).optional(),
  fechaEntrega: z.string().nullable().optional(),
  id: z.string().optional(),
  items: z.array(UpdateVentaCommandItemDtoSchema).nullable().optional(),
  metodoEntrega: MetodoEntregaSchema.optional(),
  motivoVentaSinStock: z.string().nullable().optional(),
  observaciones: z.string().max(500).nullable().optional(),
  porcentajeComisionCedido: z.number().nullable().optional(),
  tipoOperacion: TipoOperacionVentaSchema.optional(),
  usuarioModificadorId: z.string().optional(),
  version: z.number().int().optional(),
})

export const UpdateVentaConFacturaPorDefectoCommandSchema = z.object({
  ventaConFacturaPorDefecto: z.boolean().nullable().optional(),
})

export const PuestoDetalleInputSchema = z.object({
  canCreate: z.boolean().optional(),
  canDelete: z.boolean().optional(),
  canRead: z.boolean().optional(),
  canUpdate: z.boolean().optional(),
  module: z.string().nullable().optional(),
})

export const UpsertPuestoRequestSchema = z.object({
  activo: z.boolean().optional(),
  descripcion: z.string().nullable().optional(),
  detalles: z.array(PuestoDetalleInputSchema).nullable().optional(),
  nombre: z.string().nullable().optional(),
})

export const UpsertVendedorLimitesRequestDtoSchema = z.object({
  comisionActiva: z.boolean().optional(),
  moneda: z.string().nullable().optional(),
  montoMaximoOperacion: z.number().optional(),
  porcentajeComision: z.number().optional(),
  porcentajeDescuentoMaximo: z.number().optional(),
  puedeVenderSinStock: z.boolean().optional(),
})

export const ItemStockFiscalDtoSchema = z.object({
  cantidad: z.number().optional(),
  productoId: z.string().optional(),
})

export const VerificarStockFiscalVentaQuerySchema = z.object({
  items: z.array(ItemStockFiscalDtoSchema).nullable().optional(),
})

export const VistaPreviaLineaQuerySchema = z.object({
  cantidad: z.number().gt(0).optional(),
  descuentoGeneral: z.number().min(0).max(100).optional(),
  descuentoPorcentaje: z.number().min(0).max(100).optional(),
  productoId: z.string().optional(),
})
