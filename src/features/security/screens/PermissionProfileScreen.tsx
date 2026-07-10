import React, { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { securityApi } from '../api/securityApi'
import { GlassCard, AnimatedListItem, ForwardLogo, ConfirmModal } from '@/core/ui'
import { Shield, Plus, ChevronRight, LayoutGrid, Trash2 } from 'lucide-react-native'
import { useColors, tokens, useIsDark } from '@/libs/theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { MotiView, MotiText } from 'moti'
import { FadeInDown } from 'react-native-reanimated'
import { useRBAC } from '../hooks/useRBAC'
import { safeHaptics } from '@/core/utils/haptics'

export const PermissionProfileScreen = () => {
  const colors = useColors()
  const isDark = useIsDark()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const rbac = useRBAC()

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nombre: string } | null>(null)

  const { data: profiles, isLoading } = useQuery({
    queryKey: ['permissionProfiles'],
    queryFn: () => securityApi.getProfiles()
  })

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView 
        contentContainerStyle={{ 
          paddingTop: insets.top + tokens.spacing.md, 
          paddingHorizontal: tokens.spacing.md, 
          paddingBottom: 120 
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Centralizado */}
        <MotiView 
          from={{ opacity: 0, translateY: -20 }}
          animate={{ opacity: 1, translateY: 0 }}
          style={{ marginBottom: tokens.spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <View>
            <MotiText 
              style={{ fontSize: 32, fontWeight: '900', color: colors.text, letterSpacing: -1.5 }}
            >
              PERFILES
            </MotiText>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <LayoutGrid size={14} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>
                Seguridad Corporativa
              </Text>
            </View>
          </View>
          
          <TouchableOpacity 
            onPress={() => router.push('/security/profiles/new')}
            activeOpacity={0.7}
            style={{ 
              width: 56, height: 56, borderRadius: tokens.radius.lg, 
              backgroundColor: colors.primary, 
              alignItems: 'center', justifyContent: 'center',
              ...tokens.shadows.premium
            }}
          >
            <Plus color="#FFFFFF" size={28} strokeWidth={3} />
          </TouchableOpacity>
        </MotiView>

        {isLoading ? (
          <View style={{ marginTop: 100 }}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : profiles?.length === 0 ? (
          <MotiView 
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ alignItems: 'center', marginTop: 80 }}
          >
            <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <Shield size={48} color={colors.textSecondary} strokeWidth={1} />
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '800', textAlign: 'center' }}>
              SIN PERFILES ACTIVOS
            </Text>
          </MotiView>
        ) : (
          <View style={{ gap: tokens.spacing.md }}>
            {profiles?.map((profile, index) => (
              <AnimatedListItem key={profile.id} index={index}>
                <TouchableOpacity 
                  activeOpacity={0.9}
                  onPress={() => router.push(`/security/profiles/${profile.id}`)}
                >
                  <GlassCard 
                    intensity={isDark ? 12 : 30} 
                    style={{ 
                      padding: tokens.spacing.lg, 
                      borderRadius: tokens.radius.xl,
                      borderWidth: 1,
                      borderColor: colors.glassBorder
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md }}>
                      <View style={{ 
                        width: 52, height: 52, borderRadius: tokens.radius.lg, 
                        backgroundColor: colors.primary + '15', 
                        alignItems: 'center', justifyContent: 'center',
                        borderWidth: 1, borderColor: colors.primary + '30'
                      }}>
                        <Shield size={24} color={colors.primary} strokeWidth={2.5} />
                      </View>
                      
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', letterSpacing: -0.5 }}>
                          {profile.nombre}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success, marginRight: 6 }} />
                          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                            {profile.detalles.length} Módulos configurados
                          </Text>
                        </View>
                      </View>
                      
                      <TouchableOpacity
                        onPress={() => { safeHaptics.impact('medium'); setDeleteTarget({ id: profile.id, nombre: profile.nombre }) }}
                        style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#EF444415', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#EF444430' }}
                      >
                        <Trash2 size={16} color="#EF4444" />
                      </TouchableOpacity>

                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                        <ChevronRight size={18} color={colors.textSecondary} />
                      </View>
                    </View>

                    {/* Tags de Módulos con estilo Premium */}
                    <View style={{ 
                      flexDirection: 'row', 
                      flexWrap: 'wrap',
                      gap: 8, 
                      marginTop: 20, 
                      borderTopWidth: 1, 
                      borderTopColor: colors.glassBorder, 
                      paddingTop: 16 
                    }}>
                      {profile.detalles.slice(0, 4).map((d) => (
                        <View key={d.id} style={{ 
                          backgroundColor: isDark ? colors.surface : colors.background, 
                          paddingHorizontal: 12, 
                          paddingVertical: 6, 
                          borderRadius: tokens.radius.md,
                          borderWidth: 1,
                          borderColor: colors.border
                        }}>
                          <Text style={{ fontSize: 10, fontWeight: '900', color: colors.primary, textTransform: 'uppercase' }}>
                            {d.module}
                          </Text>
                        </View>
                      ))}
                      {profile.detalles.length > 4 && (
                        <View style={{ paddingVertical: 6, justifyContent: 'center' }}>
                          <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '900' }}>
                            +{profile.detalles.length - 4} MÁS
                          </Text>
                        </View>
                      )}
                    </View>
                  </GlassCard>
                </TouchableOpacity>
              </AnimatedListItem>
            ))}
          </View>
        )}
      </ScrollView>

      <ConfirmModal
        visible={!!deleteTarget}
        title="Eliminar Perfil"
        message={`¿Estás seguro que deseas eliminar el perfil "${deleteTarget?.nombre}"? Esta acción no se puede deshacer.`}
        variant="danger"
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await rbac.deleteProfile(deleteTarget.id)
            safeHaptics.notification('success')
          } catch (e) {
            // silently fail — profile list will stay unchanged
          }
          setDeleteTarget(null)
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  )
}
