import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { safeHaptics } from '@/core/utils/haptics'
import { 
  useTiposTesoreria, 
  useRegistrarTransaccion, 
  useCuentasPropias,
  useCuentasClientes,
  useCuentasProveedores,
  TesoreriaTipoDto
} from '@/libs/api-client'
import { useAuthStore } from '@/libs/store/auth.store'
import { authenticateWithBiometrics } from '@/features/auth/utils/biometrics'

export function useNuevaTransaccionForm() {
  const router = useRouter()
  const { user } = useAuthStore()
  const queryClient = useRegistrarTransaccion()

  const [monto, setMonto] = useState('')
  const [tipoMovimientoId, setTipoMovimientoId] = useState<string | null>(null)
  const [cuentaOrigenId, setCuentaOrigenId] = useState<string | null>(null)
  const [cuentaDestinoId, setCuentaDestinoId] = useState<string | null>(null)
  const [socioId, setSocioId] = useState<string | null>(null)
  const [observaciones, setObservaciones] = useState('')
  const [comprobanteUri, setComprobanteUri] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ── State Lifecycle Management ─────────────────────────────────────────
  const resetFormState = useCallback(() => {
    setMonto('')
    setTipoMovimientoId(null)
    setCuentaOrigenId(null)
    setCuentaDestinoId(null)
    setSocioId(null)
    setObservaciones('')
    setComprobanteUri(null)
    setError(null)
  }, [])

  // Data
  const { data: tipos } = useTiposTesoreria()
  const { data: cuentasPropias } = useCuentasPropias()
  const { data: cuentasClientes } = useCuentasClientes()
  const { data: cuentasProveedores } = useCuentasProveedores()

  const selectedTipo = useMemo(() =>
    tipos?.find((t: TesoreriaTipoDto) => t.id === tipoMovimientoId),
    [tipos, tipoMovimientoId]
  )

  // Preset tipo from a route param (e.g. the Transferencia / Cargar Gasto action cards).
  const { preset } = useLocalSearchParams<{ preset?: string }>()
  useEffect(() => {
    if (preset && tipos && !tipoMovimientoId) {
      const match = tipos.find((t: TesoreriaTipoDto) => (t.nombre ?? '').toLowerCase().includes(preset.toLowerCase()))
      if (match?.id) setTipoMovimientoId(match.id)
    }
  }, [preset, tipos, tipoMovimientoId])

  const handleGuardar = async () => {
    setError(null)

    if (!monto || parseFloat(monto) <= 0) return setError('Ingrese un monto válido.')
    if (!tipoMovimientoId) return setError('Seleccione un tipo de movimiento.')
    if (!cuentaOrigenId) return setError('Seleccione una cuenta origen.')
    if (!observaciones) return setError('Las observaciones son obligatorias.')

    // Biometría para montos mayores a $50.000 o si es un pago a proveedor
    if (parseFloat(monto) > 50000 || (selectedTipo?.nombre ?? '').toLowerCase().includes('pago')) {
      const authenticated = await authenticateWithBiometrics()
      if (!authenticated) return
    }

    safeHaptics.notification('success')
    
    const formData = new FormData()
    formData.append('monto', monto)
    formData.append('moneda', 'ARS')
    formData.append('tipoMovimientoId', tipoMovimientoId)
    formData.append('cuentaOrigenId', cuentaOrigenId)
    if (cuentaDestinoId) formData.append('cuentaDestinoId', cuentaDestinoId)
    if (socioId) formData.append('socioComercialId', socioId)
    formData.append('observaciones', observaciones)
    if (user?.id) formData.append('usuarioId', user.id)

    if (comprobanteUri) {
      const filename = comprobanteUri.split('/').pop() || 'comprobante.jpg'
      const match = /\.(\w+)$/.exec(filename)
      const type = match ? `image/${match[1]}` : `image`
      
      formData.append('comprobante', {
        uri: comprobanteUri,
        name: filename,
        type
      } as any)
    }

    queryClient.mutate(formData, {
      onSuccess: () => {
        router.replace('/(tabs)/tesoreria')
      },
      onError: (err: any) => {
        setError(err?.response?.data?.message || 'Error al registrar la transacción.')
      }
    })
  }

  return {
    state: {
      monto,
      tipoMovimientoId,
      cuentaOrigenId,
      cuentaDestinoId,
      socioId,
      observaciones,
      comprobanteUri,
      error,
      tipos: tipos || [],
      cuentasPropias: cuentasPropias || [],
      cuentasClientes: cuentasClientes || [],
      cuentasProveedores: cuentasProveedores || [],
      selectedTipo,
      isPending: queryClient.isPending
    },
    actions: {
      setMonto,
      setTipoMovimientoId,
      setCuentaOrigenId,
      setCuentaDestinoId,
      setSocioId,
      setObservaciones,
      setComprobanteUri,
      handleGuardar,
      resetFormState,
    }
  }
}
