import React, { useCallback, useRef, useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { ProveedorForm } from '@/features/proveedores/components/ProveedorForm'

/** Alta y edición de proveedor. Se rearma en cada visita: el menú lateral deja la pantalla montada. */
export default function ProveedorFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const [visita, setVisita] = useState(0)
  // La primera vez ya se montó limpio: rearmar de nuevo descartaría lo que se alcance a tipear.
  const primera = useRef(true)
  useFocusEffect(useCallback(() => {
    if (primera.current) { primera.current = false; return }
    setVisita(v => v + 1)
  }, []))
  return <ProveedorForm key={`${id ?? 'nuevo'}-${visita}`} id={id || undefined} />
}
