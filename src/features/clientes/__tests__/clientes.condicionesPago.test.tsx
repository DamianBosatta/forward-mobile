import React from 'react'
import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import ClienteFormScreen from '../../../../app/(tabs)/socios/nuevo'
import { api } from '@/core/api/client'
import { themeColors, useThemeStore } from '@/libs/theme'
import { clienteDeLista, conPermisos, renderConQuery } from '../__testing__/ayuda'

const mockReplace = jest.fn()
let mockId: string | undefined
let mockAncho = 390
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: mockReplace }),
  useLocalSearchParams: () => ({ id: mockId }),
}))
jest.mock('expo-router/react-navigation', () => ({
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}))
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => ({ width: mockAncho, height: 800, scale: 2, fontScale: 1 }) }))
jest.mock('@/core/api/client', () => ({ api: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn() }, API_URL: '' }))

type Permiso = { module: string; canRead: boolean; canCreate: boolean; canUpdate: boolean }
const get = api.get as jest.Mock
const post = api.post as jest.Mock
const put = api.put as jest.Mock
const patch = api.patch as jest.Mock
const CREA: Permiso[] = [{ module: 'MOD_CLIENTES', canRead: true, canCreate: true, canUpdate: true }]
const cap = (module: string): Permiso => ({ module, canRead: true, canCreate: false, canUpdate: false })
const AUTORIZA: Permiso[] = [...CREA, cap('CAP_AUTORIZAR_VENTA')]
const AVISO_SOLO_LECTURA = 'Solo las cambia quien puede autorizar ventas'

async function completarAlta() {
  fireEvent.changeText(screen.getByLabelText('Dirección de entrega'), 'Av. del Valle 89')
  fireEvent.changeText(screen.getByLabelText('Nombre del local'), 'Kiosco Chela')
  fireEvent.changeText(screen.getByLabelText('Contacto'), 'Chela')
  fireEvent.changeText(screen.getByLabelText('Teléfono'), '1146582291')
  fireEvent.changeText(screen.getByLabelText('CUIT'), '30-71234567-1')
}
const guardar = () => userEvent.press(screen.getByRole('button', { name: 'Guardar' }))
const cuerpo = () => post.mock.calls[0][1]

