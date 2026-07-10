import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { zustandStorage } from '@/core/utils/storage'
import type { AppRole, AppModule, ModulePermission } from '@/libs/api-client/types'

// ─────────────────────────────────────────────────────────────────────────────
// Auth Store — JWT tokens + user profile + permisos RCUD del token
// ─────────────────────────────────────────────────────────────────────────────

interface UserProfile {
  id:                       string
  username:                 string
  email?:                   string
  nombre?:                  string
  apellido?:                string
  depositoId?:              string
  vendedorId?:              string
  maxDescuentoPorcentaje?:  number
  puedeVenderSinStock?:     boolean
  roles:                    AppRole[]
  permissions:              ModulePermission[]
}

interface TokenResponse {
  accessToken:  string
  refreshToken: string
}

interface AuthState {
  accessToken:     string | null
  refreshToken:    string | null
  user:            UserProfile | null
  isAuthenticated: boolean
  isHydrated:      boolean

  // Actions
  setTokens:   (tokens: TokenResponse) => void
  setUser:     (user: UserProfile) => void
  logout:      () => void
  setHydrated: () => void
  getToken:    () => string | null

  // Permission helpers
  hasRole:  (role: AppRole) => boolean
  canDo:    (module: AppModule, action: 'read' | 'create' | 'update' | 'delete') => boolean
  isAdmin:  () => boolean
  isSuperAdmin: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken:     null,
      refreshToken:    null,
      user:            null,
      isAuthenticated: false,
      isHydrated:      false,

      setTokens: (tokens) => set({
        accessToken:     tokens.accessToken,
        refreshToken:    tokens.refreshToken,
        isAuthenticated: true,
      }),

      setUser: (user) => set({ user }),

      logout: () => set({
        accessToken:     null,
        refreshToken:    null,
        user:            null,
        isAuthenticated: false,
      }),

      setHydrated: () => set({ isHydrated: true }),
      getToken:    () => get().accessToken,

      hasRole: (role) => get().user?.roles.includes(role) ?? false,

      isSuperAdmin: () => get().user?.roles.includes('AdministradorSistemas') ?? false,

      isAdmin: () => {
        const roles = get().user?.roles ?? []
        return roles.includes('AdministradorSistemas') || roles.includes('Administrador')
      },

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
    }),
    {
      name:    'forward-auth-secure-v2', // Incrementamos versión por cambio de storage
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        accessToken:     state.accessToken,
        refreshToken:    state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        user:            state.user,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated()
      },
    },
  ),
)

export function parsePermissionsFromArray(permissionsArray: (string | ModulePermission)[]): ModulePermission[] {
  const map = new Map<AppModule, ModulePermission>()

  for (const item of permissionsArray) {
    if (typeof item !== 'string') {
      // Si ya es un objeto (nueva API de permisos V2)
      if (!item.module) continue
      map.set(item.module as AppModule, { ...item })
      continue
    }

    const [rawModule, rawAction] = item.split(':')
    if (!rawModule || !rawAction) continue

    const module = rawModule.trim() as AppModule
    const action = rawAction.trim().toLowerCase()
    if (!map.has(module)) {
      map.set(module, {
        module,
        canRead: false,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
      })
    }

    const modPerm = map.get(module)!
    if (action === 'read')   modPerm.canRead = true
    if (action === 'create') modPerm.canCreate = true
    if (action === 'update') modPerm.canUpdate = true
    if (action === 'delete') modPerm.canDelete = true
  }

  return Array.from(map.values())
}
