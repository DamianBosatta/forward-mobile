import { screen, userEvent } from '@testing-library/react-native'

/** "Confirmar entrega" abre la hoja "¿Cerrás la entrega?"; "Sí, confirmar" es lo que manda (S19). */
export async function confirmarEntrega() {
  await userEvent.press(screen.getByLabelText('Cerrar entrega'))
  await userEvent.press(await screen.findByLabelText('Sí, cerrar'))
}

export const REMITO_URL = 'https://r2.test/entregas/remito.jpg'

/** Sin cobro de dinero el remito firmado con su foto es obligatorio (dueño 08-11): acepta la subida sin pisar el resto del mock. */
export function conSubidaDeFotos(mockPost: jest.Mock) {
  const base = mockPost.getMockImplementation()
  mockPost.mockImplementation(async (url: string, body?: unknown) => (url === '/api/v1/Media/upload-entrega' ? { url: REMITO_URL } : base ? base(url, body) : undefined))
}

/** "Firmar" en el paso 4: abre la cámara directo y saca la foto del remito firmado (S8). */
export async function fotoDelRemito() {
  await userEvent.press(screen.getByLabelText('Firmar'))
  await userEvent.press(await screen.findByLabelText('Sacar la foto'))
  await screen.findByText('Remito firmado')
}

/** "¿Sumar otro cobro?" aparece al seguir del cobro cuando ya se cargó algo; "No" sigue a cerrar la entrega. */
export async function noSumarOtroCobro() {
  await userEvent.press(await screen.findByLabelText('No'))
}
