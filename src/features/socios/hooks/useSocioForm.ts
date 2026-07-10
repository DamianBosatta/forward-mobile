import { useState, useEffect, useCallback } from 'react'
import { safeHaptics } from '@/core/utils/haptics'
import { useRouter } from 'expo-router'
import { useCreateSocio, useUpdateSocio, useSocio, sociosKeys } from '../api/queries'
import { useQueryClient } from '@tanstack/react-query'
import { socioSchema } from '@/libs/validations'

export function useSocioForm(id?: string) {
  const isEditing = !!id && id.length > 0
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: socio, isLoading: isLoadingSocio } = useSocio(id ?? '')
  const createSocio = useCreateSocio()
  const updateSocio = useUpdateSocio()
  const isPending = createSocio.isPending || updateSocio.isPending

  const [formError, setFormError] = useState<string | null>(null)

  const [razonSocial, setRazonSocial] = useState('')
  const [cuit, setCuit] = useState('')
  const [tipoRaw, setTipoRaw] = useState<0 | 1>(0)
  const [condicionIva, setCondicionIva] = useState<string>('Responsable Inscripto')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')

  // ── State Lifecycle Management ─────────────────────────────────────────
  const [focusKey, setFocusKey] = useState(0)

  // Limpieza para TODOS los modos (creación y edición)
  const resetForm = useCallback(() => {
    setRazonSocial('')
    setCuit('')
    setTipoRaw(0)
    setCondicionIva('Responsable Inscripto')
    setEmail('')
    setTelefono('')
    setDireccion('')
    setFormError(null)
  }, [])

  const bumpFocusKey = useCallback(() => setFocusKey(k => k + 1), [])

  // Carga de datos para edición
  useEffect(() => {
    if (isEditing && socio) {
      setRazonSocial(socio.razonSocial ?? '')
      setCuit(socio.cuit ?? '')
      setTipoRaw(socio.tipo === 'Cliente' ? 0 : 1)
      setCondicionIva(socio.condicionIva ?? 'Responsable Inscripto')
      setEmail(socio.email ?? '')
      setTelefono(socio.telefono ?? '')
      setDireccion(socio.direccion ?? '')
    }
  }, [isEditing, socio, focusKey])

  const submit = useCallback(async () => {
    setFormError(null)

    const payload = {
      razonSocial: razonSocial.trim(),
      cuit: cuit.trim(),
      tipoRaw,
      condicionIva,
      email: email.trim(),
      telefono: telefono.trim(),
      direccion: direccion.trim(),
    }

    // ── Zod Validation ──
    const validation = socioSchema.safeParse(payload)
    if (!validation.success) {
      safeHaptics.notification('error')
      const firstError = validation.error.errors[0]?.message ?? 'Datos inválidos'
      setFormError(firstError)
      return
    }

    try {
      if (isEditing && id) {
        await updateSocio.mutateAsync({ ...payload, id })
        safeHaptics.notification('success')
      } else {
        await createSocio.mutateAsync(payload)
        safeHaptics.notification('success')
      }
      router.replace('/(tabs)/socios')
    } catch (e: unknown) {
      safeHaptics.notification('error')
      setFormError((e as Error)?.message ?? 'No se pudo procesar la solicitud.')
    }
  }, [razonSocial, cuit, tipoRaw, condicionIva, email, telefono, direccion, isEditing, id, updateSocio, createSocio, router])

  const validRazon = razonSocial.trim().length > 2
  const validCuit = cuit.trim().length === 11
  const validEmail = email.trim() === '' || email.includes('@')

  return {
    form: { razonSocial, cuit, tipoRaw, condicionIva, email, telefono, direccion },
    setters: { setRazonSocial, setCuit, setTipoRaw, setCondicionIva, setEmail, setTelefono, setDireccion },
    validation: { validRazon, validCuit, validEmail },
    status: { isLoadingSocio, isEditing, isPending, formError },
    actions: { submit, resetForm, bumpFocusKey },
    lifecycle: { queryClient, sociosKeys },
  }
}
