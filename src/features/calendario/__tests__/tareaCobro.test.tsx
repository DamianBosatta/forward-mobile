import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent } from '@testing-library/react-native'
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
const COBRO = {
  ...base, clave: `evento:${ID}:2026-10-09`, titulo: 'Cobrar a Don Pepe', monto: 85000, tipoTarea: 'CobroPendiente', estadoTarea: 'Pendiente',
  depositoNombre: 'Depósito Norte', asignados: [{ id: 'u1', nombre: 'Vendedor Uno' }], socioNombre: 'Don Pepe',
}
const REUNION = { ...base, origenId: '22222222-2222-2222-2222-222222222222', clave: 'evento:22:2026-10-09', titulo: 'Rendir la caja' }
const DETALLE_COBRO = {
  id: ID, tipo: 'Manual', titulo: 'Cobrar a Don Pepe', fechaInicio: '2026-10-09', socioComercialId: SOCIO, avisarDiasAntes: 1, visibilidad: 'Personal', ocurrencias: [],
}
const conPermisos = (modulos: string[]) =>
  useAuthStore.setState({
    user: { id: 'u1', username: 'v', email: 'v@x.com', roles: ['Empleado'], permissions: modulos.map((module) => ({ module, canRead: true, canCreate: true })) } as never,
  })

let eventos: unknown[] = []
const mockCobrar = jest.fn()
function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}><CalendarioScreen onCobrar={mockCobrar} /></QueryClientProvider>)
}

describe.each(TEMAS)('Tareas de cobro en el calendario (%s)', (tema) => {
  describe.each([['teléfono', 390], ['tablet', 820]])('%s', (_n, w) => {
    beforeEach(() => {
      jest.clearAllMocks()
      conTema(tema)
      mockAncho = w as number
      jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-09T15:00:00Z'))
      eventos = [COBRO, REUNION]
      mockGet.mockImplementation((url: string) => Promise.resolve(url.startsWith('/api/v1/Calendario/eventos/') ? DETALLE_COBRO : eventos))
      conPermisos(['MOD_PAGOS'])
    })
    afterEach(() => jest.restoreAllMocks())

    it('la tarjeta muestra el depósito de la tarea y "Empresa" cuando no tiene', async () => {
      pintar()
      expect(await screen.findByText('Depósito Norte')).toBeTruthy()
      expect(screen.getByText('Empresa')).toBeTruthy()
      expect(screen.getByText('Cobro pendiente')).toBeTruthy()
    })

    it('la hoja de la tarea dice quién la ve (no "Lo ves solo vos."), muestra cliente y asignados y no se edita', async () => {
      pintar()
      await userEvent.press(await screen.findByLabelText('Cobrar a Don Pepe, Pendiente'))
      expect(await screen.findByText('Cliente: Don Pepe')).toBeTruthy()
      expect(screen.getByText('Asignada a Vendedor Uno')).toBeTruthy()
      expect(screen.getByText('La ven quienes la tienen asignada y Administración.')).toBeTruthy()
      expect(screen.queryByText('Lo ves solo vos.')).toBeNull()
      expect(screen.queryByLabelText('Título')).toBeNull()
      expect(screen.queryByLabelText('Borrar evento')).toBeNull()
    })

    it('con MOD_PAGOS ofrece Cobrar y abre el flujo de cobro con el cliente del detalle; no manda nada al servidor', async () => {
      pintar()
      await userEvent.press(await screen.findByLabelText('Cobrar a Don Pepe, Pendiente'))
      await userEvent.press(await screen.findByLabelText('Cobrar'))
      expect(mockCobrar).toHaveBeenCalledWith(SOCIO)
      expect(mockPost).not.toHaveBeenCalled()
    })

    it('sin MOD_PAGOS ve la tarea y ningún botón de cobrar (L7)', async () => {
      conPermisos(['MOD_VENTAS'])
      pintar()
      await userEvent.press(await screen.findByLabelText('Cobrar a Don Pepe, Pendiente'))
      expect(await screen.findByText('Asignada a Vendedor Uno')).toBeTruthy()
      expect(screen.queryByLabelText('Cobrar')).toBeNull()
    })

    it('una tarea de cobro ya hecha no ofrece cobrar', async () => {
      eventos = [{ ...COBRO, estadoTarea: 'Hecha' }]
      pintar()
      // La tarea muestra su propio estado, como la web (resumen-evento.ts).
      await userEvent.press(await screen.findByLabelText('Cobrar a Don Pepe, Hecha'))
      expect(await screen.findByText('Asignada a Vendedor Uno')).toBeTruthy()
      expect(screen.queryByLabelText('Cobrar')).toBeNull()
    })

    it('sigue valiendo: un evento manual de siempre se edita y dice "Lo ves solo vos."', async () => {
      mockGet.mockImplementation((url: string) => Promise.resolve(url.startsWith('/api/v1/Calendario/eventos/')
        ? { ...DETALLE_COBRO, id: REUNION.origenId, titulo: 'Rendir la caja', socioComercialId: null } : eventos))
      pintar()
      await userEvent.press(await screen.findByLabelText('Rendir la caja, Pendiente'))
      expect(await screen.findByLabelText('Título')).toBeTruthy()
      expect(screen.getByText('Lo ves solo vos.')).toBeTruthy()
      expect(screen.queryByLabelText('Cobrar')).toBeNull()
    })
  })
})
