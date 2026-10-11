/**
 * CAP_VER_COSTOS — quién ve costos lo decide la CAPACIDAD, no el rol.
 *
 * El servidor manda las capacidades en GET /api/v1/users/me/permissions con el mismo
 * formato que los módulos ("CAP_VER_COSTOS:Read"); useAuth las parsea con
 * parsePermissionsFromArray y las guarda en user.permissions. Estos tests recorren ese
 * camino real (formato del servidor → store real → selector) para los cuatro casos:
 * con y sin capacidad, y los dos cruces que la lista fija de roles resolvía mal.
 */

import { act } from '@testing-library/react-native'
import { useAuthStore, parsePermissionsFromArray } from '@/src/features/auth/store/auth.store'
import { canViewCost } from '@/src/features/ventas/lib/descuentos'
import type { AppRole } from '@/libs/api-client/types'

function loguear(roles: string[], permisosDelServidor: string[]) {
  act(() => {
    useAuthStore.getState().setUser({
      id: 'u1',
      username: 'test',
      roles: roles as AppRole[],
      permissions: parsePermissionsFromArray(permisosDelServidor),
    })
  })
}

afterEach(() => {
  act(() => useAuthStore.getState().logout())
})

describe('auth store — canSeeCosts / hasCapability', () => {
  it('sin la capacidad no ve costos', () => {
    loguear(['Empleado'], ['MOD_VENTAS:Read'])
    expect(useAuthStore.getState().canSeeCosts()).toBe(false)
    expect(useAuthStore.getState().hasCapability('CAP_VER_COSTOS')).toBe(false)
  })

  it('con la capacidad ve costos', () => {
    loguear(['Empleado'], ['MOD_VENTAS:Read', 'CAP_VER_COSTOS:Read'])
    expect(useAuthStore.getState().canSeeCosts()).toBe(true)
    expect(useAuthStore.getState().hasCapability('CAP_VER_COSTOS')).toBe(true)
  })

  it('Gerencia SIN la capacidad no ve costos (el rol ya no alcanza)', () => {
    loguear(['Gerencia'], ['MOD_VENTAS:Read', 'MOD_STOCK:Read'])
    expect(useAuthStore.getState().canSeeCosts()).toBe(false)
  })

  it('Vendedor CON la capacidad otorgada por puesto ve costos', () => {
    loguear(['Vendedor'], ['MOD_VENTAS:Read', 'CAP_VER_COSTOS:Read'])
    expect(useAuthStore.getState().canSeeCosts()).toBe(true)
  })

  it('sin usuario (deslogueado) nunca ve costos', () => {
    expect(useAuthStore.getState().canSeeCosts()).toBe(false)
  })

  it('otra capacidad no habilita costos', () => {
    loguear(['Empleado'], ['CAP_AUTORIZAR_VENTA:Read'])
    expect(useAuthStore.getState().canSeeCosts()).toBe(false)
    expect(useAuthStore.getState().hasCapability('CAP_AUTORIZAR_VENTA')).toBe(true)
  })
})

describe('canViewCost(permissions) — función pura', () => {
  it('fail-closed con permisos nulos o vacíos', () => {
    expect(canViewCost(null)).toBe(false)
    expect(canViewCost(undefined)).toBe(false)
    expect(canViewCost([])).toBe(false)
  })

  it('la fila de la capacidad sin canRead no cuenta', () => {
    expect(canViewCost([{ module: 'CAP_VER_COSTOS', canRead: false }])).toBe(false)
  })

  it('la fila con canRead sí cuenta', () => {
    expect(canViewCost(parsePermissionsFromArray(['CAP_VER_COSTOS:Read']))).toBe(true)
  })
})
