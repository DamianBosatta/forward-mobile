import { screen, userEvent } from '@testing-library/react-native'

/** "Confirmar entrega" abre la hoja "¿Confirmás la entrega?"; "Sí, confirmar" es lo que manda (S19). */
export async function confirmarEntrega() {
  await userEvent.press(screen.getByLabelText('Confirmar entrega'))
  await userEvent.press(await screen.findByLabelText('Sí, confirmar'))
}
