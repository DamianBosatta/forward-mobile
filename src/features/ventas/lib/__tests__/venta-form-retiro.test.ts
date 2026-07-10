/**
 * Regression tests for venta-form-retiro.ts — payload-building and delivery-date
 * rules for the venta creation flow.
 *
 * Purpose: characterization suite — locks CURRENT behavior so the upcoming
 * conservative layout audit of ventas/nueva.tsx cannot silently break logic.
 * Tests reflect actual implementation semantics, including:
 *   - entregaInmediata forcing RetiroEnLocal and bypassing date requirements
 *   - Sunday delivery block (getDay() === 0)
 *   - Wire format: fechaEntrega as ISO 8601 datetime string (not YYYY-MM-DD)
 *   - cargoFlete inclusion only when strictly > 0
 *   - descuentoPorcentaje defaulting to 0 when absent in a detail line
 */

import {
  METODO_ENTREGA,
  resolveMetodoEntrega,
  isProductAddable,
  requiereFechaEntrega,
  esFechaEntregaValida,
  buildVentaPayload,
  VentaFormData,
} from '../venta-form-retiro'

// ─── METODO_ENTREGA constant ─────────────────────────────────────────────────

describe('METODO_ENTREGA', () => {
  it('has the correct numeric values that mirror the backend C# enum', () => {
    expect(METODO_ENTREGA.Logistica).toBe(1)
    expect(METODO_ENTREGA.RetiroEnLocal).toBe(2)
    expect(METODO_ENTREGA.Expreso).toBe(3)
  })
})

// ─── resolveMetodoEntrega ────────────────────────────────────────────────────

describe('resolveMetodoEntrega', () => {
  it('forces RetiroEnLocal when entregaInmediata is true, regardless of selector', () => {
    expect(resolveMetodoEntrega(true, METODO_ENTREGA.Logistica)).toBe(METODO_ENTREGA.RetiroEnLocal)
    expect(resolveMetodoEntrega(true, METODO_ENTREGA.Expreso)).toBe(METODO_ENTREGA.RetiroEnLocal)
    expect(resolveMetodoEntrega(true, METODO_ENTREGA.RetiroEnLocal)).toBe(METODO_ENTREGA.RetiroEnLocal)
  })

  it('returns the selected method when entregaInmediata is false', () => {
    expect(resolveMetodoEntrega(false, METODO_ENTREGA.Logistica)).toBe(METODO_ENTREGA.Logistica)
    expect(resolveMetodoEntrega(false, METODO_ENTREGA.Expreso)).toBe(METODO_ENTREGA.Expreso)
    expect(resolveMetodoEntrega(false, METODO_ENTREGA.RetiroEnLocal)).toBe(METODO_ENTREGA.RetiroEnLocal)
  })

  it('defaults to Logistica when selectedMethod is omitted and not inmediata', () => {
    expect(resolveMetodoEntrega(false)).toBe(METODO_ENTREGA.Logistica)
  })
})

// ─── isProductAddable ────────────────────────────────────────────────────────

describe('isProductAddable', () => {
  describe('when entregaInmediata is false (normal sale)', () => {
    it('allows adding regardless of stock level', () => {
      expect(isProductAddable(false, 0)).toBe(true)
      expect(isProductAddable(false, -5)).toBe(true)
      expect(isProductAddable(false, 100)).toBe(true)
    })
  })

  describe('when entregaInmediata is true (counter-sale / venta directa)', () => {
    it('blocks adding when stock is 0', () => {
      expect(isProductAddable(true, 0)).toBe(false)
    })

    it('blocks adding when stock is negative', () => {
      expect(isProductAddable(true, -1)).toBe(false)
    })

    it('allows adding when stock is positive', () => {
      expect(isProductAddable(true, 1)).toBe(true)
      expect(isProductAddable(true, 100)).toBe(true)
    })
  })
})

// ─── requiereFechaEntrega ────────────────────────────────────────────────────

describe('requiereFechaEntrega', () => {
  it('returns false when entregaInmediata is true (forced to RetiroEnLocal)', () => {
    expect(requiereFechaEntrega(true, METODO_ENTREGA.Logistica)).toBe(false)
    expect(requiereFechaEntrega(true, METODO_ENTREGA.Expreso)).toBe(false)
  })

  it('returns false for RetiroEnLocal (no date needed for pickup)', () => {
    expect(requiereFechaEntrega(false, METODO_ENTREGA.RetiroEnLocal)).toBe(false)
  })

  it('returns true for Logistica (date required)', () => {
    expect(requiereFechaEntrega(false, METODO_ENTREGA.Logistica)).toBe(true)
  })

  it('returns true for Expreso (date required)', () => {
    expect(requiereFechaEntrega(false, METODO_ENTREGA.Expreso)).toBe(true)
  })

  it('defaults to Logistica (requires date) when selectedMethod is omitted', () => {
    expect(requiereFechaEntrega(false)).toBe(true)
  })
})

