import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { invalidarPorAvisos, invalidarPorCambioDeSocio, invalidarPorEntidad, refrescarVencidas } from '../invalidaciones'

const nuevo = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
const sembrar = (qc: QueryClient, ...claves: unknown[][]) => claves.forEach((k) => qc.setQueryData(k, { ok: true }))
const vieja = (qc: QueryClient, k: unknown[]) => qc.getQueryCache().find({ queryKey: k, exact: true })!.state.isInvalidated

describe('invalidarPorEntidad: un tipo del backend refresca lo que lo muestra', () => {
  const casos: [string, unknown[][]][] = [
    ['venta', [['ventas', 'list'], ['inicio', 'resumen']]],
    ['socio', [['socios', 'list']]],
    ['producto', [['productos', 'list']]],
    ['stock', [['stock', 'x']]],
    ['hojaRuta', [['logistica', 'hojas-ruta'], ['ventas', 'list']]],
    ['compra', [['compras', 'list']]],
    ['pago', [['ventas', 'list'], ['compras', 'list']]],
    ['caja', [['caja']]],
    ['tesoreria', [['tesoreria', 'x']]],
    ['cheque', [['tesoreria', 'x']]],
  ]
  it.each(casos)('%s', async (tipo, claves) => {
    const qc = nuevo()
    sembrar(qc, ...claves, ['otra-cosa'])
    await invalidarPorEntidad(qc, tipo, 'id-1')
    claves.forEach((k) => expect(vieja(qc, k)).toBe(true))
    expect(vieja(qc, ['otra-cosa'])).toBe(false)
  })

  it('id: null es todo ese tipo', async () => {
    const qc = nuevo()
    sembrar(qc, ['logistica', 'hoja-ruta', 'h1'], ['logistica', 'hoja-ruta', 'h2'])
    await invalidarPorEntidad(qc, 'hojaRuta', null)
    expect(vieja(qc, ['logistica', 'hoja-ruta', 'h1'])).toBe(true)
    expect(vieja(qc, ['logistica', 'hoja-ruta', 'h2'])).toBe(true)
  })

  it('un tipo desconocido no hace nada', async () => {
    const qc = nuevo()
    sembrar(qc, ['ventas', 'list'], ['socios', 'list'])
    await invalidarPorEntidad(qc, 'tipoNuevoDelBackend', 'x')
    expect(vieja(qc, ['ventas', 'list'])).toBe(false)
    expect(vieja(qc, ['socios', 'list'])).toBe(false)
  })
})

describe('invalidarPorAvisos', () => {
  it('aplica cada aviso válido, descarta los mal formados y los repetidos', async () => {
    const qc = nuevo()
    sembrar(qc, ['ventas', 'list'], ['compras', 'list'])
    await invalidarPorAvisos(qc, [{ tipo: 'venta', id: 'a' }, { tipo: 'venta', id: 'a' }, null, 7, { id: 'z' }, { tipo: 'compra' }])
    expect(vieja(qc, ['ventas', 'list'])).toBe(true)
    expect(vieja(qc, ['compras', 'list'])).toBe(true)
  })

  it('algo que no es una lista no hace nada', async () => {
    const qc = nuevo()
    sembrar(qc, ['ventas', 'list'])
    await invalidarPorAvisos(qc, { tipo: 'venta' })
    expect(vieja(qc, ['ventas', 'list'])).toBe(false)
  })
})

describe('refrescarVencidas', () => {
  it('vuelve a pedir lo activo que venció y no lo que sigue fresco', async () => {
    const qc = nuevo()
    const vencida = jest.fn().mockResolvedValue(1)
    const fresca = jest.fn().mockResolvedValue(1)
    const u1 = new QueryObserver(qc, { queryKey: ['a'], queryFn: vencida, staleTime: 0 }).subscribe(() => undefined)
    const u2 = new QueryObserver(qc, { queryKey: ['b'], queryFn: fresca, staleTime: 60_000 }).subscribe(() => undefined)
    await new Promise((r) => setImmediate(r))
    vencida.mockClear(); fresca.mockClear()
    await refrescarVencidas(qc)
    expect(vencida).toHaveBeenCalledTimes(1)
    expect(fresca).not.toHaveBeenCalled()
    u1(); u2()
  })
})

describe('invalidarPorCambioDeSocio', () => {
  it('guardar condiciones de pago, vendedor o depósitos refresca socios y cuentas, y nada más', async () => {
    const qc = nuevo()
    sembrar(qc, ['socios', 'list'], ['cuentas-corrientes', 'list'], ['otra-cosa'])
    await invalidarPorCambioDeSocio(qc)
    expect(vieja(qc, ['socios', 'list'])).toBe(true)
    expect(vieja(qc, ['cuentas-corrientes', 'list'])).toBe(true)
    expect(vieja(qc, ['otra-cosa'])).toBe(false)
  })
})
