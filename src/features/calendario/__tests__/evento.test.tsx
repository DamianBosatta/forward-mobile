import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { CalendarioScreen } from '../CalendarioScreen'

const mockGet = jest.fn()
const mockPost = jest.fn()
const mockPut = jest.fn()
const mockDelete = jest.fn()
jest.mock('@/core/api/client', () => ({
  API_URL: 'http://api.test',
  api: {
    get: (url: string) => mockGet(url),
    post: (url: string, body?: unknown) => mockPost(url, body),
    put: (url: string, body?: unknown) => mockPut(url, body),
    delete: (url: string) => mockDelete(url),
  },
}))
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  DrawerActions: { openDrawer: jest.fn() },
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}))

const ID = '11111111-1111-1111-1111-111111111111'
const evento = (o: Record<string, unknown>) => ({
  origenId: ID, origen: 'Manual', tipo: 'Manual', estado: 'Pendiente', esFinanciero: false, ...o,
})
// "Pagar la luz" es mensual (empezó el 9 de septiembre); la de octubre se reprogramó del 9 al 8.
const LUZ = evento({ clave: `evento:${ID}:2026-10-09`, fecha: '2026-10-08', titulo: 'Pagar la luz', estado: 'Vencido', tipo: 'ServicioRecurrente', esFinanciero: true, monto: 18000 })
const CAJA = evento({ clave: `evento:${ID}:2026-10-09`, fecha: '2026-10-09', titulo: 'Rendir la caja', descripcion: 'Antes de las 18' })
const CHEQUE = evento({ clave: 'cheque:x', origenId: '22222222-2222-2222-2222-222222222222', origen: 'Automatico', tipo: 'ChequeRecibido', fecha: '2026-10-09', titulo: 'Cheque de Del Sur', estado: 'Vencido' })
const DETALLE = {
  id: ID, tipo: 'Manual', subtipo: null, titulo: 'Rendir la caja', descripcion: 'Antes de las 18', fechaInicio: '2026-10-09',
  recurrencia: null, montoEstimado: null, socioComercialId: null, avisarDiasAntes: 1, visibilidad: 'Personal', ocurrencias: [],
}

let eventos: unknown[] = []
let detalle: Record<string, unknown> = DETALLE
function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><CalendarioScreen /></QueryClientProvider>)
}

beforeEach(() => {
  jest.clearAllMocks()
  // Viernes 9 de octubre, mediodía en Argentina.
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-09T15:00:00Z'))
  eventos = [CAJA, CHEQUE]
  detalle = DETALLE
  mockGet.mockImplementation((url: string) =>
    Promise.resolve(url.startsWith('/api/v1/Calendario/eventos/') ? detalle : eventos))
  for (const m of [mockPost, mockPut, mockDelete]) m.mockResolvedValue(ID)
})
afterEach(() => jest.restoreAllMocks())

async function abrir(etiqueta: string) {
  pintar()
  await userEvent.press(await screen.findByLabelText(etiqueta))
}

