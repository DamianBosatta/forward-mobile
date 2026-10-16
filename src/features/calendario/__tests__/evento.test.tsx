import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { CalendarioScreen } from '../CalendarioScreen'
import { calendarioKeys } from '@/libs/api-client/calendario'

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
const mockAbrirVenta = jest.fn()
function pintar(antes?: (qc: QueryClient) => void) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  antes?.(qc)
  render(<QueryClientProvider client={qc}><CalendarioScreen onAbrirVenta={mockAbrirVenta} /></QueryClientProvider>)
  return qc
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

async function abrir(etiqueta: string, antes?: (qc: QueryClient) => void) {
  const qc = pintar(antes)
  await userEvent.press(await screen.findByLabelText(etiqueta))
  return qc
}
const urlsDelDetalle = () => mockGet.mock.calls.map(([u]) => String(u)).filter((u) => u.includes('/eventos/'))

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
    await waitFor(() => expect(screen.queryByLabelText('Sí, borrar') === null).toBe(true))
  })

  it('marca pagada la ocurrencia por su fecha ORIGINAL, aunque se haya movido de día', async () => {
    eventos = [LUZ]
    detalle = { ...DETALLE, tipo: 'ServicioRecurrente', fechaInicio: '2026-09-09', recurrencia: { frecuencia: 'Mensual', intervalo: 1 } }
    pintar()
    await userEvent.press(await screen.findByLabelText('jue 8, 1 evento'))
    await userEvent.press(screen.getByLabelText('Pagar la luz, Vencido'))
    expect(await screen.findByText('Se repite: cambiar el primer día mueve toda la serie.')).toBeTruthy()
    expect(screen.getByText('Reprogramado: el original era el viernes 9 de octubre.')).toBeTruthy()
    // Es financiero: se paga (un recordatorio, en cambio, se marca hecho).
    expect(screen.queryByLabelText('Desmarcar pagado')).toBeNull()
    await userEvent.press(screen.getByLabelText('Marcar pagado'))
    expect(mockPost).toHaveBeenCalledWith(`/api/v1/Calendario/eventos/${ID}/ocurrencias/2026-10-09`, { estado: 'Pagado' })
  })

  it('un recordatorio hecho (Pagado, no financiero) dice "Hecho" y se desmarca con DELETE de la marca', async () => {
    eventos = [{ ...CAJA, estado: 'Pagado' }]
    detalle = { ...DETALLE, ocurrencias: [{ fecha: '2026-10-09', estado: 'Pagado' }] }
    await abrir('Rendir la caja, Hecho')
    expect(await screen.findByLabelText('Desmarcar hecho')).toBeTruthy()
    expect(screen.queryByLabelText('Marcar hecho')).toBeNull()
    expect(screen.queryByLabelText('Desmarcar pagado')).toBeNull()
    await userEvent.press(screen.getByLabelText('Desmarcar hecho'))
    expect(mockDelete).toHaveBeenCalledWith(`/api/v1/Calendario/eventos/${ID}/ocurrencias/2026-10-09`)
  })

  it('un recordatorio pendiente se marca hecho: manda estado Pagado', async () => {
    await abrir('Rendir la caja, Pendiente')
    await userEvent.press(await screen.findByLabelText('Marcar hecho'))
    expect(mockPost).toHaveBeenCalledWith(`/api/v1/Calendario/eventos/${ID}/ocurrencias/2026-10-09`, { estado: 'Pagado' })
  })

  it('borrar cierra la hoja sin volver a pedir el evento borrado (que ya da 404), lo saca de la semana y olvida su detalle', async () => {
    mockDelete.mockImplementation(() => {
      // Después de borrar: el detalle da 404 y la semana nueva tarda en llegar.
      mockGet.mockImplementation((url: string) => url.includes('/eventos/')
        ? Promise.reject(Object.assign(new Error('No encontrado.'), { status: 404, errors: [] }))
        : new Promise(() => {}))
      return Promise.resolve(ID)
    })
    const qc = await abrir('Rendir la caja, Pendiente')
    await userEvent.press(await screen.findByLabelText('Borrar evento'))
    await userEvent.press(screen.getByLabelText('Sí, borrar'))
    await waitFor(() => expect(screen.queryByLabelText('Sí, borrar') === null).toBe(true))
    expect(screen.queryByText('No se pudo cargar el evento.')).toBeNull()
    expect(urlsDelDetalle()).toHaveLength(1)
    // La tarjeta se va sin esperar el refetch: no se puede volver a abrir un evento que ya no existe.
    await waitFor(() => expect(screen.queryByLabelText('Rendir la caja, Pendiente') === null).toBe(true))
    expect(screen.getByLabelText('Cheque de Del Sur, Vencido')).toBeTruthy()
    await waitFor(() => expect(qc.getQueryCache().find({ queryKey: calendarioKeys.evento(ID), exact: true })).toBeUndefined())
  })

  it('si el detalle guardado no se puede refrescar, muestra el error y no arma el formulario con lo viejo', async () => {
    mockGet.mockImplementation((url: string) => url.includes('/eventos/')
      ? Promise.reject(Object.assign(new Error('Se cortó la conexión.'), { errors: [] }))
      : Promise.resolve(eventos))
    await abrir('Rendir la caja, Pendiente', (qc) => qc.setQueryData(calendarioKeys.evento(ID), { ...DETALLE, titulo: 'Versión vieja' }))
    expect(await screen.findByText('Se cortó la conexión.')).toBeTruthy()
    expect(screen.queryByLabelText('Título')).toBeNull()
    expect(screen.getByText('Cerrar')).toBeTruthy()
  })

  it('"Hecho" o "Pagado" sale del tipo: un servicio personal se paga y un recordatorio de Administración se hace', async () => {
    eventos = [
      evento({ clave: `evento:${ID}:2026-10-09`, fecha: '2026-10-09', titulo: 'Pagar el gas', tipo: 'ServicioRecurrente', esFinanciero: false, estado: 'Pagado' }),
      { ...CAJA, esFinanciero: true },
    ]
    await abrir('Pagar el gas, Pagado')
    expect(await screen.findByLabelText('Desmarcar pagado')).toBeTruthy()
    await userEvent.press(screen.getByLabelText('Cerrar', { includeHiddenElements: true }))
    await userEvent.press(screen.getByLabelText('Rendir la caja, Pendiente'))
    expect(await screen.findByLabelText('Marcar hecho')).toBeTruthy()
    expect(screen.queryByLabelText('Marcar pagado')).toBeNull()
  })

  it('si el evento se vuelve a pedir (vuelve la red), lo que se estaba escribiendo no se pierde', async () => {
    const qc = await abrir('Rendir la caja, Pendiente')
    await userEvent.type(await screen.findByLabelText('Título'), ' chica')
    // El GET nuevo tarda: mientras, el formulario sigue a la vista con lo escrito.
    let soltar: (v: unknown) => void = () => {}
    mockGet.mockImplementation((url: string) => url.includes('/eventos/')
      ? new Promise((r) => { soltar = r })
      : Promise.resolve(eventos))
    await act(async () => {
      void qc.invalidateQueries()
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(screen.getByLabelText('Título').props.value).toBe('Rendir la caja chica')
    await act(async () => { soltar({ ...DETALLE, titulo: 'Otro título' }) })
    expect(urlsDelDetalle().length).toBeGreaterThan(1)
    expect(screen.getByLabelText('Título').props.value).toBe('Rendir la caja chica')
  })

  it('mover el día de un evento con marcas pide confirmación: las marcas que quedan fuera se pierden', async () => {
    eventos = [{ ...CAJA, estado: 'Pagado' }]
    detalle = { ...DETALLE, ocurrencias: [{ fecha: '2026-10-09', estado: 'Pagado' }] }
    await abrir('Rendir la caja, Hecho')
    await userEvent.press(await screen.findByLabelText('Día siguiente'))
    await userEvent.press(screen.getByLabelText('Guardar cambios'))
    expect(screen.getByText('Se pierde su marca (pagada u omitida).')).toBeTruthy()
    // Sin título no se puede confirmar.
    await userEvent.clear(screen.getByLabelText('Título'))
    expect(screen.getByLabelText('Sí, guardar').props.accessibilityState.disabled).toBe(true)
    await userEvent.type(screen.getByLabelText('Título'), 'Rendir la caja')
    await userEvent.press(screen.getByLabelText('No guardar'))
    expect(mockPut).not.toHaveBeenCalled()
    await userEvent.press(screen.getByLabelText('Guardar cambios'))
    await userEvent.press(screen.getByLabelText('Sí, guardar'))
    expect(mockPut).toHaveBeenCalledWith(`/api/v1/Calendario/eventos/${ID}`, expect.objectContaining({ fechaInicio: '2026-10-10' }))
  })

  it('en un evento que se repite, avisa que solo se pierden las marcas que queden fuera de la serie', async () => {
    eventos = [LUZ]
    detalle = { ...DETALLE, tipo: 'ServicioRecurrente', fechaInicio: '2026-09-09', recurrencia: { frecuencia: 'Mensual', intervalo: 1 },
      ocurrencias: [{ fecha: '2026-09-09', estado: 'Pagado' }, { fecha: '2026-10-09', estado: 'Omitido', fechaReprogramada: '2026-10-08' }] }
    pintar()
    await userEvent.press(await screen.findByLabelText('jue 8, 1 evento'))
    await userEvent.press(screen.getByLabelText('Pagar la luz, Vencido'))
    await userEvent.press(await screen.findByLabelText('Día siguiente'))
    await userEvent.press(screen.getByLabelText('Guardar cambios'))
    expect(screen.getByText('Tiene 2 marcas (pagadas u omitidas). Al cambiar el primer día se pierden las que ya no caigan en la serie.')).toBeTruthy()
    expect(mockPut).not.toHaveBeenCalled()
  })

  it('un evento automático (cheque) se ve sin editar, borrar ni marcar, y no pide el detalle', async () => {
    await abrir('Cheque de Del Sur, Vencido')
    expect(await screen.findByText('Es automático: sale de cheques y compras, y no se cambia desde acá.')).toBeTruthy()
    for (const accion of ['Guardar cambios', 'Borrar evento', 'Marcar pagado', 'Desmarcar pagado', 'Marcar hecho']) {
      expect(screen.queryByLabelText(accion)).toBeNull()
    }
    expect(urlsDelDetalle()).toEqual([])
  })

  it('si el servidor rechaza el cambio, el motivo queda a la vista y la hoja sigue abierta', async () => {
    mockPut.mockRejectedValue(Object.assign(new Error('El título del evento es requerido.'), { errors: [] }))
    await abrir('Rendir la caja, Pendiente')
    await userEvent.press(await screen.findByLabelText('Guardar cambios'))
    expect(await screen.findByText('El título del evento es requerido.')).toBeTruthy()
    expect(screen.getByLabelText('Borrar evento')).toBeTruthy()
  })

  it('un evento agendado desde una venta la nombra y vuelve a ella', async () => {
    eventos = [{ ...CAJA, hora: '18:15', ventaId: 'venta-341', ventaCodigo: 'A00341' }]
    detalle = { ...DETALLE, hora: '18:15', ventaId: 'venta-341', ventaCodigo: 'A00341' }
    await abrir('Rendir la caja, Pendiente')

    await userEvent.press(await screen.findByLabelText('Agendado desde la venta A00341'))

    expect(mockAbrirVenta).toHaveBeenCalledWith('venta-341')
  })

  it('cambiar la hora la manda; dejarla como estaba no la toca, y vacía la quita', async () => {
    detalle = { ...DETALLE, hora: '18:15' }
    await abrir('Rendir la caja, Pendiente')
    const campo = await screen.findByLabelText('Hora (opcional)')
    expect(campo.props.value).toBe('18:15')

    await userEvent.clear(campo)
    await userEvent.press(screen.getByLabelText('Guardar cambios'))

    expect(mockPut.mock.calls[0][1]).toEqual(expect.objectContaining({ hora: '' }))
  })
})
