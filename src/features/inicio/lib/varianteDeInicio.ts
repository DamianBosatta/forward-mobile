export type VarianteDeInicio = 'chofer' | 'gestion' | 'vendedor' | 'deposito'

/**
 * Qué inicio ve cada usuario (D12, lámina PermMatriz "1 · Inicio"). Igual que la web
 * (forward-frontend/apps/web/app/(dashboard)/dashboard/page.tsx: `hasSessionCapability(…, 'CAP_VER_COSTOS')`):
 * con CAP_VER_COSTOS, el inicio de gestión (administración); si no, el del vendedor. Nunca por rol. El chofer
 * sigue yendo a su consola. El depósito es quien no vende ni lee ventas y sí maneja stock o compras: se
 * reconoce por sus permisos de hoy, sin capacidades nuevas.
 */
export function varianteDeInicio({ esChofer, veCostos, esDeposito = false }: { esChofer: boolean; veCostos: boolean; esDeposito?: boolean }): VarianteDeInicio {
  if (esChofer) return 'chofer'
  if (veCostos) return 'gestion'
  return esDeposito ? 'deposito' : 'vendedor'
}
