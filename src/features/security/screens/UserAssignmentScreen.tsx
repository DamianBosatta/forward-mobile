import React, { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Modal, Alert } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useUsuarios } from '@/libs/api-client/admin'
import { securityApi } from '../api/securityApi'
import { GlassCard, AnimatedListItem } from '@/core/ui'
import { User, Search, ChevronRight, Shield, X, Check } from 'lucide-react-native'
import { useColors, useIsDark, BRAND } from '@/libs/theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MotiView, AnimatePresence } from 'moti'

export const UserAssignmentScreen = () => {
  const colors = useColors()
  const isDark = useIsDark()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [isModalVisible, setIsModalVisible] = useState(false)

  // Queries
  const { data: usersData, isLoading: loadingUsers } = useUsuarios({ 
    searchTerm: searchTerm.length >= 3 ? searchTerm : undefined,
    pageSize: 50 
  })
  
  const { data: roles, isLoading: loadingRoles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => securityApi.getRoles()
  })

  // Mutation
  const assignMutation = useMutation({
    mutationFn: ({ userId, roleName }: { userId: string, roleName: string }) => 
      securityApi.assignRoleToUser(userId, roleName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      Alert.alert('Éxito', 'Rol asignado correctamente')
      setIsModalVisible(false)
    },
    onError: (err) => Alert.alert('Error', String(err))
  })

  const handleUserPress = (user: any) => {
    setSelectedUser(user)
    setIsModalVisible(true)
  }

  const handleRoleSelect = (roleName: string) => {
    if (!selectedUser) return
    assignMutation.mutate({ userId: selectedUser.id, roleName })
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView 
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: 20, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <MotiView 
          from={{ opacity: 0, translateX: -20 }}
          animate={{ opacity: 1, translateX: 0 }}
          style={{ marginBottom: 24 }}
        >
          <Text style={{ fontSize: 28, fontWeight: '900', color: colors.text, letterSpacing: -1 }}>ASIGNACIÓN</Text>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 4 }}>ROLES POR USUARIO</Text>
        </MotiView>

        {/* Search Bar */}
        <View style={{ 
          flexDirection: 'row', alignItems: 'center', gap: 12, 
          backgroundColor: colors.surface2, borderRadius: 16, 
          paddingHorizontal: 16, height: 50, marginBottom: 24,
          borderWidth: 1, borderColor: colors.border + '50'
        }}>
          <Search size={20} color={colors.textMuted} />
          <TextInput 
            placeholder="Buscar usuario..."
            placeholderTextColor={colors.textDisabled}
            value={searchTerm}
            onChangeText={setSearchTerm}
            style={{ flex: 1, color: colors.text, fontWeight: '600' }}
          />
        </View>

        {loadingUsers ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 50 }} />
        ) : (
          <View style={{ gap: 12 }}>
            {usersData?.items.map((user, index) => (
              <AnimatedListItem key={user.id} index={index}>
                <TouchableOpacity 
                  activeOpacity={0.8}
                  onPress={() => handleUserPress(user)}
                >
                  <GlassCard intensity={isDark ? 10 : 25} style={{ padding: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ 
                        width: 44, height: 44, borderRadius: 14, 
                        backgroundColor: colors.surface2, 
                        alignItems: 'center', justifyContent: 'center' 
                      }}>
                        <User size={22} color={colors.textMuted} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>
                          {user.nombre} {user.apellido}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{user.email}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        {(user.roles ?? []).map((r: string) => (
                          <View key={r} style={{ backgroundColor: BRAND.blue + '15', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ color: BRAND.blue, fontSize: 10, fontWeight: '900' }}>{r.toUpperCase()}</Text>
                          </View>
                        ))}
                      </View>
                      <ChevronRight size={18} color={colors.textDisabled} />
                    </View>
                  </GlassCard>
                </TouchableOpacity>
              </AnimatedListItem>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Role Selection Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <MotiView 
            from={{ translateY: 300 }}
            animate={{ translateY: 0 }}
            style={{ 
              backgroundColor: colors.bg, 
              borderTopLeftRadius: 32, borderTopRightRadius: 32,
              padding: 24, paddingBottom: insets.bottom + 20,
              maxHeight: '80%'
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <View>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>ASIGNAR ROL</Text>
                <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>
                  {selectedUser?.nombre} {selectedUser?.apellido}
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => setIsModalVisible(false)}
                style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}
              >
                <X color={colors.text} size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {loadingRoles ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <View style={{ gap: 12 }}>
                  {roles?.map((role) => {
                    const isSelected = selectedUser?.roles.includes(role.name)
                    return (
                      <TouchableOpacity 
                        key={role.id}
                        onPress={() => handleRoleSelect(role.name)}
                        disabled={assignMutation.isPending}
                        style={{ 
                          flexDirection: 'row', alignItems: 'center', gap: 16,
                          backgroundColor: isSelected ? BRAND.blue + '10' : colors.surface2,
                          padding: 16, borderRadius: 16,
                          borderWidth: 1.5, borderColor: isSelected ? BRAND.blue : 'transparent'
                        }}
                      >
                        <View style={{ 
                          width: 40, height: 40, borderRadius: 10, 
                          backgroundColor: isSelected ? BRAND.blue : colors.textDisabled + '20',
                          alignItems: 'center', justifyContent: 'center' 
                        }}>
                          {isSelected ? <Check color="#fff" size={20} /> : <Shield color={colors.textMuted} size={20} />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>{role.name}</Text>
                          {role.description && (
                            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{role.description}</Text>
                          )}
                        </View>
                        {assignMutation.isPending && selectedUser?.id === selectedUser?.id && (
                          <ActivityIndicator size="small" color={BRAND.blue} />
                        )}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              )}
            </ScrollView>
          </MotiView>
        </View>
      </Modal>
    </View>
  )
}
