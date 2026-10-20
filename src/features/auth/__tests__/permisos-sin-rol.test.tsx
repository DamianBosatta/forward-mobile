/**
 * C-004, lote L-12 — mobile decide con los módulos y capacidades que manda el backend, nunca con
 * el rol. El catálogo completo de AdministradorSistemas llega como filas en
 * GET /api/v1/users/me/permissions (PermissionService), así que acá no hay atajo por rol.
 *
 * Recorre el camino real: formato del servidor → parsePermissionsFromArray → store real.
 */

import React from 'react'
import { Text } from 'react-native'
import { act, render, screen } from '@testing-library/react-native'
import { useAuthStore, parsePermissionsFromArray } from '@/src/features/auth/store/auth.store'
import { RequirePermission } from '@/src/core/auth/RequirePermission'
import { permisosDesde } from '@/src/features/auth/lib/permisos'
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

describe('permisosDesde', () => {
  const filas = parsePermissionsFromArray(['MOD_VENTAS:Read', 'MOD_VENTAS:Create', 'CAP_VER_COSTOS:Read'])

  it('responde por módulo y acción, con lectura por defecto', () => {
    const { puede } = permisosDesde(filas)
    expect(puede('MOD_VENTAS')).toBe(true)
    expect(puede('MOD_VENTAS', 'create')).toBe(true)
    expect(puede('MOD_VENTAS', 'delete')).toBe(false)
  })

  it('una capacidad es un sí/no que se otorga con lectura', () => {
    expect(permisosDesde(filas).tiene('CAP_VER_COSTOS')).toBe(true)
    expect(permisosDesde(filas).tiene('CAP_GESTIONAR_CHEQUES')).toBe(false)
  })

  it('sin filas no puede nada (fail-closed)', () => {
    expect(permisosDesde(undefined).puede('MOD_VENTAS')).toBe(false)
    expect(permisosDesde(null).tiene('CAP_VER_COSTOS')).toBe(false)
  })
})

describe('auth store — canDo sin atajo por rol', () => {
  it('AdministradorSistemas sin filas no puede: el rol no abre nada', () => {
    loguear(['AdministradorSistemas'], [])
    expect(useAuthStore.getState().canDo('MOD_VENTAS', 'read')).toBe(false)
  })

  it('AdministradorSistemas puede con las filas del catálogo completo que le manda el servidor', () => {
    loguear(['AdministradorSistemas'], ['MOD_VENTAS:Read', 'MOD_VENTAS:Create', 'MOD_VENTAS:Update', 'MOD_VENTAS:Delete', 'CAP_GESTIONAR_CHEQUES:Read'])
    expect(useAuthStore.getState().canDo('MOD_VENTAS', 'delete')).toBe(true)
    expect(useAuthStore.getState().hasCapability('CAP_GESTIONAR_CHEQUES')).toBe(true)
  })

  it('un empleado puede lo que dicen sus filas y nada más', () => {
    loguear(['Empleado'], ['MOD_VIAJES:Read', 'MOD_VIAJES:Update'])
    expect(useAuthStore.getState().canDo('MOD_VIAJES', 'update')).toBe(true)
    expect(useAuthStore.getState().canDo('MOD_VENTAS', 'read')).toBe(false)
  })
})

describe('RequirePermission — sin atajo por rol', () => {
  it('a un Administrador sin la fila no le muestra la acción', () => {
    loguear(['Administrador'], [])
    render(
      <RequirePermission module="MOD_COMPRAS" action="create">
        <Text>Nueva compra</Text>
      </RequirePermission>,
    )
    expect(screen.queryByText('Nueva compra')).toBeNull()
  })

  it('con la fila la muestra, sea cual sea el rol', () => {
    loguear(['Empleado'], ['MOD_COMPRAS:Read', 'MOD_COMPRAS:Create'])
    render(
      <RequirePermission module="MOD_COMPRAS" action="create">
        <Text>Nueva compra</Text>
      </RequirePermission>,
    )
    expect(screen.getByText('Nueva compra')).toBeTruthy()
  })
})