// ─── esFechaEntregaValida ────────────────────────────────────────────────────

describe('esFechaEntregaValida', () => {
  it('returns false for null', () => {
    expect(esFechaEntregaValida(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(esFechaEntregaValida(undefined)).toBe(false)
  })

  it('returns false for a Sunday (getDay() === 0)', () => {
    // June 29, 2025 is a Sunday
    const sunday = new Date(2025, 5, 29) // month 5 = June (0-indexed)
    expect(sunday.getDay()).toBe(0) // sanity guard
    expect(esFechaEntregaValida(sunday)).toBe(false)
  })

  it('returns true for a Monday', () => {
    // June 30, 2025 is a Monday
    const monday = new Date(2025, 5, 30)
    expect(monday.getDay()).toBe(1) // sanity guard
    expect(esFechaEntregaValida(monday)).toBe(true)
  })

  it('returns true for a Saturday (only Sunday is blocked)', () => {
    // June 28, 2025 is a Saturday
    const saturday = new Date(2025, 5, 28)
    expect(saturday.getDay()).toBe(6) // sanity guard
    expect(esFechaEntregaValida(saturday)).toBe(true)
  })

  it('returns true for a mid-week date', () => {
    // June 25, 2025 is a Wednesday
    const wednesday = new Date(2025, 5, 25)
    expect(wednesday.getDay()).toBe(3) // sanity guard
    expect(esFechaEntregaValida(wednesday)).toBe(true)
  })
})

// ─── buildVentaPayload ───────────────────────────────────────────────────────

/**
 * Shared base form data for buildVentaPayload tests.
 * detalles: one item with explicit discount, one without (tests ?? 0 default).
 */
const BASE_FORM_DATA: VentaFormData = {
  clienteId: 'cliente-123',
  depositoId: 'deposito-456',
  tipoOperacion: 1,
  descuentoGeneral: 5,
  detalles: [
    { productoId: 'prod-1', cantidad: 2, descuentoPorcentaje: 10 },
    { productoId: 'prod-2', cantidad: 1 }, // no descuento — should default to 0
  ],
}

describe('buildVentaPayload', () => {
  describe('entregaInmediata = true (retiro en local / counter-sale)', () => {
    it('sets metodoEntrega to RetiroEnLocal and entregaInmediata to true', () => {
      const payload = buildVentaPayload(BASE_FORM_DATA, true)
      expect(payload.metodoEntrega).toBe(METODO_ENTREGA.RetiroEnLocal)
      expect(payload.entregaInmediata).toBe(true)
    })

    it('omits fechaEntrega even when a date is present in formData', () => {
      const formData: VentaFormData = {
        ...BASE_FORM_DATA,
        fechaEntrega: new Date(2025, 5, 30), // Monday — valid, but should be omitted
      }
      const payload = buildVentaPayload(formData, true)
      expect(payload.fechaEntrega).toBeUndefined()
    })

    it('copies scalar fields verbatim from formData', () => {
      const payload = buildVentaPayload(BASE_FORM_DATA, true)
      expect(payload.clienteId).toBe('cliente-123')
      expect(payload.depositoId).toBe('deposito-456')
      expect(payload.tipoOperacion).toBe(1)
      expect(payload.descuentoGeneral).toBe(5)
    })
  })

  describe('entregaInmediata = false, Logistica (date required)', () => {
    it('includes fechaEntrega as ISO 8601 datetime string when a date is provided', () => {
      const fecha = new Date(2025, 5, 30) // Monday June 30 — local time
      const formData: VentaFormData = { ...BASE_FORM_DATA, fechaEntrega: fecha }
      const payload = buildVentaPayload(formData, false, METODO_ENTREGA.Logistica)
      expect(payload.metodoEntrega).toBe(METODO_ENTREGA.Logistica)
      expect(payload.entregaInmediata).toBe(false)
      expect(payload.fechaEntrega).toBe(fecha.toISOString())
    })

    it('omits fechaEntrega when formData.fechaEntrega is null', () => {
      const formData: VentaFormData = { ...BASE_FORM_DATA, fechaEntrega: null }
      const payload = buildVentaPayload(formData, false, METODO_ENTREGA.Logistica)
      expect(payload.fechaEntrega).toBeUndefined()
    })

    it('defaults to Logistica when selectedMethod is omitted', () => {
      const formData: VentaFormData = {
        ...BASE_FORM_DATA,
        fechaEntrega: new Date(2025, 5, 30),
      }
      const payload = buildVentaPayload(formData, false)
      expect(payload.metodoEntrega).toBe(METODO_ENTREGA.Logistica)
    })
  })

  describe('entregaInmediata = false, RetiroEnLocal (date NOT required)', () => {
    it('omits fechaEntrega even when a date is provided', () => {
      const formData: VentaFormData = {
        ...BASE_FORM_DATA,
        fechaEntrega: new Date(2025, 5, 30),
      }
      const payload = buildVentaPayload(formData, false, METODO_ENTREGA.RetiroEnLocal)
      expect(payload.metodoEntrega).toBe(METODO_ENTREGA.RetiroEnLocal)
      expect(payload.fechaEntrega).toBeUndefined()
    })
  })

  describe('cargoFlete handling', () => {
    it('includes cargoFlete when strictly positive', () => {
      const formData: VentaFormData = { ...BASE_FORM_DATA, cargoFlete: 250 }
      const payload = buildVentaPayload(formData, false, METODO_ENTREGA.Expreso)
      expect(payload.cargoFlete).toBe(250)
    })

    it('omits cargoFlete when value is 0', () => {
      const formData: VentaFormData = { ...BASE_FORM_DATA, cargoFlete: 0 }
      const payload = buildVentaPayload(formData, false, METODO_ENTREGA.Logistica)
      expect(payload.cargoFlete).toBeUndefined()
    })

    it('omits cargoFlete when not provided in formData', () => {
      const payload = buildVentaPayload(BASE_FORM_DATA, false, METODO_ENTREGA.Logistica)
      expect(payload.cargoFlete).toBeUndefined()
    })
  })

  describe('items mapping', () => {
    it('maps all detail lines with correct shape', () => {
      const payload = buildVentaPayload(BASE_FORM_DATA, true)
      expect(payload.items).toHaveLength(2)
      expect(payload.items[0]).toEqual({ productoId: 'prod-1', cantidad: 2, descuentoPorcentaje: 10 })
      expect(payload.items[1]).toEqual({ productoId: 'prod-2', cantidad: 1, descuentoPorcentaje: 0 })
    })

    it('defaults descuentoPorcentaje to 0 when absent in a detail', () => {
      const payload = buildVentaPayload(BASE_FORM_DATA, true)
      expect(payload.items[1].descuentoPorcentaje).toBe(0)
    })

    it('preserves explicit descuentoPorcentaje from a detail', () => {
      const payload = buildVentaPayload(BASE_FORM_DATA, true)
      expect(payload.items[0].descuentoPorcentaje).toBe(10)
    })
  })

  describe('exact full payload shape (contract test)', () => {
    it('Expreso with date and positive flete produces the complete expected payload', () => {
      // Use a UTC-pinned date so toISOString() is deterministic across timezones
      const fecha = new Date('2025-06-30T12:00:00.000Z')
      const formData: VentaFormData = {
        clienteId: 'c1',
        depositoId: 'd1',
        tipoOperacion: 2,
        descuentoGeneral: 0,
        cargoFlete: 500,
        fechaEntrega: fecha,
        detalles: [{ productoId: 'p1', cantidad: 3, descuentoPorcentaje: 0 }],
      }
      const payload = buildVentaPayload(formData, false, METODO_ENTREGA.Expreso)
      expect(payload).toEqual({
        clienteId: 'c1',
        depositoId: 'd1',
        tipoOperacion: 2,
        descuentoGeneral: 0,
        metodoEntrega: METODO_ENTREGA.Expreso,
        entregaInmediata: false,
        fechaEntrega: '2025-06-30T12:00:00.000Z',
        cargoFlete: 500,
        items: [{ productoId: 'p1', cantidad: 3, descuentoPorcentaje: 0 }],
      })
    })

    it('RetiroEnLocal counter-sale with no optional fields produces minimal payload', () => {
      const formData: VentaFormData = {
        clienteId: 'c2',
        depositoId: 'd2',
        tipoOperacion: 1,
        descuentoGeneral: 0,
        detalles: [{ productoId: 'p2', cantidad: 1 }],
      }
      const payload = buildVentaPayload(formData, true)
      expect(payload).toEqual({
        clienteId: 'c2',
        depositoId: 'd2',
        tipoOperacion: 1,
        descuentoGeneral: 0,
        metodoEntrega: METODO_ENTREGA.RetiroEnLocal,
        entregaInmediata: true,
        items: [{ productoId: 'p2', cantidad: 1, descuentoPorcentaje: 0 }],
      })
    })
  })
})
