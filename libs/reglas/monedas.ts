/** Monedas que opera el sistema: la misma lista que `Domain/Common/Monedas.cs` (decisión del dueño L43). */
export const MONEDAS_PERMITIDAS = ['ARS', 'USD'] as const

export type MonedaPermitida = (typeof MONEDAS_PERMITIDAS)[number]
