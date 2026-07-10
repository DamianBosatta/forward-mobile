import { useState, useEffect, useCallback } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useDepositos, useCreateDeposito, useUpdateDeposito } from '../api/queries'
import { safeHaptics } from '@/core/utils/haptics'
export function useDepositoForm() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const isEdit = !!id

  const { data: depositos = [] } = useDepositos()
  const existingDepo = depositos.find(d => d.id === id)

  const [nombre, setNombre] = useState('')
  const [direccion, setDireccion] = useState('')
  const [activo, setActivo] = useState(true)

  const createMutation = useCreateDeposito()
  const updateMutation = useUpdateDeposito()

  const resetForm = useCallback(() => {
    setNombre('')
    setDireccion('')
    setActivo(true)
  }, [])

  useEffect(() => {
    if (isEdit && existingDepo) {
      setNombre(existingDepo.nombre ?? '')
      setDireccion(existingDepo.direccion ?? '')
      setActivo(existingDepo.activo ?? true)
    } else if (!isEdit) {
      resetForm()
    }
  }, [isEdit, existingDepo, resetForm])

  const handleSubmit = async () => {
    if (!nombre.trim()) return

    safeHaptics.impact('medium')

    if (isEdit) {
      updateMutation.mutate({ id: id!, nombre, direccion, activo }, {
        onSuccess: () => {
          safeHaptics.notification('success')
          router.replace('/(tabs)/inventario/depositos')
        }
      })
    } else {
      createMutation.mutate({ nombre, direccion }, {
        onSuccess: () => {
          safeHaptics.notification('success')
          router.replace('/(tabs)/inventario/depositos')
        }
      })
    }
  }

  return {
    isEdit,
    nombre, setNombre,
    direccion, setDireccion,
    activo, setActivo,
    isPending: createMutation.isPending || updateMutation.isPending,
    handleSubmit,
    resetForm
  }
}
