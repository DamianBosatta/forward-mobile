/**
 * Re-exports from libs/api-client/anular-compra so that:
 * - The test at src/features/compras/__tests__/anular-compra.test.ts imports from this path
 * - The hook in libs/api-client/compras.ts imports from the canonical source
 *
 * Both paths resolve to the same implementation — tests guard the shipped code.
 */
export { buildAnularCompraPayload } from '../../../../libs/api-client/anular-compra'
export type { AnularCompraPayload } from '../../../../libs/api-client/anular-compra'