describe('Detalle de un evento del calendario', () => {
  it('edita título, descripción y día, y manda el resto del evento como estaba', async () => {
    detalle = { ...DETALLE, subtipo: 'Caja', montoEstimado: 500, avisarDiasAntes: 3, socioComercialId: '33333333-3333-3333-3333-333333333333' }
    await abrir('Rendir la caja, Pendiente')
    const titulo = await screen.findByLabelText('Título')
    expect(titulo.props.value).toBe('Rendir la caja')
    await userEvent.clear(titulo)
    await userEvent.type(titulo, 'Rendir la caja chica')
    await userEvent.clear(screen.getByLabelText('Descripción (opcional)'))
    await userEvent.press(screen.getByLabelText('Día siguiente'))
    expect(screen.getByText('Sábado 10 de octubre')).toBeTruthy()
    await userEvent.press(screen.getByLabelText('Guardar cambios'))
    expect(mockPut).toHaveBeenCalledWith(`/api/v1/Calendario/eventos/${ID}`, {
      tipo: 'Manual', subtipo: 'Caja', titulo: 'Rendir la caja chica', descripcion: null, fechaInicio: '2026-10-10',
      recurrencia: undefined, montoEstimado: 500, socioComercialId: '33333333-3333-3333-3333-333333333333', avisarDiasAntes: 3,
    })
    // Se cierra y queda a la vista el día nuevo del evento.
    expect(await screen.findByText('Sábado 10')).toBeTruthy()
  })

  it('borrar pide confirmación dentro de la hoja; recién al confirmar manda el DELETE', async () => {
    await abrir('Rendir la caja, Pendiente')
    await userEvent.press(await screen.findByLabelText('Borrar evento'))
    expect(screen.getByText('Se borra el evento y todas sus fechas. No se puede deshacer.')).toBeTruthy()
    await userEvent.press(screen.getByLabelText('No borrar'))
    expect(mockDelete).not.toHaveBeenCalled()
    await userEvent.press(screen.getByLabelText('Borrar evento'))
    await userEvent.press(screen.getByLabelText('Sí, borrar'))
    expect(mockDelete).toHaveBeenCalledWith(`/api/v1/Calendario/eventos/${ID}`)
    await waitFor(() => expect(screen.queryByLabelText('Sí, borrar')).toBeNull())
  })

  it('marca pagada la ocurrencia por su fecha ORIGINAL, aunque se haya movido de día', async () => {
    eventos = [LUZ]
    detalle = { ...DETALLE, tipo: 'ServicioRecurrente', fechaInicio: '2026-09-09', recurrencia: { frecuencia: 'Mensual', intervalo: 1 } }
    pintar()
    await userEvent.press(await screen.findByLabelText('jue 8, 1 evento'))
    await userEvent.press(screen.getByLabelText('Pagar la luz, Vencido'))
    expect(await screen.findByText('Se repite: cambiar el primer día mueve toda la serie.')).toBeTruthy()
    expect(screen.queryByLabelText('Desmarcar pagado')).toBeNull()
    await userEvent.press(screen.getByLabelText('Marcar pagado'))
    expect(mockPost).toHaveBeenCalledWith(`/api/v1/Calendario/eventos/${ID}/ocurrencias/2026-10-09`, { estado: 'Pagado' })
  })

  it('una ocurrencia pagada se desmarca (DELETE de la marca) y no ofrece marcarla otra vez', async () => {
    eventos = [{ ...CAJA, estado: 'Pagado' }]
    detalle = { ...DETALLE, ocurrencias: [{ fecha: '2026-10-09', estado: 'Pagado' }] }
    await abrir('Rendir la caja, Pagado')
    await userEvent.press(await screen.findByLabelText('Desmarcar pagado'))
    expect(screen.queryByLabelText('Marcar pagado')).toBeNull()
    expect(mockDelete).toHaveBeenCalledWith(`/api/v1/Calendario/eventos/${ID}/ocurrencias/2026-10-09`)
  })

  it('un evento automático (cheque) se ve sin editar, borrar ni marcar, y no pide el detalle', async () => {
    await abrir('Cheque de Del Sur, Vencido')
    expect(await screen.findByText('Es automático: sale de cheques y compras, y no se cambia desde acá.')).toBeTruthy()
    for (const accion of ['Guardar cambios', 'Borrar evento', 'Marcar pagado', 'Desmarcar pagado']) {
      expect(screen.queryByLabelText(accion)).toBeNull()
    }
    expect(mockGet.mock.calls.map(([u]) => String(u)).filter((u) => u.includes('/eventos/'))).toEqual([])
  })

  it('si el servidor rechaza el cambio, el motivo queda a la vista y la hoja sigue abierta', async () => {
    mockPut.mockRejectedValue(Object.assign(new Error('El título del evento es requerido.'), { errors: [] }))
    await abrir('Rendir la caja, Pendiente')
    await userEvent.press(await screen.findByLabelText('Guardar cambios'))
    expect(await screen.findByText('El título del evento es requerido.')).toBeTruthy()
    expect(screen.getByLabelText('Borrar evento')).toBeTruthy()
  })
})
