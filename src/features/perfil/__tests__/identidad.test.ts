import { lineasDeIdentidad } from '../lib/identidad'

describe('lineasDeIdentidad (encabezado de Mi cuenta)', () => {
  it('si el usuario es el mismo email, el email sale una sola vez y el rol queda solo', () => {
    expect(lineasDeIdentidad({ roles: ['AdministradorSistemas'], username: 'a@forward.com', email: 'a@forward.com' })).toEqual({
      rol: 'Administrador de sistemas',
      email: 'a@forward.com',
    })
  })
  it('con usuario distinto del email, el usuario va junto al rol', () => {
    expect(lineasDeIdentidad({ roles: ['Vendedora'], username: 'lucia.fernandez', email: 'lucia@d.com.ar' })).toEqual({
      rol: 'Vendedora · lucia.fernandez',
      email: 'lucia@d.com.ar',
    })
  })
  it('MB-8: el puesto se lee con su nombre y no con el nombre interno', () => {
    expect(lineasDeIdentidad({ roles: ['AdministradorSistemas'], username: 'ana', email: 'ana@d.com' }).rol).toBe('Administrador de sistemas · ana')
  })
  it('sin email, el usuario con forma de email no se repite ni se pierde', () => {
    expect(lineasDeIdentidad({ roles: ['Vendedor'], username: 'ana' })).toEqual({ rol: 'Vendedor · ana', email: null })
  })
})
