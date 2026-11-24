import { etiquetaDeRol, etiquetasDeRoles } from '../rol'

// P11: the four roles are read with their display name; this is a label only, never a permission.
describe('etiquetaDeRol', () => {
  it.each([
    ['AdministradorSistemas', 'Administrador de sistemas'],
    ['Administrador', 'Administrador'],
    ['Gerencia', 'Gerencia'],
    ['Empleado', 'Empleado'],
  ])('%s is read as "%s"', (rol, texto) => {
    expect(etiquetaDeRol(rol)).toBe(texto)
  })

  it('shows an unknown role as the server sent it', () => {
    expect(etiquetaDeRol('Auditor')).toBe('Auditor')
  })

  it('joins a list of roles with a middle dot', () => {
    expect(etiquetasDeRoles(['AdministradorSistemas', 'Empleado'])).toBe('Administrador de sistemas · Empleado')
    expect(etiquetasDeRoles(undefined)).toBe('')
  })
})
