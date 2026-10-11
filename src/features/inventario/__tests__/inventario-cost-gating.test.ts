/**
 * S4 — Inventory screen cost-field gating tests (mobile).
 *
 * Spec (S4 ADR-6, Decision #81; 0.2c):
 *   - Sin CAP_VER_COSTOS no se ve el campo "Costo Base (ARS)" y el alta/edición queda
 *     inalcanzable (access-denied).
 *   - Con la capacidad, sí — sin importar el rol.
 *
 * Desde 0.2c la decide la capacidad (user.permissions), no la lista fija de roles.
 * Render proof lives in inventario-access-denied.test.tsx.
 */

import { canViewCost } from '../../ventas/lib/descuentos'

const conCosto = [{ module: 'MOD_STOCK', canRead: true }, { module: 'CAP_VER_COSTOS', canRead: true }]
const sinCosto = [{ module: 'MOD_STOCK', canRead: true, canUpdate: true }]

describe('S4 — Inventory cost-field gating: canViewCost(permissions)', () => {
  it('returns false without CAP_VER_COSTOS — cost field must be hidden', () => {
    expect(canViewCost(sinCosto)).toBe(false)
  })

  it('returns false for empty permissions — cost field must be hidden', () => {
    expect(canViewCost([])).toBe(false)
  })

  it('returns false for an unknown capability — cost field must be hidden', () => {
    expect(canViewCost([{ module: 'CAP_OTRA_COSA', canRead: true }])).toBe(false)
  })

  it('returns true with CAP_VER_COSTOS — cost field must be visible', () => {
    expect(canViewCost(conCosto)).toBe(true)
  })
})

describe('S4 — Inventory edit-affordance gate behavioral contract', () => {
  /**
   * The save button in editar/[id].tsx is already wrapped in RequirePermission
   * (MOD_STOCK:update). The S4 FIX #1 gate: canViewCost triggers an early-return
   * access-denied view so even a user with MOD_STOCK:update but without
   * CAP_VER_COSTOS sees the banner instead of a partially-editable form.
   */
  it('MOD_STOCK:update without CAP_VER_COSTOS → access-denied view', () => {
    expect(canViewCost(sinCosto)).toBe(false)
  })

  it('CAP_VER_COSTOS → edit form editable with cost field', () => {
    expect(canViewCost(conCosto)).toBe(true)
  })
})
