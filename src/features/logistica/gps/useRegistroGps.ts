import { useCallback, useEffect, useRef, useState } from 'react'
import { aceptarPermisoGps, comenzarRegistroGps, rechazarPermisoGps } from './registroGps'

/**
 * El GPS visto desde la consola. `hojaDeRutaId` va solo si el viaje es del chofer logueado. Abrir un viaje en curso lo
 * retoma en silencio; el aviso de "sin ubicación" sale solo de lo que el chofer acaba de hacer, no cada vez que entra.
 */
export function useRegistroGps(hojaDeRutaId: string | undefined, usuarioId: string | undefined, enCurso: boolean) {
  const [preguntar, setPreguntar] = useState(false)
  const [sinUbicacion, setSinUbicacion] = useState(false)
  // Ya contestó: el refresco de la hoja tras iniciar no vuelve a abrir la pregunta con el pedido del sistema abierto.
  const contestada = useRef(false)

  useEffect(() => {
    if (!hojaDeRutaId || !usuarioId || !enCurso) return
    let vigente = true
    void comenzarRegistroGps(hojaDeRutaId, usuarioId).then((r) => {
      if (vigente && r === 'preguntar' && !contestada.current) setPreguntar(true)
    })
    return () => { vigente = false }
  }, [hojaDeRutaId, usuarioId, enCurso])

  const alIniciar = useCallback(async () => {
    if (!hojaDeRutaId || !usuarioId) return
    const r = await comenzarRegistroGps(hojaDeRutaId, usuarioId)
    if (r === 'preguntar' && !contestada.current) setPreguntar(true)
    if (r === 'sinPermiso') setSinUbicacion(true)
  }, [hojaDeRutaId, usuarioId])

  const aceptar = useCallback(async () => {
    if (!hojaDeRutaId || !usuarioId) return
    contestada.current = true
    setPreguntar(false)
    const r = await aceptarPermisoGps(hojaDeRutaId, usuarioId)
    setSinUbicacion(r === 'sinPermiso')
  }, [hojaDeRutaId, usuarioId])

  const rechazar = useCallback(() => {
    if (!hojaDeRutaId || !usuarioId) return
    contestada.current = true
    setPreguntar(false)
    rechazarPermisoGps(hojaDeRutaId, usuarioId)
  }, [hojaDeRutaId, usuarioId])

  return { preguntar, sinUbicacion, alIniciar, aceptar, rechazar }
}
