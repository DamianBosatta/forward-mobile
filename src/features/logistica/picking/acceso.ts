import type { AppCapability } from '@/features/auth/lib/capabilities'

/**
 * Quién puede abrir el tablero de picking: GET /Logistica/ventas-para-preparacion (y ventas-empacadas) piden
 * MOD_VIAJES:Read y además CAP_OPERAR_DEPOSITO o CAP_ARMAR_VIAJES. El chofer (solo MOD_VIAJES) recibe 403.
 * Con cualquiera de las dos alcanza (OR). El súper-admin las recibe en su lista de permisos.
 */
export const CAPACIDADES_DEL_TABLERO: readonly AppCapability[] = [
  // CAP_OPERAR_DEPOSITO todavía no está en la unión AppCapability (capabilities.ts, fuera de este cambio).
  'CAP_OPERAR_DEPOSITO' as AppCapability,
  'CAP_ARMAR_VIAJES',
]
