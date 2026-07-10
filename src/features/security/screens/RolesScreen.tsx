import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { securityApi } from '../api/securityApi'
import { GlassCard, AnimatedListItem } from '@/core/ui'
import { Users, ShieldAlert, ChevronRight, Star } from 'lucide-react-native'
import { useColors } from '@/libs/theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MotiView } from 'moti'

export const RolesScreen = () => {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const { data: roles, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => securityApi.getRoles()
  })

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView 
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: 20, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <MotiView 
          from={{ opacity: 0, translateX: -20 }}
          animate={{ opacity: 1, translateX: 0 }}
          style={{ marginBottom: 32 }}
        >
          <Text style={{ fontSize: 28, fontWeight: '900', color: colors.text, letterSpacing: -1 }}>ROLES</Text>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 4 }}>ESTRUCTURA ORGANIZACIONAL</Text>
        </MotiView>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 50 }} />
        ) : (
          <View style={{ gap: 16 }}>
            {roles?.map((role, index) => (
              <AnimatedListItem key={role.id} index={index}>
                <TouchableOpacity activeOpacity={0.8}>
                  <GlassCard intensity={15} style={{ padding: 20 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                      <View style={{ 
                        width: 44, height: 44, borderRadius: 14, 
                        backgroundColor: role.isSystemRole ? colors.warning + '15' : colors.primary + '15', 
                        alignItems: 'center', justifyContent: 'center' 
                      }}>
                        {role.isSystemRole ? (
                          <ShieldAlert size={20} color={colors.warning} />
                        ) : (
                          <Users size={20} color={colors.primary} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>{role.name}</Text>
                          {role.isSystemRole && <Star size={12} color={colors.warning} fill={colors.warning} />}
                        </View>
                        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                          {role.userCount} USUARIOS ASIGNADOS
                        </Text>
                      </View>
                      <ChevronRight size={20} color={colors.textDisabled} />
                    </View>

                    {role.description && (
                      <Text style={{ color: colors.textDisabled, fontSize: 11, marginTop: 12, fontStyle: 'italic' }}>
                        {role.description}
                      </Text>
                    )}
                  </GlassCard>
                </TouchableOpacity>
              </AnimatedListItem>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}
