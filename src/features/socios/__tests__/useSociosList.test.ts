import { renderHook } from '@testing-library/react-native'
import { useSociosList } from '../hooks/useSociosList'
import { useInfiniteSocios } from '@/libs/api-client/socios'

jest.mock('@/libs/api-client/socios', () => ({ useInfiniteSocios: jest.fn() }))

const pagina = (desde: number, n: number, totalCount: number) => ({
  items: Array.from({ length: n }, (_, i) => ({ id: String(desde + i), tipo: 'Cliente' })),
  totalCount,
})

describe('useSociosList — contador del servidor', () => {
  it('con 2 páginas de 20 y totalCount 137 el contador dice "Mostrando 40 de 137"', () => {
    ;(useInfiniteSocios as jest.Mock).mockReturnValue({
      data: { pages: [pagina(0, 20, 137), pagina(20, 20, 137)] },
      isLoading: false,
    })
    const { result } = renderHook(() => useSociosList())
    expect(result.current.contador).toBe('Mostrando 40 de 137')
  })

  it('el total de clientes del KPI es el del servidor, no los cargados', () => {
    ;(useInfiniteSocios as jest.Mock).mockReturnValue({
      data: { pages: [pagina(0, 20, 137)] },
      isLoading: false,
    })
    const { result } = renderHook(() => useSociosList())
    expect(result.current.kpis.todos).toBe(137)
  })
})
