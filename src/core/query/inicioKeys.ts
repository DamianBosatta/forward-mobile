/**
 * Raíz de las consultas de Inicio: resumen de Ventas y Compras. Vive en su propio archivo para que la
 * regla central de refresco (`libs/api-client/invalidaciones.ts`) y el QueryClient no se importen en círculo.
 */
export const inicioKeys = {
  all: ['inicio'] as const,
  resumen: () => [...inicioKeys.all, 'resumen'] as const,
}
