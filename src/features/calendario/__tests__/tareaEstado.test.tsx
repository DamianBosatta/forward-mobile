import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { ApiError } from '@/core/api/client'
import { CalendarioScreen } from '../CalendarioScreen'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { conTema, TEMAS } from '@/core/ui/fw/__testing__/tema'

const mockGet = jest.fn()
const mockPost = jest.fn()
let mockAncho = 390
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/libs/useResponsive', () => ({
  useResponsive: () => ({ width: mockAncho, isTablet: mockAncho >= 768, isTabletLandscape: false }),
}))
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  API_URL: 'http://api.test',
  api: { get: (url: string) => mockGet(url), post: (url: string, b?: unknown) => mockPost(url, b), put: jest.fn(), delete: jest.fn() },
}))
jest.mock('expo-router/react-navigation', () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  DrawerActions: { openDrawer: jest.fn() },
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}))

const ID = '11111111-1111-1111-1111-111111111111'
const SOCIO = '99999999-9999-9999-9999-999999999999'
const base = { origenId: ID, origen: 'Manual', tipo: 'Manual', estado: 'Pendiente', esFinanciero: false, fecha: '2026-10-09' }
const TAREA = {
  ...base, clave: `evento:${ID}:2026-10-09`, titulo: 'Cobrar a Don Pepe', tipoTarea: 'CobroPendiente', estadoTarea: 'EnCurso',
  asignados: [{ id: 'u1', nombre: 'Vendedor Uno' }], socioNombre: 'Don Pepe',
}
const MANUAL = { ...base, origenId: '22222222-2222-2222-2222-222222222222', clave: 'evento:22:2026-10-09', titulo: 'Rendir la caja' }
const DETALLE = { id: ID, tipo: 'Manual', titulo: 'Cobrar a Don Pepe', fechaInicio: '2026-10-09', socioComercialId: SOCIO, avisarDiasAntes: 1, visibilidad: 'Personal', ocurrencias: [] }
const ESTADO_URL = `/api/v1/Calendario/eventos/${ID}/estado`
const permisos = (modulos: string[]) =>
  useAuthStore.setState({
    user: { id: 'u1', username: 'v', email: 'v@x.com', roles: ['Empleado'], permissions: modulos.map((module) => ({ module, canRead: true, canCreate: true })) } as never,
  })

let eventos: unknown[] = []
const listas = () => mockGet.mock.calls.filter(([u]) => String(u).startsWith('/api/v1/Calendario?')).length
function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}><CalendarioScreen onCobrar={jest.fn()} /></QueryClientProvider>)
}
const estadoBtn = (nombre: string) => screen.getByRole('radio', { name: nombre })

describe.each(TEMAS)('Estado de una tarea desde el teléfono (%s)', (tema) => {
  describe.each([['teléfono', 390], ['tablet', 820]])('%s', (_n, w) => {
    beforeEach(() => {
      jest.clearAllMocks()
      conTema(tema)
      mockAncho = w as number
      jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-09T15:00:00Z'))
      eventos = [TAREA, MANUAL]
      mockGet.mockImplementation((url: string) => Promise.resolve(url.startsWith('/api/v1/Calendario/eventos/') ? DETALLE : eventos))
      mockPost.mockResolvedValue(ID)
      permisos(['MOD_PAGOS'])
    })
    afterEach(() => jest.restoreAllMocks())

    const abrir = async () => { pintar(); await userEvent.press(await screen.findByLabelText('Cobrar a Don Pepe, Pendiente')) }

    it('ofrece los cuatro estados de la web, con el actual marcado', async () => {
      await abrir()
      for (const n of ['Pendiente', 'En curso', 'Hecha', 'Cancelada']) expect(await screen.findByRole('radio', { name: n })).toBeTruthy()
      expect(estadoBtn('En curso').props.accessibilityState).toMatchObject({ checked: true })
      expect(estadoBtn('Hecha').props.accessibilityState).toMatchObject({ checked: false })
    })

    it('"Hecha" manda POST /estado con el estado, vuelve a pedir el calendario y deja de ofrecer cobrar', async () => {
      await abrir()
      expect(await screen.findByLabelText('Cobrar')).toBeTruthy()
      const antes = listas()
      await userEvent.press(await screen.findByRole('radio', { name: 'Hecha' }))
      expect(mockPost).toHaveBeenCalledTimes(1)
      expect(mockPost).toHaveBeenCalledWith(ESTADO_URL, { estado: 'Hecha' })
      await waitFor(() => expect(estadoBtn('Hecha').props.accessibilityState).toMatchObject({ checked: true }))
      await waitFor(() => expect(listas()).toBeGreaterThan(antes))
      expect(screen.queryByLabelText('Cobrar')).toBeNull()
    })

    it('tocar el estado actual no manda nada', async () => {
      await abrir()
      await userEvent.press(await screen.findByRole('radio', { name: 'En curso' }))
      expect(mockPost).not.toHaveBeenCalled()
    })

    it('si el servidor lo rechaza muestra su mensaje y el estado no cambia', async () => {
      mockPost.mockRejectedValue(new ApiError(403, 'No tenés permiso para cambiar esta tarea.', [], 'TareaSinPermiso' as never))
      await abrir()
      await userEvent.press(await screen.findByRole('radio', { name: 'Cancelada' }))
      expect(await screen.findByText('No tenés permiso para cambiar esta tarea.')).toBeTruthy()
      expect(estadoBtn('En curso').props.accessibilityState).toMatchObject({ checked: true })
    })

    it('se ofrece igual sin MOD_PAGOS (la regla es del servidor, como en la web)', async () => {
      permisos(['MOD_VENTAS'])
      await abrir()
      expect(await screen.findByRole('radio', { name: 'Hecha' })).toBeTruthy()
      expect(screen.queryByLabelText('Cobrar')).toBeNull()
    })

    it('sigue valiendo: un evento manual que no es tarea no tiene estados de tarea', async () => {
      pintar()
      await userEvent.press(await screen.findByLabelText('Rendir la caja, Pendiente'))
      expect(await screen.findByLabelText('Título')).toBeTruthy()
      expect(screen.queryByRole('radio', { name: 'En curso' })).toBeNull()
    })
  })
})