describe.each([['light', 390], ['dark', 390], ['light', 820], ['dark', 820]] as const)('condiciones de pago y paridad con la web, tema %s, ancho %s', (modo, ancho) => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockId = undefined
    mockAncho = ancho
    useThemeStore.setState({ mode: modo })
    post.mockResolvedValue('nuevo-id')
    put.mockResolvedValue(true)
    patch.mockResolvedValue(true)
    get.mockResolvedValue([])
    conPermisos(CREA)
  })
  afterAll(() => useThemeStore.setState({ mode: 'system' }))

  describe('alta: la lista de condiciones habilitadas', () => {
    it('quien puede crear la edita: nace con Contado como única y predeterminada, sin pedir autorización', () => {
      renderConQuery(<ClienteFormScreen />)
      expect(screen.getByRole('radio', { name: 'Contado, condición 1', checked: true })).toBeTruthy()
      expect(screen.getByRole('checkbox', { name: 'Predeterminada, condición 1', checked: true })).toBeTruthy()
      expect(screen.queryByText(AVISO_SOLO_LECTURA)).toBeNull()
    })

    it('avisa que lo que no es contado va a cuenta corriente y el chofer ve "NO COBRAR"', () => {
      renderConQuery(<ClienteFormScreen />)
      expect(screen.getByText(/en el manifiesto el chofer ve "NO COBRAR"/)).toBeTruthy()
    })

    it('hay exactamente una predeterminada: marcar otra desmarca la anterior y quitar la marcada pasa la marca', async () => {
      renderConQuery(<ClienteFormScreen />)
      await userEvent.press(screen.getByRole('button', { name: 'Agregar condición' }))
      await userEvent.press(screen.getByRole('radio', { name: 'Días desde la entrega, condición 2' }))
      fireEvent.changeText(screen.getByLabelText('Días (condición 2)'), '15')
      expect(screen.getByRole('checkbox', { name: 'Predeterminada, condición 1', checked: true })).toBeTruthy()
      expect(screen.getByRole('checkbox', { name: 'Predeterminada, condición 2', checked: false })).toBeTruthy()

      await userEvent.press(screen.getByRole('checkbox', { name: 'Predeterminada, condición 2' }))
      expect(screen.getByRole('checkbox', { name: 'Predeterminada, condición 1', checked: false })).toBeTruthy()
      expect(screen.getByRole('checkbox', { name: 'Predeterminada, condición 2', checked: true })).toBeTruthy()

      await userEvent.press(screen.getByRole('button', { name: 'Quitar condición 2' }))
      expect(screen.getByRole('checkbox', { name: 'Predeterminada, condición 1', checked: true })).toBeTruthy()
      expect(screen.queryByTestId('condicion-1')).toBeNull()
    })

    it('POST /socios manda la lista (una sola predeterminada) y no la condición suelta de antes', async () => {
      conPermisos(AUTORIZA)
      renderConQuery(<ClienteFormScreen />)
      await completarAlta()
      await userEvent.press(screen.getByRole('button', { name: 'Agregar condición' }))
      await userEvent.press(screen.getByRole('radio', { name: 'Días desde la factura, condición 2' }))
      fireEvent.changeText(screen.getByLabelText('Días (condición 2)'), '30')
      await userEvent.press(screen.getByRole('checkbox', { name: 'Predeterminada, condición 2' }))
      await guardar()

      await waitFor(() => expect(post).toHaveBeenCalled())
      expect(cuerpo().condicionesPagoCliente).toEqual([
        { tipo: 'Contado', predeterminada: false },
        { tipo: 'DiasDesdeFactura', dias: 30, predeterminada: true },
      ])
      expect(cuerpo().condicionPago).toBeUndefined()
    })

    it('una fila sin días, fuera de rango o repetida no se manda: se marca en la fila', async () => {
      renderConQuery(<ClienteFormScreen />)
      await completarAlta()
      await userEvent.press(screen.getByRole('button', { name: 'Agregar condición' }))
      await userEvent.press(screen.getByRole('radio', { name: 'Días desde la entrega, condición 2' }))
      await guardar()
      expect(await screen.findByText('Ingresá los días de plazo (entre 1 y 365)')).toBeTruthy()

      fireEvent.changeText(screen.getByLabelText('Días (condición 2)'), '366')
      await guardar()
      expect(screen.getByText('Ingresá los días de plazo (entre 1 y 365)')).toBeTruthy()

      await userEvent.press(screen.getByRole('radio', { name: 'Contado, condición 2' }))
      await guardar()
      expect(screen.getByText('Hay una condición de pago repetida')).toBeTruthy()
      expect(post).not.toHaveBeenCalled()
    })
  })

  describe('alta: lo mismo que pide la web', () => {
    it('un cliente nuevo sin los datos obligatorios ni CUIT no se manda y cada campo dice qué falta', async () => {
      renderConQuery(<ClienteFormScreen />)
      await guardar()

      expect(await screen.findByText('La dirección es obligatoria en clientes')).toBeTruthy()
      expect(screen.getByText('El nombre de fantasía es obligatorio en clientes')).toBeTruthy()
      expect(screen.getByText('El nombre de contacto es obligatorio en clientes')).toBeTruthy()
      expect(screen.getByText('El teléfono es obligatorio en clientes')).toBeTruthy()
      expect(screen.getByText('El CUIT es requerido')).toBeTruthy()
      expect(post).not.toHaveBeenCalled()
    })

    it('el alta provisoria se salta los obligatorios y el CUIT', async () => {
      renderConQuery(<ClienteFormScreen />)
      await userEvent.press(screen.getByRole('switch', { name: 'Alta provisoria' }))
      await guardar()
      await waitFor(() => expect(post).toHaveBeenCalled())
      expect(cuerpo().altaProvisoria).toBe(true)
    })

    it('un CUIT con el dígito verificador mal frena el guardado, también en una alta provisoria', async () => {
      renderConQuery(<ClienteFormScreen />)
      await userEvent.press(screen.getByRole('switch', { name: 'Alta provisoria' }))
      fireEvent.changeText(screen.getByLabelText('CUIT'), '30-71234567-9')
      await guardar()
      expect(await screen.findByText('Revisá los datos marcados en rojo.')).toBeTruthy()
      expect(post).not.toHaveBeenCalled()
    })

    it('un email mal formado frena el guardado y se marca en el campo', async () => {
      renderConQuery(<ClienteFormScreen />)
      await completarAlta()
      fireEvent.changeText(screen.getByLabelText('Email'), 'chela@')
      await guardar()
      expect(await screen.findByText('Email inválido')).toBeTruthy()
      expect(post).not.toHaveBeenCalled()
    })

    it('manda la localidad recortada', async () => {
      renderConQuery(<ClienteFormScreen />)
      await completarAlta()
      fireEvent.changeText(screen.getByLabelText('Localidad (para armar el recorrido)'), '  City Bell ')
      await guardar()
      await waitFor(() => expect(post).toHaveBeenCalled())
      expect(cuerpo().localidad).toBe('City Bell')
    })

    it('el horario tiene una sola etiqueta: "Horario de atención"', () => {
      renderConQuery(<ClienteFormScreen />)
      expect(screen.getByTestId('grupo-Horario de atención')).toBeTruthy()
      expect(screen.queryByTestId('grupo-Horario de entrega')).toBeNull()
    })

    it('el saldo inicial solo está con CAP_ADMINISTRAR_CUENTAS_CORRIENTES y viaja como número', async () => {
      renderConQuery(<ClienteFormScreen />)
      expect(screen.queryByLabelText('Saldo inicial')).toBeNull()
      screen.unmount()

      conPermisos([...CREA, cap('CAP_ADMINISTRAR_CUENTAS_CORRIENTES')])
      renderConQuery(<ClienteFormScreen />)
      await completarAlta()
      fireEvent.changeText(screen.getByLabelText('Saldo inicial'), '1.500,50')
      await guardar()
      await waitFor(() => expect(post).toHaveBeenCalled())
      expect(cuerpo().saldoInicial).toBe(1500.5)
    })

    it('sin la capacidad el saldo inicial viaja en 0 como antes', async () => {
      renderConQuery(<ClienteFormScreen />)
      await completarAlta()
      await guardar()
      await waitFor(() => expect(post).toHaveBeenCalled())
      expect(cuerpo().saldoInicial).toBe(0)
    })
  })

  describe('edición', () => {
    const detalle = (extra = {}) => ({
      ...clienteDeLista(), horario: [], condicionesDeCompraFaltantes: [], depositoIds: ['d1'], vendedorResponsableId: 'v1',
      condicionesPagoCliente: [{ tipo: 'Contado', predeterminada: true }, { tipo: 'DiasDesdeEntrega', dias: 15, predeterminada: false }],
      puedeEditarCondicionesPago: true, ...extra,
    })
    const abrir = async (extra = {}, permisos = CREA) => {
      mockId = 'c1'
      conPermisos(permisos)
      get.mockImplementation((url: string) => {
        if (url.includes('/Ventas/vendedores')) return Promise.resolve([{ id: 'v1', nombre: 'Ana Pérez' }, { id: 'v2', nombre: 'Beto Gómez' }])
        if (url.includes('/Depositos')) return Promise.resolve([{ id: 'd1', nombre: 'Central', activo: true }, { id: 'd2', nombre: 'Norte', activo: true }])
        return Promise.resolve(detalle(extra))
      })
      renderConQuery(<ClienteFormScreen />)
      await waitFor(() => expect(screen.getByLabelText('Nombre del local').props.value).toBe('Kiosco Chela'))
    }

    it('con puedeEditarCondicionesPago en falso se ven en solo lectura y no se mandan', async () => {
      await abrir({ puedeEditarCondicionesPago: false })
      expect(screen.getAllByText(AVISO_SOLO_LECTURA).length).toBeGreaterThan(0)
      expect(screen.queryByRole('button', { name: 'Agregar condición' })).toBeNull()
      await userEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }))
      await waitFor(() => expect(put).toHaveBeenCalled())
      expect(put.mock.calls[0][1].condicionesPagoCliente).toBeUndefined()
    })

    it('si la API lo permite se editan, pero sin cambios no se mandan', async () => {
      await abrir()
      expect(screen.getByRole('button', { name: 'Agregar condición' })).toBeTruthy()
      await userEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }))
      await waitFor(() => expect(put).toHaveBeenCalled())
      expect(put.mock.calls[0][1].condicionesPagoCliente).toBeUndefined()
    })

    it('con un cambio manda la lista completa', async () => {
      await abrir()
      fireEvent.changeText(screen.getByLabelText('Días (condición 2)'), '20')
      await userEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }))
      await waitFor(() => expect(put).toHaveBeenCalled())
      expect(put.mock.calls[0][1].condicionesPagoCliente).toEqual([
        { tipo: 'Contado', predeterminada: true },
        { tipo: 'DiasDesdeEntrega', dias: 20, predeterminada: false },
      ])
    })

    it('el vendedor responsable y los depósitos aparecen por capacidad, no por rol', async () => {
      await abrir()
      expect(screen.queryByText('Vendedor responsable')).toBeNull()
      expect(screen.queryByText('Depósitos')).toBeNull()
      screen.unmount()

      await abrir({}, [...CREA, cap('CAP_GESTIONAR_CARTERA_CLIENTES'), cap('CAP_VER_TODOS_LOS_DEPOSITOS')])
      expect(await screen.findByText('Vendedor responsable')).toBeTruthy()
      await userEvent.press(await screen.findByRole('radio', { name: 'Beto Gómez' }))
      await userEvent.press(screen.getByRole('button', { name: 'Guardar vendedor' }))
      await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/v1/socios-comerciales/c1/vendedor-responsable', { socioId: 'c1', vendedorResponsableId: 'v2' }))

      await userEvent.press(await screen.findByRole('checkbox', { name: 'Norte' }))
      await userEvent.press(screen.getByRole('button', { name: 'Guardar depósitos' }))
      await waitFor(() => expect(put).toHaveBeenCalledWith('/api/v1/socios-comerciales/c1/depositos', { socioId: 'c1', depositoIds: ['d1', 'd2'] }))
    })

    it('los depósitos piden al menos uno', async () => {
      await abrir({}, [...CREA, cap('CAP_VER_TODOS_LOS_DEPOSITOS')])
      await userEvent.press(await screen.findByRole('checkbox', { name: 'Central' }))
      await userEvent.press(screen.getByRole('button', { name: 'Guardar depósitos' }))
      expect(await screen.findByText('Elegí al menos un depósito.')).toBeTruthy()
      expect(put).not.toHaveBeenCalledWith('/api/v1/socios-comerciales/c1/depositos', expect.anything())
    })
  })

  it('las tarjetas usan la superficie del tema', () => {
    renderConQuery(<ClienteFormScreen />)
    const grupo = screen.getByTestId('grupo-Cómo paga')
    expect(JSON.stringify(grupo.props.style)).toContain(themeColors[modo].surface)
  })
})
