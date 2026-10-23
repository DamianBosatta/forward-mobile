import {
  AlarmClock, BadgeCheck, Ban, Banknote, CalendarClock, CalendarDays, CalendarRange, FileSpreadsheet,
  FileWarning, Hourglass, Landmark, PackageX, Receipt, ShieldAlert, Truck, UserCheck, UserPen, UserX,
  Vault, type LucideIcon,
} from 'lucide-react-native'
import type { components } from '@/libs/api-client/generated/schema'

export type TipoNotificacion = components['schemas']['TipoNotificacion']
export type AccionDestino = components['schemas']['AccionDestino']
export type AccionSugerida = components['schemas']['AccionSugeridaDto']

/**
 * Nombre e icono de cada tipo de aviso del servidor (`TipoNotificacion`).
 * `Record` exhaustivo: un tipo nuevo en el contrato sin entrada acá no compila.
 */
export const AVISO_POR_TIPO: Record<TipoNotificacion, { etiqueta: string; Icono: LucideIcon }> = {
  CajaSinCerrar: { etiqueta: 'Caja sin cerrar', Icono: Vault },
  PedidoEditadoPorDeposito: { etiqueta: 'Pedido ajustado por depósito', Icono: PackageX },
  SocioProvisorioPorVencer: { etiqueta: 'Cliente provisorio por vencer', Icono: Hourglass },
  SocioDesactivadoAutomaticamente: { etiqueta: 'Cliente desactivado por datos incompletos', Icono: UserX },
  SolicitudCambioSocio: { etiqueta: 'Solicitud de cambio de un socio', Icono: UserPen },
  SolicitudCambioResuelta: { etiqueta: 'Solicitud de cambio resuelta', Icono: UserCheck },
  ImportacionCompletada: { etiqueta: 'Carga masiva terminada', Icono: FileSpreadsheet },
  VentaNoEntregada: { etiqueta: 'Entrega no realizada', Icono: Truck },
  PresupuestoPorVencer: { etiqueta: 'Presupuesto por vencer', Icono: Hourglass },
  ChequePorVencer: { etiqueta: 'Cheque por vencer', Icono: Banknote },
  VentaRechazadaAutorizacion: { etiqueta: 'Venta rechazada', Icono: Ban },
  VentaPendienteAutorizacion: { etiqueta: 'Venta pendiente de autorización', Icono: ShieldAlert },
  VentaAutorizada: { etiqueta: 'Venta autorizada', Icono: BadgeCheck },
  PagoProveedorPorVencer: { etiqueta: 'Pago a proveedor por vencer', Icono: Landmark },
  PagoProveedorVencido: { etiqueta: 'Pago a proveedor vencido', Icono: Landmark },
  VentaRegularizadaPorCobro: { etiqueta: 'Venta liberada al regularizarse la cuenta', Icono: BadgeCheck },
  VencimientoCalendario: { etiqueta: 'Vencimiento del calendario', Icono: CalendarClock },
  RecordatorioPersonal: { etiqueta: 'Recordatorio personal', Icono: AlarmClock },
  ResumenSemanal: { etiqueta: 'Resumen semanal de vencimientos', Icono: CalendarDays },
  ResumenMensual: { etiqueta: 'Resumen mensual de vencimientos', Icono: CalendarRange },
  EntregasPasadasAlProximoDia: { etiqueta: 'Entregas pasadas al próximo día', Icono: Truck },
  FiscalSuperaStockReal: { etiqueta: 'Stock fiscal por encima del real', Icono: FileWarning },
  TalonarioRemitoPorVencer: { etiqueta: 'CAI de remitos por vencer', Icono: Receipt },
  TalonarioRemitoPorAgotarse: { etiqueta: 'Talonario de remitos por agotarse', Icono: Receipt },
  RemitosSinFacturaAntesDelCierre: { etiqueta: 'Remitos por facturar antes del cierre', Icono: Receipt },
  RemitosEntregadosSinFactura: { etiqueta: 'Remitos entregados sin factura', Icono: Receipt },
  RemitosSinFacturaAlCierre: { etiqueta: 'Remitos sin facturar al cierre del mes', Icono: FileWarning },
}

/**
 * La tabla única `AccionDestino → ruta de la app`. El servidor dice ADÓNDE en términos del
 * negocio y cada cliente decide cómo llegar. `null` = mobile no tiene esa pantalla (o es una
 * ficha sin id): el aviso se muestra sin botón, nunca con una navegación rota.
 */
export const RUTA_POR_DESTINO: Record<AccionDestino, (id: string | null) => string | null> = {
  Cheques: () => null, // Los cheques se operan en la web (bloque 12, D10).
  Venta: (id) => (id ? `/ventas/${encodeURIComponent(id)}` : null),
  VentasPendientesAutorizacion: () => '/autorizaciones',
  Caja: () => null, // La caja del día es de la web.
  Socios: () => '/socios',
  SolicitudesSocio: () => null, // Aprobar cambios de socios es de la web.
  Importaciones: () => null, // Las cargas masivas son de la web.
  Picking: () => '/logistica/pedidos', // Lo más cercano en mobile: pedidos por preparar.
  Compra: (id) => (id ? `/compras/${encodeURIComponent(id)}` : null),
  Calendario: () => '/calendario',
  Inventario: () => '/inventario',
  ConfiguracionFacturacion: () => null, // Talonarios y CAI se cargan desde la web.
  PosicionIva: () => null, // La posición de IVA es de la web.
}

export function rutaDeAccion(accion: AccionSugerida | null | undefined): string | null {
  // hasOwn: un destino que esta versión no conoce no cae en un miembro del prototipo.
  if (!accion || !Object.prototype.hasOwnProperty.call(RUTA_POR_DESTINO, accion.destino)) return null
  return RUTA_POR_DESTINO[accion.destino](accion.entidadId ?? null)
}

/** Nombre e icono del aviso; `null` si esta versión no conoce el tipo (se muestra el título del servidor). */
export function avisoDeTipo(tipo: string): { etiqueta: string; Icono: LucideIcon } | null {
  return Object.prototype.hasOwnProperty.call(AVISO_POR_TIPO, tipo) ? AVISO_POR_TIPO[tipo as TipoNotificacion] : null
}
