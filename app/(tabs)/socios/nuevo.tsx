import React, { useCallback, useRef, useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { ClienteForm } from '@/features/clientes/components/ClienteForm'

/** Alta y edición de cliente. Se rearma en cada visita: el menú lateral deja la pantalla montada. */
export default function ClienteFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const [visita, setVisita] = useState(0)
  // La primera vez ya se montó limpio: rearmar de nuevo descartaría lo que se alcance a tipear.
  const primera = useRef(true)
  useFocusEffect(useCallback(() => {
    if (primera.current) { primera.current = false; return }
    setVisita(v => v + 1)
  }, []))
  return <ClienteForm key={`${id ?? 'nuevo'}-${visita}`} id={id || undefined} />
}
