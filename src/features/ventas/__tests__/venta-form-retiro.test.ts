/**
 * S3-T1 — RED tests for retiro-en-local form logic (mobile).
 *
 * Mirrors the web equivalent (venta-form-retiro.test.ts) but targets the
 * mobile pure-logic lib extracted from nueva.tsx.
 *
 * Logic extracted to: src/features/ventas/lib/venta-form-retiro.ts
 * (mirrors the web lib in forward-frontend/apps/web/src/features/ventas/lib/)
 *
 * NOTE ON COMPONENT TESTS:
 *   nueva.tsx is a 2000-line RN screen that depends on:
 *   - expo-router (navigation), @tanstack/react-query, expo-blur, expo-image,
 *     zustand stores, and numerous native modules not shimmable in jest-expo.
 *   Rendering it in jest causes import resolution failures for native bridged
 *   modules (DateTimePicker, etc.). This is an established limitation in
 *   jest-expo for complex screen components. The accepted approach (consistent
 *   with the rest of this codebase's ventas tests) is to extract pure logic
 *   to a framework-agnostic lib and test THAT instead.
 *   The component integration is verified manually / via E2E.
 */

import {
  METODO_ENTREGA,
  resolveMetodoEntrega,
  isProductAddable,
  requiereFechaEntrega,
  esFechaEntregaValida,
  buildVentaPayload,
} from '../lib/venta-form-retiro'

// ─────────────────────────────────────────────────────────────────────────────
// METODO_ENTREGA constants
// ─────────────────────────────────────────────────────────────────────────────

