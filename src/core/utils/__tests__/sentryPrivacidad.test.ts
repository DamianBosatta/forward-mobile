import * as Sentry from '@sentry/react-native'
import { limpiarEvento, limpiarMigaDePan, limpiarTransaccion, vincularUsuarioASentry } from '../sentryPrivacidad'

jest.mock('@sentry/react-native', () => ({ setUser: jest.fn() }))

describe('limpiarMigaDePan (SEG-06)', () => {
  it('saca la query string de la url de una miga http y de la navegación', () => {
    const http = limpiarMigaDePan({ category: 'http', data: { url: 'https://api/x/Productos?busqueda=juan%20perez&page=2', method: 'GET' } })
    expect(http.data).toEqual({ url: 'https://api/x/Productos?<redacted>', method: 'GET' })
    const nav = limpiarMigaDePan({ category: 'navigation', data: { from: '/clientes?q=ana', to: '/ventas' } })
    expect(nav.data).toEqual({ from: '/clientes?<redacted>', to: '/ventas' })
  })

  it('no toca lo que no tiene query y no muta la miga original', () => {
    const miga = { category: 'ui.click', message: 'Button', data: { url: '/a?x=1' } }
    limpiarMigaDePan(miga)
    expect(miga.data.url).toBe('/a?x=1')
    expect(limpiarMigaDePan({ category: 'ui.click', message: 'Button' })).toEqual({ category: 'ui.click', message: 'Button' })
  })
})

describe('limpiarEvento (SEG-06)', () => {
  it('saca la query de la request, de los mensajes de excepción y de las migas del evento', () => {
    const e = limpiarEvento({
      type: undefined,
      request: { url: 'https://api/x?token=abc', query_string: 'token=abc' },
      exception: { values: [{ type: 'ApiError', value: 'fallo en /Clientes?busqueda=ana' }] },
      breadcrumbs: [{ category: 'http', data: { url: '/a?b=1' } }],
    } as never)
    expect(e.request).toEqual({ url: 'https://api/x?<redacted>' })
    expect(e.exception?.values?.[0].value).toBe('fallo en /Clientes?<redacted>')
    expect(e.breadcrumbs?.[0].data?.url).toBe('/a?<redacted>')
  })
})

describe('limpiarTransaccion (MS-R5-01)', () => {
  it('saca la query de la URL de cada span, de su descripción y de la transacción', () => {
    const t = limpiarTransaccion({
      type: 'transaction',
      transaction: 'GET /Productos?searchTerm=abc',
      spans: [{
        description: 'GET https://api/x/Productos?searchTerm=abc',
        data: { url: 'https://api/x/Productos?searchTerm=abc', 'http.url': 'https://api/x/Productos?searchTerm=abc', 'http.query': '?searchTerm=abc', 'http.method': 'GET' },
      }],
    } as never)
    expect(t.transaction).toBe('GET /Productos?<redacted>')
    const span = t.spans![0]!
    expect(span.description).toBe('GET https://api/x/Productos?<redacted>')
    expect(span.data).toEqual({ url: 'https://api/x/Productos?<redacted>', 'http.url': 'https://api/x/Productos?<redacted>', 'http.method': 'GET' })
    expect(JSON.stringify(t)).not.toContain('searchTerm=abc')
  })
})

describe('vincularUsuarioASentry (OPS-05)', () => {
  const tienda = (inicial: { id: string } | null) => {
    let estado: { user: { id: string; nombre?: string } | null } = { user: inicial }
    const oyentes = new Set<(s: typeof estado) => void>()
    return {
      getState: () => estado,
      subscribe: (o: (s: typeof estado) => void) => { oyentes.add(o); return () => { oyentes.delete(o) } },
      poner: (u: typeof estado.user) => { estado = { user: u }; oyentes.forEach((o) => o(estado)) },
    }
  }
  beforeEach(() => (Sentry.setUser as jest.Mock).mockClear())

  it('manda solo el id al iniciar sesión y limpia al cerrarla', () => {
    const t = tienda(null)
    const baja = vincularUsuarioASentry(t as never)
    t.poner({ id: 'u1', nombre: 'Ana' })
    expect(Sentry.setUser).toHaveBeenLastCalledWith({ id: 'u1' })
    t.poner(null)
    expect(Sentry.setUser).toHaveBeenLastCalledWith(null)
    baja()
  })

  it('no repite la llamada si el id no cambió', () => {
    const t = tienda({ id: 'u1' })
    vincularUsuarioASentry(t as never)
    t.poner({ id: 'u1', nombre: 'Otro dato' })
    expect(Sentry.setUser).toHaveBeenCalledTimes(1)
  })
})
