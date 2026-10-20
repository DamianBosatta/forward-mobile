import React from 'react'
import { View, Text } from 'react-native'
import { ShieldOff } from 'lucide-react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import { useColors, BRAND } from '@/libs/theme'
import type { AppModule } from '@/libs/api-client/types'

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
//   const { canDo, hasCapability } = usePermissions()
//   if (canDo('MOD_VENTAS', 'create')) { ... }
//
// Decide solo con los módulos y capacidades que manda el backend, nunca con el rol (C-004, L-12).
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
  /** Children a renderizar si tiene permiso */
  children: React.ReactNode
}

export function RequirePermission({ 
  module, 
  action, 
  mode = 'hide',
  children 
}: RequirePermissionProps) {
  const { canDo } = useAuthStore()
  const colors = useColors()

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
  const { canDo, hasCapability, isAdmin, isSuperAdmin, user } = useAuthStore()

  return {
    /** Verifica permiso granular RCUD para un módulo */
    canDo,
    /** ¿Tiene la capacidad CAP_*? */
    hasCapability,
    /** True si es Admin o SuperAdmin. No autoriza nada: solo la prueba de la venta nueva (ventaNueva.ts). */
    isAdmin,
    /** True solo si es AdministradorSistemas: el backend lo deja operar hojas ajenas (AlcanceDeLaHoja). */
    isSuperAdmin,
    /** Roles del usuario actual, para mostrarlos */
    roles: user?.roles ?? [],
    /** Acceso rápido: ¿puede ver este módulo? */
    canRead: (mod: AppModule) => canDo(mod, 'read'),
    /** Acceso rápido: ¿puede crear en este módulo? */
    canCreate: (mod: AppModule) => canDo(mod, 'create'),
    /** Acceso rápido: ¿puede editar en este módulo? */
    canUpdate: (mod: AppModule) => canDo(mod, 'update'),
    /** Acceso rápido: ¿puede eliminar en este módulo? */
    canDelete: (mod: AppModule) => canDo(mod, 'delete'),
  }
}
