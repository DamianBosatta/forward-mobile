import { renderHook, waitFor } from '@testing-library/react-native'
import { useSocio } from '@/libs/api-client/socios'
import type { SocioDetailDto } from '@/libs/api-client/types'

jest.mock('@/libs/api-client/socios', () => ({
  useSocio: jest.fn(),
}))

const mockSocioDetail: SocioDetailDto = {
  id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  razonSocial: 'Acme S.A.',
  cuit: '30-12345678-9',
  tipo: 'Cliente',
  condicionIva: 'Responsable Inscripto',
  email: 'acme@acme.com',
  telefono: '+54 9 11 1234 5678',
  direccion: 'Av. Corrientes 1234, CABA',
  activo: true,
  saldoAmount: 15000,
  saldoCurrency: 'ARS',
  cuentaId: 'a1b2c3d4-0000-0000-0000-000000000001',
}

describe('useSocio', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useSocio as jest.Mock).mockReturnValue({
      data: mockSocioDetail,
      isLoading: false,
      isError: false,
    })
  })

  it('returns SocioDetailDto with all required fields', async () => {
    const { result } = renderHook(() => useSocio(mockSocioDetail.id!))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const socio = result.current.data as SocioDetailDto
    expect(socio).toBeDefined()
    expect(socio.id).toBe(mockSocioDetail.id)
    expect(socio.razonSocial).toBe('Acme S.A.')
    expect(socio.cuit).toBe('30-12345678-9')
    expect(socio.tipo).toBe('Cliente')
  })

  it('returns condicionIva, email, telefono and direccion fields', async () => {
    const { result } = renderHook(() => useSocio(mockSocioDetail.id!))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const socio = result.current.data as SocioDetailDto
    expect(socio.condicionIva).toBe('Responsable Inscripto')
    expect(socio.email).toBe('acme@acme.com')
    expect(socio.telefono).toBe('+54 9 11 1234 5678')
    expect(socio.direccion).toBe('Av. Corrientes 1234, CABA')
  })

  it('returns saldo and account fields', async () => {
    const { result } = renderHook(() => useSocio(mockSocioDetail.id!))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const socio = result.current.data as SocioDetailDto
    expect(socio.saldoAmount).toBe(15000)
    expect(socio.saldoCurrency).toBe('ARS')
    expect(socio.cuentaId).toBe('a1b2c3d4-0000-0000-0000-000000000001')
    expect(socio.activo).toBe(true)
  })

  it('is disabled when id is empty', () => {
    ;(useSocio as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    })

    const { result } = renderHook(() => useSocio(''))

    expect(result.current.data).toBeUndefined()
    expect(result.current.isLoading).toBe(false)
  })
})
