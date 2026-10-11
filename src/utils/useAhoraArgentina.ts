import { useCallback, useEffect, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { msHastaProximaMedianocheArgentina } from './date'

/**
 * El instante "de hoy" para pantallas que el Drawer deja montadas: se recalcula al volver a
 * enfocarlas y al cruzar la medianoche argentina (un timer hasta la próxima 00:00).
 */
export function useAhoraArgentina(): number {
  const [ahora, setAhora] = useState(() => Date.now())
  useFocusEffect(useCallback(() => { setAhora(Date.now()) }, []))
  useEffect(() => {
    const t = setTimeout(() => setAhora(Date.now()), msHastaProximaMedianocheArgentina(ahora))
    return () => clearTimeout(t)
  }, [ahora])
  return ahora
}
