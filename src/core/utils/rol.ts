/** Nombre con que se lee cada puesto (P11). Solo se muestra: no decide ningún permiso (X3). */
const ETIQUETAS: Record<string, string> = {
  AdministradorSistemas: 'Administrador de sistemas',
  Administrador: 'Administrador',
  Gerencia: 'Gerencia',
  Empleado: 'Empleado',
}

/** "AdministradorSistemas" → "Administrador de sistemas". Un puesto que no conocemos se muestra como llegó. */
export function etiquetaDeRol(rol: string): string {
  return ETIQUETAS[rol] ?? rol
}

/** Varios puestos en una línea, separados por " · ". */
export function etiquetasDeRoles(roles: readonly string[] | null | undefined): string {
  return (roles ?? []).map(etiquetaDeRol).join(' · ')
}
