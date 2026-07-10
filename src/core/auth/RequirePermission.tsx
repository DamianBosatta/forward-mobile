import React from 'react'
import { View, Text } from 'react-native'
import { ShieldOff } from 'lucide-react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import { useColors, BRAND } from '@/libs/theme'
import type { AppModule, AppRole } from '@/libs/api-client/types'

// ─────────────────────────────────────────────────────────────────────────────
// RequirePermission — Autorización declarativa en el frontend
//
// Uso como wrapper:
//   <RequirePermission module="MOD_COMPRAS" action="create">
//     <Button onPress={handleCreate}>Nueva Compra</Button>
//   </RequirePermission>
//
// Uso como gate de pantalla completa:
//   <RequirePermission module="MOD_USUARIOS" action="read" mode="screen">
//     <UsuariosScreen />
//   </RequirePermission>
//
// Uso imperativo (hook):
//   const { canDo, isAdmin } = usePermissions()
//   if (canDo('MOD_VENTAS', 'create')) { ... }
// ─────────────────────────────────────────────────────────────────────────────

type Action = 'read' | 'create' | 'update' | 'delete'
type Mode = 'hide' | 'disable' | 'screen'

interface RequirePermissionProps {
  /** Módulo o módulos del sistema a verificar */
  module: AppModule | AppModule[]
  /** Acción RCUD requerida */
  action: Action
  /** 
   * Comportamiento cuando el usuario NO tiene permiso:
   * - 'hide': No renderiza nada (default para botones/acciones)
   * - 'disable': Renderiza con opacity reducida y deshabilitado
   * - 'screen': Muestra pantalla completa de "Sin permisos" 
   */
  mode?: Mode
  /** Roles que tienen acceso directo sin verificar permisos granulares */
  allowRoles?: AppRole[]
  /** Children a renderizar si tiene permiso */
  children: React.ReactNode
}

export function RequirePermission({ 
  module, 
  action, 
  mode = 'hide',
  allowRoles,
  children 
}: RequirePermissionProps) {
  const { canDo, hasRole, isAdmin } = useAuthStore()
  const colors = useColors()

  // Admin siempre tiene acceso
  if (isAdmin()) {
    return <>{children}</>
  }

  // Check role-based bypass
  if (allowRoles?.some(role => hasRole(role))) {
    return <>{children}</>
  }

  // Check granular RCUD permission
  const modules = Array.isArray(module) ? module : [module]
  if (modules.some(m => canDo(m, action))) {
    return <>{children}</>
  }

  // ── Sin permiso ──

  if (mode === 'hide') {
    return null
  }

  if (mode === 'disable') {
    return (
      <View pointerEvents="none" style={{ opacity: 0.35 }}>
        {children}
      </View>
    )
  }

  // mode === 'screen'
  return (
    <View style={{ 
      flex: 1, 
      alignItems: 'center', 
      justifyContent: 'center', 
      backgroundColor: colors.bg,
      paddingHorizontal: 40 
    }}>
      <View style={{
        width: 80, height: 80, borderRadius: 24,
        backgroundColor: `${BRAND.blue}15`,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 20, borderWidth: 1, borderColor: `${BRAND.blue}30`,
      }}>
        <ShieldOff size={36} color={BRAND.blue} />
      </View>
      <Text style={{ 
        fontSize: 18, fontWeight: '800', color: colors.text, 
        textAlign: 'center', marginBottom: 8 
      }}>
        Sin permisos
      </Text>
      <Text style={{ 
        fontSize: 14, fontWeight: '500', color: colors.textMuted, 
        textAlign: 'center', lineHeight: 20 
      }}>
        No tenés acceso a esta sección.{'\n'}
        Contactá al administrador del sistema.
      </Text>
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook imperativo para lógica condicional
// ─────────────────────────────────────────────────────────────────────────────

export function usePermissions() {
  const { canDo, hasRole, isAdmin, isSuperAdmin, user } = useAuthStore()

  return {
    /** Verifica permiso granular RCUD para un módulo */
    canDo,
    /** Verifica si el usuario tiene un rol específico */
    hasRole,
    /** True si es Admin o SuperAdmin */
    isAdmin,
    /** True solo si es AdministradorSistemas */
    isSuperAdmin,
    /** Roles del usuario actual */
    roles: user?.roles ?? [],
    /** Acceso rápido: ¿puede ver este módulo? */
    canRead: (mod: AppModule) => isAdmin() || canDo(mod, 'read'),
    /** Acceso rápido: ¿puede crear en este módulo? */
    canCreate: (mod: AppModule) => isAdmin() || canDo(mod, 'create'),
    /** Acceso rápido: ¿puede editar en este módulo? */
    canUpdate: (mod: AppModule) => isAdmin() || canDo(mod, 'update'),
    /** Acceso rápido: ¿puede eliminar en este módulo? */
    canDelete: (mod: AppModule) => isAdmin() || canDo(mod, 'delete'),
  }
}
