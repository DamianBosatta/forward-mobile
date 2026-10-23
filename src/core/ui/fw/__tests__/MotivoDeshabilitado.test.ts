/**
 * Los motivos de un botón deshabilitado dicen lo mismo que la web (L13: "reglas de la web igual en
 * mobile siempre"): cobro-pago-panel.tsx y movimiento-interno-tab.tsx de finanzas.
 */
import { MOTIVO_SIN_PERMISO_DE_COBRO, MOTIVO_SIN_PERMISO_DE_TRANSFERENCIA } from '../MotivoDeshabilitado'

describe('motivos sin permiso', () => {
  it('registrar cobro: el texto de la web', () => {
    expect(MOTIVO_SIN_PERMISO_DE_COBRO).toBe(
      'No tenés permiso para registrar cobros ni pagos. Pedile a un administrador que te asigne el permiso de alta en el módulo Pagos.',
    )
  })

  it('transferencia entre cuentas: el texto de la web', () => {
    expect(MOTIVO_SIN_PERMISO_DE_TRANSFERENCIA).toBe(
      'No tenés permiso para registrar movimientos entre cuentas. Pedile a un administrador que te asigne el permiso de alta en el módulo Pagos.',
    )
  })
})
