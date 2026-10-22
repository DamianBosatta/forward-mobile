import { screen, userEvent } from '@testing-library/react-native'

/** Cambia el descuento general por la hoja "Descuento a toda la venta" (R6): "Otro", el porcentaje y "Aplicar". */
export async function aplicarDescuentoGeneral(pct: number) {
  await userEvent.press(screen.getByRole('button', { name: 'Descuento a toda la venta' }))
  await userEvent.press(screen.getByRole('button', { name: 'Otro porcentaje' }))
  const campo = screen.getByLabelText('Descuento general (%)')
  await userEvent.clear(campo)
  await userEvent.type(campo, String(pct))
  await userEvent.press(screen.getByRole('button', { name: 'Aplicar' }))
}
