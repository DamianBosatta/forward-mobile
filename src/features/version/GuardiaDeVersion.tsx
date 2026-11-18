import React, { useCallback, useEffect, useState } from 'react'
import { AppState } from 'react-native'
import * as SplashScreen from 'expo-splash-screen'
import { leerDatosDeVersion } from '@/features/perfil/lib/version'
import { ActualizacionRequerida } from './ActualizacionRequerida'
import { comprobarVersion, type ResultadoDeVersion } from './comprobarVersion'

/**
 * OPS-03: holds the app (the splash stays up) until the first minimum-version check settles, so an outdated build never
 * reaches the login. The call has a short timeout and fails open. Checks again when the app returns to the foreground.
 */
export function GuardiaDeVersion({ children }: { children: React.ReactNode }) {
  const [resultado, setResultado] = useState<ResultadoDeVersion | null>(null)
  const instalada = leerDatosDeVersion().version ?? null

  const comprobar = useCallback(() => {
    void comprobarVersion(instalada).then(setResultado)
  }, [instalada])

  useEffect(() => {
    comprobar()
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') comprobar()
    })
    return () => sub.remove()
  }, [comprobar])

  const bloqueada = resultado?.bloquea === true
  useEffect(() => {
    // The app never renders its own screens while blocked, so the splash would stay up.
    if (bloqueada) SplashScreen.hideAsync().catch(() => {})
  }, [bloqueada])

  if (!resultado) return null
  if (bloqueada && instalada && resultado.minima) {
    return <ActualizacionRequerida instalada={instalada} minima={resultado.minima} onReintentar={comprobar} />
  }
  return <>{children}</>
}
