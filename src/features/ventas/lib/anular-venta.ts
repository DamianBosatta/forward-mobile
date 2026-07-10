/**
 * Re-exports from libs/api-client/anular-venta so that:
 * - The test at src/features/ventas/__tests__/anular-venta.test.ts imports from this path
 * - The hook in libs/api-client/ventas.ts imports from the canonical source
 *
 * Both paths resolve to the same implementation — tests guard the shipped code.
 */
export { buildAnularVentaPayload } from '../../../../libs/api-client/anular-venta'
export type { AnularVentaPayload } from '../../../../libs/api-client/anular-venta'
