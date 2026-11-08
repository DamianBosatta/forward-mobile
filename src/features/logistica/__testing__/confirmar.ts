import { screen, userEvent } from '@testing-library/react-native'

/** "Confirmar entrega" abre la hoja "¿Confirmás la entrega?"; "Sí, confirmar" es lo que manda (S19). */
export async function confirmarEntrega() {
  await userEvent.press(screen.getByLabelText('Confirmar entrega'))
  await userEvent.press(await screen.findByLabelText('Sí, confirmar'))
}

export const REMITO_URL = 'https://r2.test/entregas/remito.jpg'

/** Sin cobro de dinero el remito firmado con su foto es obligatorio (dueño 08-11): acepta la subida sin pisar el resto del mock. */
export function conSubidaDeFotos(mockPost: jest.Mock) {
  const base = mockPost.getMockImplementation()
  mockPost.mockImplementation(async (url: string, body?: unknown) => (url === '/api/v1/Media/upload-entrega' ? { url: REMITO_URL } : base ? base(url, body) : undefined))
}

/** Saca la foto del remito firmado en el paso Confirmar. */
export async function fotoDelRemito() {
  await userEvent.press(screen.getByLabelText('Sacar foto del remito firmado'))
  await userEvent.press(await screen.findByLabelText('Sacar la foto'))
  await screen.findByText('Foto del remito firmado cargada')
}

/** "¿Sumar otro cobro?" aparece al seguir del cobro cuando ya se cargó algo; "No" sigue a Confirmar. */
export async function noSumarOtroCobro() {
  await userEvent.press(await screen.findByLabelText('No'))
}
