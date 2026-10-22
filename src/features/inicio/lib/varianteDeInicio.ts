export type VarianteDeInicio = 'chofer' | 'gestion' | 'vendedor'

/**
 * Qué inicio ve cada usuario (D12, lámina PermMatriz "1 · Inicio"). Igual que la web
 * (forward-frontend/apps/web/app/(dashboard)/dashboard/page.tsx: `hasSessionCapability(…, 'CAP_VER_COSTOS')`):
 * con CAP_VER_COSTOS, el inicio de gestión; si no, el del vendedor. Nunca por rol. El chofer
 * sigue yendo a su consola.
 */
export function varianteDeInicio({ esChofer, veCostos }: { esChofer: boolean; veCostos: boolean }): VarianteDeInicio {
  if (esChofer) return 'chofer'
  return veCostos ? 'gestion' : 'vendedor'
}
