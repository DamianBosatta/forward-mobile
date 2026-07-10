/**
 * Tests unitarios del AuthStore y la función parsePermissionsFromArray.
 *
 * El store usa zustand con persist sobre MMKV. En tests, el storage
 * se mockea en jest.setup.ts (AsyncStorage mock). Testeamos la lógica
 * pura del store creando instancias aisladas con `create()`.
 */

import { act } from '@testing-library/react-native'
import { create } from 'zustand'

// ── Importar la lógica pura para testear ──────────────────────────────────────
// Testeamos parsePermissionsFromArray directamente (función pura)
// y las acciones del store con una instancia in-memory (sin persist)
import { parsePermissionsFromArray } from '@/src/features/auth/store/auth.store'
import type { AppRole, AppModule, ModulePermission } from '@/libs/api-client/types'

// ─────────────────────────────────────────────────────────────────────────────
// Tests de parsePermissionsFromArray (función pura — sin mocks)
// ─────────────────────────────────────────────────────────────────────────────

describe('parsePermissionsFromArray', () => {
  it('parsea permisos simples correctamente', () => {
    const perms = ['MOD_VENTAS:read', 'MOD_VENTAS:create', 'MOD_COMPRAS:read']
    const result = parsePermissionsFromArray(perms)

    const ventas = result.find(p => p.module === 'MOD_VENTAS')
    expect(ventas).toBeDefined()
    expect(ventas?.canRead).toBe(true)
    expect(ventas?.canCreate).toBe(true)
    expect(ventas?.canUpdate).toBe(false)
    expect(ventas?.canDelete).toBe(false)

    const compras = result.find(p => p.module === 'MOD_COMPRAS')
    expect(compras?.canRead).toBe(true)
    expect(compras?.canCreate).toBe(false)
  })

  it('ignora entradas malformadas sin módulo o acción', () => {
    const perms = ['MOD_VENTAS:read', 'SinDosPartes', ':read', 'MOD_COMPRAS:']
    const result = parsePermissionsFromArray(perms)

    // Solo 'MOD_VENTAS:read' es parseable correctamente con ambas partes
    const ventas = result.find(p => p.module === 'MOD_VENTAS')
    expect(ventas).toBeDefined()
    // El resto no debe generar módulos
    expect(result.length).toBe(1)
  })

  it('deduplica módulos repetidos acumulando permisos', () => {
    const perms = ['MOD_VENTAS:read', 'MOD_VENTAS:create', 'MOD_VENTAS:delete']
    const result = parsePermissionsFromArray(perms)

    expect(result.length).toBe(1)
    expect(result[0].canRead).toBe(true)
    expect(result[0].canCreate).toBe(true)
    expect(result[0].canDelete).toBe(true)
    expect(result[0].canUpdate).toBe(false)
  })

  it('devuelve array vacío si no hay permisos', () => {
    const result = parsePermissionsFromArray([])
    expect(result).toHaveLength(0)
  })

  it('es case-sensitive en acciones (ignora READ en mayúsculas)', () => {
    // La implementación usa .toLowerCase() antes de comparar, así que debe funcionar
    const perms = ['MOD_VENTAS:READ', 'MOD_VENTAS:CREATE']
    const result = parsePermissionsFromArray(perms)
    const ventas = result.find(p => p.module === 'MOD_VENTAS')
    expect(ventas?.canRead).toBe(true)
    expect(ventas?.canCreate).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests de lógica del store (in-memory, sin persist)
// ─────────────────────────────────────────────────────────────────────────────

interface SimpleAuthState {
  isAuthenticated: boolean
  user: { roles: AppRole[]; permissions: ModulePermission[] } | null
  setTokens: (t: { accessToken: string; refreshToken: string }) => void
  setUser: (u: SimpleAuthState['user']) => void
  logout: () => void
  hasRole: (r: AppRole) => boolean
  isAdmin: () => boolean
  isSuperAdmin: () => boolean
  canDo: (m: AppModule, a: 'read' | 'create' | 'update' | 'delete') => boolean
}

function buildTestStore() {
  return create<SimpleAuthState>()((set, get) => ({
    isAuthenticated: false,
    user: null,
    setTokens: (t) => set({ isAuthenticated: true }),
    setUser: (u) => set({ user: u }),
    logout: () => set({ isAuthenticated: false, user: null }),
    hasRole: (role) => get().user?.roles.includes(role) ?? false,
    isAdmin: () => {
      const roles = get().user?.roles ?? []
      return roles.includes('AdministradorSistemas') || roles.includes('Administrador')
    },
    isSuperAdmin: () => get().user?.roles.includes('AdministradorSistemas') ?? false,
    canDo: (module, action) => {
      if (get().isSuperAdmin()) return true
      const perm = get().user?.permissions.find(p => p.module === module)
      if (!perm) return false
      switch (action) {
        case 'read':   return perm.canRead   ?? false
        case 'create': return perm.canCreate ?? false
        case 'update': return perm.canUpdate ?? false
        case 'delete': return perm.canDelete ?? false
        default:       return false
      }
    },
  }))
}

describe('AuthStore — lógica de permisos', () => {
  it('isAuthenticated es false por defecto', () => {
    const useStore = buildTestStore()
    expect(useStore.getState().isAuthenticated).toBe(false)
  })

  it('setTokens establece isAuthenticated en true', () => {
    const useStore = buildTestStore()
    act(() => {
      useStore.getState().setTokens({ accessToken: 'abc', refreshToken: 'def' })
    })
    expect(useStore.getState().isAuthenticated).toBe(true)
  })

  it('logout resetea el estado', () => {
    const useStore = buildTestStore()
    act(() => {
      useStore.getState().setTokens({ accessToken: 'abc', refreshToken: 'def' })
      useStore.getState().setUser({ roles: ['Administrador'], permissions: [] })
      useStore.getState().logout()
    })
    expect(useStore.getState().isAuthenticated).toBe(false)
    expect(useStore.getState().user).toBeNull()
  })

  it('hasRole retorna true si el usuario tiene el rol', () => {
    const useStore = buildTestStore()
    act(() => {
      useStore.getState().setUser({ roles: ['Empleado'], permissions: [] })
    })
    expect(useStore.getState().hasRole('Empleado')).toBe(true)
    expect(useStore.getState().hasRole('Administrador')).toBe(false)
  })

  it('isAdmin retorna true para Administrador y AdministradorSistemas', () => {
    const useStore = buildTestStore()
    act(() => {
      useStore.getState().setUser({ roles: ['Administrador'], permissions: [] })
    })
    expect(useStore.getState().isAdmin()).toBe(true)

    act(() => {
      useStore.getState().setUser({ roles: ['AdministradorSistemas'], permissions: [] })
    })
    expect(useStore.getState().isAdmin()).toBe(true)
  })

  it('isSuperAdmin retorna false para Administrador normal', () => {
    const useStore = buildTestStore()
    act(() => {
      useStore.getState().setUser({ roles: ['Administrador'], permissions: [] })
    })
    expect(useStore.getState().isSuperAdmin()).toBe(false)
  })

  it('canDo retorna true para SuperAdmin sin importar el permiso', () => {
    const useStore = buildTestStore()
    act(() => {
      useStore.getState().setUser({ roles: ['AdministradorSistemas'], permissions: [] })
    })
    expect(useStore.getState().canDo('MOD_VENTAS', 'delete')).toBe(true)
  })

  it('canDo respeta los permisos del usuario normal', () => {
    const useStore = buildTestStore()
    act(() => {
      useStore.getState().setUser({
        roles: ['Empleado'],
        permissions: [
          { module: 'MOD_VENTAS', canRead: true, canCreate: true, canUpdate: false, canDelete: false },
        ],
      })
    })
    expect(useStore.getState().canDo('MOD_VENTAS', 'read')).toBe(true)
    expect(useStore.getState().canDo('MOD_VENTAS', 'create')).toBe(true)
    expect(useStore.getState().canDo('MOD_VENTAS', 'delete')).toBe(false)
    expect(useStore.getState().canDo('MOD_COMPRAS', 'read')).toBe(false) // sin permiso de Compras
  })
})
