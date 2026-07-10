import React from 'react'
import { useLocalSearchParams } from 'expo-router'
import { PermissionDetailScreen } from '@/src/features/security/screens/PermissionDetailScreen'

export default function PermissionProfileRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  
  return <PermissionDetailScreen profileId={id || 'new'} />
}