describe('METODO_ENTREGA constants', () => {
  it('Logistica equals 1', () => {
    expect(METODO_ENTREGA.Logistica).toBe(1)
  })

  it('RetiroEnLocal equals 2', () => {
    expect(METODO_ENTREGA.RetiroEnLocal).toBe(2)
  })

  it('Expreso equals 3', () => {
    expect(METODO_ENTREGA.Expreso).toBe(3)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// resolveMetodoEntrega
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveMetodoEntrega', () => {
  it('forces RetiroEnLocal (2) when entregaInmediata is true, regardless of selected method', () => {
    expect(resolveMetodoEntrega(true, METODO_ENTREGA.Logistica)).toBe(METODO_ENTREGA.RetiroEnLocal)
    expect(resolveMetodoEntrega(true, METODO_ENTREGA.Expreso)).toBe(METODO_ENTREGA.RetiroEnLocal)
    expect(resolveMetodoEntrega(true, METODO_ENTREGA.RetiroEnLocal)).toBe(METODO_ENTREGA.RetiroEnLocal)
  })

  it('passes through the selected method when entregaInmediata is false', () => {
    expect(resolveMetodoEntrega(false, METODO_ENTREGA.Logistica)).toBe(METODO_ENTREGA.Logistica)
    expect(resolveMetodoEntrega(false, METODO_ENTREGA.Expreso)).toBe(METODO_ENTREGA.Expreso)
    expect(resolveMetodoEntrega(false, METODO_ENTREGA.RetiroEnLocal)).toBe(METODO_ENTREGA.RetiroEnLocal)
  })

  it('defaults to Logistica (1) when no method is provided and entregaInmediata is false', () => {
    expect(resolveMetodoEntrega(false)).toBe(METODO_ENTREGA.Logistica)
  })

  it('defaults to RetiroEnLocal (2) when no method is provided and entregaInmediata is true', () => {
    expect(resolveMetodoEntrega(true)).toBe(METODO_ENTREGA.RetiroEnLocal)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// isProductAddable
// ─────────────────────────────────────────────────────────────────────────────

describe('isProductAddable', () => {
  describe('when entregaInmediata is ON (venta directa mode)', () => {
    it('returns false for stockDisponible = 0 (hard block — no stock)', () => {
      expect(isProductAddable(true, 0)).toBe(false)
    })

    it('returns false for stockDisponible < 0 (negative stock)', () => {
      expect(isProductAddable(true, -5)).toBe(false)
    })

    it('returns true for stockDisponible = 1 (minimum positive)', () => {
      expect(isProductAddable(true, 1)).toBe(true)
    })

    it('returns true for stockDisponible > 1', () => {
      expect(isProductAddable(true, 100)).toBe(true)
    })
  })

  describe('when entregaInmediata is OFF (normal mode)', () => {
    it('returns true regardless of zero stock', () => {
      expect(isProductAddable(false, 0)).toBe(true)
    })

    it('returns true for negative stock (normal path allows sin-stock sales)', () => {
      expect(isProductAddable(false, -5)).toBe(true)
    })

    it('returns true for positive stock', () => {
      expect(isProductAddable(false, 50)).toBe(true)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// buildVentaPayload
// ─────────────────────────────────────────────────────────────────────────────

describe('buildVentaPayload', () => {
  const baseFormData = {
    clienteId: 'client-1',
    depositoId: 'dep-1',
    tipoOperacion: 2,
    descuentoGeneral: 0,
    detalles: [
      { productoId: 'prod-1', cantidad: 3, descuentoPorcentaje: 10 },
      { productoId: 'prod-2', cantidad: 1 },
    ],
  }

  it('includes entregaInmediata: true in payload when toggle is ON', () => {
    const result = buildVentaPayload(baseFormData, true, METODO_ENTREGA.Logistica)
    expect(result.entregaInmediata).toBe(true)
  })

  it('includes entregaInmediata: false in payload when toggle is OFF', () => {
    const result = buildVentaPayload(baseFormData, false, METODO_ENTREGA.Logistica)
    expect(result.entregaInmediata).toBe(false)
  })

  it('forces metodoEntrega to RetiroEnLocal (2) when entregaInmediata is ON', () => {
    const result = buildVentaPayload(baseFormData, true, METODO_ENTREGA.Expreso)
    expect(result.metodoEntrega).toBe(METODO_ENTREGA.RetiroEnLocal)
  })

  it('sends the selected metodoEntrega when entregaInmediata is OFF', () => {
    const result = buildVentaPayload(baseFormData, false, METODO_ENTREGA.Expreso)
    expect(result.metodoEntrega).toBe(METODO_ENTREGA.Expreso)
  })

  it('maps detalles to items array with descuentoPorcentaje defaulting to 0', () => {
    const result = buildVentaPayload(baseFormData, false, METODO_ENTREGA.Logistica)
    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toEqual({ productoId: 'prod-1', cantidad: 3, descuentoPorcentaje: 10 })
    expect(result.items[1]).toEqual({ productoId: 'prod-2', cantidad: 1, descuentoPorcentaje: 0 })
  })

  it('copies clienteId, depositoId, tipoOperacion, descuentoGeneral from form data', () => {
    const result = buildVentaPayload(baseFormData, false, METODO_ENTREGA.Logistica)
    expect(result.clienteId).toBe('client-1')
    expect(result.depositoId).toBe('dep-1')
    expect(result.tipoOperacion).toBe(2)
    expect(result.descuentoGeneral).toBe(0)
  })

  it('defaults metodoEntrega to Logistica (1) when no selectedMethod is provided and toggle is OFF', () => {
    const result = buildVentaPayload(baseFormData, false)
    expect(result.metodoEntrega).toBe(METODO_ENTREGA.Logistica)
  })

  it('full venta-directa payload shape: entregaInmediata + RetiroEnLocal + items', () => {
    const directFormData = {
      clienteId: 'client-2',
      depositoId: 'dep-central',
      tipoOperacion: 2,
      descuentoGeneral: 5,
      detalles: [{ productoId: 'prod-A', cantidad: 2, descuentoPorcentaje: 0 }],
    }
    const result = buildVentaPayload(directFormData, true)
    expect(result).toMatchObject({
      clienteId: 'client-2',
      depositoId: 'dep-central',
      tipoOperacion: 2,
      descuentoGeneral: 5,
      metodoEntrega: METODO_ENTREGA.RetiroEnLocal,
      entregaInmediata: true,
      items: [{ productoId: 'prod-A', cantidad: 2, descuentoPorcentaje: 0 }],
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// requiereFechaEntrega
// ─────────────────────────────────────────────────────────────────────────────

describe('requiereFechaEntrega', () => {
  it('returns true for Logistica (1) when entregaInmediata is OFF', () => {
    expect(requiereFechaEntrega(false, METODO_ENTREGA.Logistica)).toBe(true)
  })

  it('returns true for Expreso (3) when entregaInmediata is OFF', () => {
    expect(requiereFechaEntrega(false, METODO_ENTREGA.Expreso)).toBe(true)
  })

  it('returns false for RetiroEnLocal (2) when entregaInmediata is OFF', () => {
    expect(requiereFechaEntrega(false, METODO_ENTREGA.RetiroEnLocal)).toBe(false)
  })

  it('returns false for any method when entregaInmediata is ON (forces RetiroEnLocal)', () => {
    expect(requiereFechaEntrega(true, METODO_ENTREGA.Logistica)).toBe(false)
    expect(requiereFechaEntrega(true, METODO_ENTREGA.Expreso)).toBe(false)
    expect(requiereFechaEntrega(true, METODO_ENTREGA.RetiroEnLocal)).toBe(false)
  })

  it('defaults to Logistica (requires date) when no method provided and entregaInmediata is OFF', () => {
    expect(requiereFechaEntrega(false)).toBe(true)
  })

  it('defaults to RetiroEnLocal (no date) when no method provided and entregaInmediata is ON', () => {
    expect(requiereFechaEntrega(true)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// esFechaEntregaValida
// ─────────────────────────────────────────────────────────────────────────────

describe('esFechaEntregaValida', () => {
  it('returns false for null', () => {
    expect(esFechaEntregaValida(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(esFechaEntregaValida(undefined)).toBe(false)
  })

  it('returns false for a Sunday (getDay() === 0)', () => {
    // 2025-06-01 is a Sunday
    const sunday = new Date(2025, 5, 1) // month is 0-indexed
    expect(sunday.getDay()).toBe(0)
    expect(esFechaEntregaValida(sunday)).toBe(false)
  })

  it('returns true for a Monday (getDay() === 1)', () => {
    const monday = new Date(2025, 5, 2)
    expect(monday.getDay()).toBe(1)
    expect(esFechaEntregaValida(monday)).toBe(true)
  })

  it('returns true for Tuesday through Saturday (getDay() 2–6)', () => {
    // 2025-06-03 Tuesday through 2025-06-07 Saturday
    for (let day = 2; day <= 6; day++) {
      const date = new Date(2025, 5, 1 + day) // June 2025: 1=Sun, 2=Mon, 3=Tue...
      expect(esFechaEntregaValida(date)).toBe(true)
    }
  })

  it('returns false for another Sunday in a different month', () => {
    // 2025-01-05 is a Sunday
    const sunday = new Date(2025, 0, 5)
    expect(sunday.getDay()).toBe(0)
    expect(esFechaEntregaValida(sunday)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// buildVentaPayload — cargoFlete and fechaEntrega (parity tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('buildVentaPayload — cargoFlete', () => {
  const base = {
    clienteId: 'c1',
    depositoId: 'd1',
    tipoOperacion: 2,
    descuentoGeneral: 0,
    detalles: [{ productoId: 'p1', cantidad: 1 }],
  }

  it('includes cargoFlete in payload when > 0', () => {
    const result = buildVentaPayload({ ...base, cargoFlete: 500 }, false, METODO_ENTREGA.Logistica)
    expect(result.cargoFlete).toBe(500)
  })

  it('omits cargoFlete from payload when 0', () => {
    const result = buildVentaPayload({ ...base, cargoFlete: 0 }, false, METODO_ENTREGA.Logistica)
    expect(result.cargoFlete).toBeUndefined()
  })

  it('omits cargoFlete from payload when not provided', () => {
    const result = buildVentaPayload(base, false, METODO_ENTREGA.Logistica)
    expect(result.cargoFlete).toBeUndefined()
  })

  it('includes cargoFlete for Retiro method when flete > 0', () => {
    const result = buildVentaPayload({ ...base, cargoFlete: 200 }, false, METODO_ENTREGA.RetiroEnLocal)
    expect(result.cargoFlete).toBe(200)
  })
})

describe('buildVentaPayload — fechaEntrega (parity: ISO datetime string)', () => {
  const base = {
    clienteId: 'c1',
    depositoId: 'd1',
    tipoOperacion: 2,
    descuentoGeneral: 0,
    detalles: [{ productoId: 'p1', cantidad: 1 }],
  }

  it('includes fechaEntrega as ISO datetime string for Logistica when date is provided', () => {
    const fecha = new Date(2025, 5, 10, 12, 0, 0) // Tuesday June 10 2025
    const result = buildVentaPayload(
      { ...base, fechaEntrega: fecha },
      false,
      METODO_ENTREGA.Logistica,
    )
    expect(result.fechaEntrega).toBe(fecha.toISOString())
  })

  it('includes fechaEntrega as ISO datetime string for Expreso when date is provided', () => {
    const fecha = new Date(2025, 5, 11, 9, 0, 0) // Wednesday June 11 2025
    const result = buildVentaPayload(
      { ...base, fechaEntrega: fecha },
      false,
      METODO_ENTREGA.Expreso,
    )
    expect(result.fechaEntrega).toBe(fecha.toISOString())
  })

  it('omits fechaEntrega when metodo is RetiroEnLocal (no date required)', () => {
    const fecha = new Date(2025, 5, 10)
    const result = buildVentaPayload(
      { ...base, fechaEntrega: fecha },
      false,
      METODO_ENTREGA.RetiroEnLocal,
    )
    expect(result.fechaEntrega).toBeUndefined()
  })

  it('omits fechaEntrega when entregaInmediata is ON even if date is provided', () => {
    const fecha = new Date(2025, 5, 10)
    const result = buildVentaPayload(
      { ...base, fechaEntrega: fecha },
      true,
      METODO_ENTREGA.Logistica,
    )
    expect(result.fechaEntrega).toBeUndefined()
  })

  it('omits fechaEntrega when formData.fechaEntrega is null', () => {
    const result = buildVentaPayload(
      { ...base, fechaEntrega: null },
      false,
      METODO_ENTREGA.Logistica,
    )
    expect(result.fechaEntrega).toBeUndefined()
  })

  it('omits fechaEntrega when formData.fechaEntrega is not provided', () => {
    const result = buildVentaPayload(base, false, METODO_ENTREGA.Logistica)
    expect(result.fechaEntrega).toBeUndefined()
  })

  it('payload fechaEntrega matches fecha.toISOString() — ISO datetime format (not YYYY-MM-DD)', () => {
    // Mobile wire format: ISO datetime (2025-06-10T15:00:00.000Z), NOT YYYY-MM-DD
    const fecha = new Date(2025, 5, 10, 12, 0, 0)
    const result = buildVentaPayload(
      { ...base, fechaEntrega: fecha },
      false,
      METODO_ENTREGA.Logistica,
    )
    expect(result.fechaEntrega).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    expect(result.fechaEntrega).not.toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Payload parity — buildVentaPayload vs current inline logic in nueva.tsx
// ─────────────────────────────────────────────────────────────────────────────
// These tests document the behavioral contract of buildVentaPayload as it
// relates to the inline logic that existed in nueva.tsx before the refactor.
// Purpose: ensure extracted lib produces field-for-field equivalent output
// for the fields it covers (vendedorId, usuarioGeneradorId, motivoVentaSinStock
// are screen-specific extras that nueva.tsx merges in after calling the lib).

describe('buildVentaPayload — parity with nueva.tsx inline payload', () => {
  const inlineFormData = {
    clienteId: 'abc-123',
    depositoId: 'fb15c487-acd2-41bb-8391-8353e61e8565',
    tipoOperacion: 2 as const,
    descuentoGeneral: 10,
    cargoFlete: 350,
    detalles: [
      { productoId: 'prod-x', cantidad: 5, descuentoPorcentaje: 15 },
      { productoId: 'prod-y', cantidad: 2, descuentoPorcentaje: 0 },
    ],
  }

  it('parity: core fields match inline payload for Logistica + no entregaInmediata', () => {
    const result = buildVentaPayload(inlineFormData, false, METODO_ENTREGA.Logistica)
    expect(result.clienteId).toBe(inlineFormData.clienteId)
    expect(result.depositoId).toBe(inlineFormData.depositoId)
    expect(result.tipoOperacion).toBe(inlineFormData.tipoOperacion)
    expect(result.descuentoGeneral).toBe(inlineFormData.descuentoGeneral)
    expect(result.metodoEntrega).toBe(METODO_ENTREGA.Logistica)
    expect(result.cargoFlete).toBe(350)
  })

  it('parity: items array has descuentoPorcentaje 0 (not undefined) when no discount', () => {
    const result = buildVentaPayload(inlineFormData, false, METODO_ENTREGA.Logistica)
    // prod-y has descuentoPorcentaje: 0; buildVentaPayload normalizes to 0
    const prodY = result.items.find(i => i.productoId === 'prod-y')!
    expect(prodY.descuentoPorcentaje).toBe(0)
  })

  it('parity: fechaEntrega is ISO datetime string matching fecha.toISOString()', () => {
    const fecha = new Date(2025, 5, 12, 10, 30, 0) // Thursday June 12 2025
    const result = buildVentaPayload(
      { ...inlineFormData, fechaEntrega: fecha },
      false,
      METODO_ENTREGA.Logistica,
    )
    // Inline: `fechaEntrega: fechaEntrega ? fechaEntrega.toISOString() : undefined`
    expect(result.fechaEntrega).toBe(fecha.toISOString())
  })

  it('parity: cargoFlete included when fleteMonto > 0', () => {
    const result = buildVentaPayload({ ...inlineFormData, cargoFlete: 350 }, false, METODO_ENTREGA.Logistica)
    expect(result.cargoFlete).toBe(350)
  })

  it('parity: entregaInmediata is boolean in lib (inline used || undefined — semantically same)', () => {
    const offResult = buildVentaPayload(inlineFormData, false, METODO_ENTREGA.Logistica)
    const onResult = buildVentaPayload(inlineFormData, true, METODO_ENTREGA.RetiroEnLocal)
    // Lib always emits a boolean (false / true), inline emitted undefined when false.
    // Both signal "not immediate" to the backend — the change is non-breaking.
    expect(offResult.entregaInmediata).toBe(false)
    expect(onResult.entregaInmediata).toBe(true)
  })

  it('parity: full shape for Retiro (no flete, no fechaEntrega)', () => {
    const fecha = new Date(2025, 5, 15) // Sunday would normally be caught by esFechaEntregaValida
    const retiroData = {
      clienteId: 'client-r',
      depositoId: 'dep-main',
      tipoOperacion: 2 as const,
      descuentoGeneral: 0,
      cargoFlete: 0, // no flete for retiro
      fechaEntrega: fecha,
      detalles: [{ productoId: 'p1', cantidad: 3, descuentoPorcentaje: 5 }],
    }
    const result = buildVentaPayload(retiroData, false, METODO_ENTREGA.RetiroEnLocal)
    expect(result.metodoEntrega).toBe(METODO_ENTREGA.RetiroEnLocal)
    expect(result.fechaEntrega).toBeUndefined() // RetiroEnLocal: no date in payload
    expect(result.cargoFlete).toBeUndefined()   // 0 flete → omitted
  })
})
