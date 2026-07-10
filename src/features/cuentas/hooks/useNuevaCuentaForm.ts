import { useState, useCallback } from 'react'
import { Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { safeHaptics } from '@/core/utils/haptics'
import { useCreateCuentaCorriente } from '../api/queries'
import { useSocios } from '@/features/socios/api/queries'

export type SocioTipoLabel = 'Cliente' | 'Proveedor'

export function useNuevaCuentaForm() {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [tipoDestino, setTipoDestino] = useState<'propia' | 'socio'>('propia')
  const [socioId, setSocioId] = useState<string | null>(null)
  const [socioSearch, setSocioSearch] = useState('')
  const [socioTipo, setSocioTipo] = useState<SocioTipoLabel>('Cliente')
  const [esPrincipal, setEsPrincipal] = useState(false)
  const [error, setError] = useState('')

  // ── State Lifecycle Management ─────────────────────────────────────────
  const resetFormState = useCallback(() => {
    setNombre('')
    setTipoDestino('propia')
    setSocioId(null)
    setSocioSearch('')
    setSocioTipo('Cliente')
    setEsPrincipal(false)
    setError('')
  }, [])

  // socioTipo label → número que entiende el backend
  const socioTipoNum: 1 | 2 = socioTipo === 'Cliente' ? 1 : 2

  const { data: sociosData, isLoading: loadingSocios } = useSocios({
    tipo: socioTipoNum,
    activo: true,
    search: socioSearch,
    pageSize: 20
  })

  const socios = sociosData?.items ?? []
  const createMutation = useCreateCuentaCorriente()

  const handleGuardar = async () => {
    if (!nombre.trim()) {
      setError('El nombre de la cuenta es requerido.')
      return
    }
    if (tipoDestino === 'socio' && !socioId) {
      setError('Seleccioná un cliente o proveedor.')
      return
    }
    setError('')

    try {
      safeHaptics.impact('medium')
      await createMutation.mutateAsync({
        nombre: nombre.trim(),
        socioComercialId: tipoDestino === 'socio' ? socioId : null,
        esPrincipal,
      })
      
      Alert.alert('Éxito', 'La cuenta corriente fue creada correctamente.')
      router.replace('/(tabs)/cuentas')
    } catch (e: any) {
      setError(e?.message || 'Error al crear la cuenta. Reintentá.')
    }
  }

  return {
    state: {
      nombre,
      tipoDestino,
      socioId,
      socioSearch,
      socioTipo,
      esPrincipal,
      error,
      socios,
      loadingSocios,
      isPending: createMutation.isPending,
    },
    actions: {
      setNombre,
      setTipoDestino,
      setSocioId,
      setSocioSearch,
      setSocioTipo,
      setEsPrincipal,
      setError,
      handleGuardar,
      resetFormState,
    }
  }
}
