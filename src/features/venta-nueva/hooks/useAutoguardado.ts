import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '@/core/api/client'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'

export type EstadoGuardado = 'inactivo' | 'guardando' | 'guardado' | 'error' | 'conflicto'

interface Opciones<T> {
  borradorId: string | undefined
  versionInicial: number
  valores: T
  /** Persiste contra `version` y devuelve la versión nueva del servidor. */
  guardar: (valores: T, version: number) => Promise<number>
  debounceMs?: number
}

/**
 * Autoguardado del borrador con las reglas de la web (useAutosaveDocumento): 800 ms sin cambios,
 * versión encadenada, el último cambio gana (si cambia mientras guarda, guarda otra vez al
 * terminar) y ante un 409 se frena: el borrador se cambió desde otro lado.
 */
export function useAutoguardado<T>({ borradorId, versionInicial, valores, guardar, debounceMs = 800 }: Opciones<T>) {
  const [estado, setEstado] = useState<EstadoGuardado>('inactivo')
  const [motivo, setMotivo] = useState<string | null>(null)
  const snapshot = JSON.stringify(valores)
  const r = useRef({ valores, snapshot, guardar, borradorId, version: versionInicial, guardado: snapshot, conflicto: false, pendiente: false, cerrado: false })
  Object.assign(r.current, { valores, snapshot, guardar, borradorId })
  const enVuelo = useRef<Promise<void> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const ejecutar = useCallback((): Promise<void> => {
    const s = r.current
    if (enVuelo.current) {
      s.pendiente = true
      return enVuelo.current
    }
    const { valores: v, snapshot: snap } = s
    setEstado('guardando')
    enVuelo.current = (async () => {
      try {
        s.version = await s.guardar(v, s.version)
        s.guardado = snap
        setEstado('guardado')
        setMotivo(null)
      } catch (e) {
        const conflicto = e instanceof ApiError && e.status === 409
        s.conflicto = conflicto
        setEstado(conflicto ? 'conflicto' : 'error')
        setMotivo(conflicto
          ? 'Este borrador se cambió desde otro lado. Volvé a abrirlo para seguir.'
          : mensajeDelServidor(e, 'No se pudo guardar por un error de conexión.'))
      } finally {
        enVuelo.current = null
      }
      if (s.pendiente) {
        s.pendiente = false
        if (s.snapshot !== s.guardado && !s.conflicto) await ejecutar()
      }
    })()
    return enVuelo.current
  }, [])

  // Borrador nuevo: lo que hay en pantalla ya es lo que tiene el servidor.
  useEffect(() => {
    Object.assign(r.current, { version: versionInicial, guardado: r.current.snapshot, conflicto: false, pendiente: false, cerrado: false })
    setEstado('inactivo')
    setMotivo(null)
  }, [borradorId, versionInicial])

  useEffect(() => {
    clearTimeout(timer.current)
    if (!borradorId || r.current.cerrado || r.current.conflicto || snapshot === r.current.guardado) return
    timer.current = setTimeout(() => void ejecutar(), debounceMs)
  }, [snapshot, borradorId, debounceMs, ejecutar])

  /** Guarda ya lo pendiente (antes de confirmar o salir) y devuelve la versión vigente; si no pudo, falla. */
  const flush = useCallback(async (): Promise<number> => {
    clearTimeout(timer.current)
    if (enVuelo.current) await enVuelo.current
    const s = r.current
    if (s.borradorId && !s.conflicto && !s.cerrado && s.snapshot !== s.guardado) await ejecutar()
    if (!s.cerrado && s.snapshot !== s.guardado) throw new Error('El borrador tiene cambios sin guardar. Revisá el aviso y probá de nuevo.')
    return r.current.version
  }, [ejecutar])

  /** Cierra el autoguardado (la venta ya se confirmó): ni el timer ni el flush al desmontar vuelven a guardar. */
  const cerrar = useCallback(() => {
    clearTimeout(timer.current)
    r.current.cerrado = true
    r.current.pendiente = false
  }, [])

  useEffect(() => () => { flush().catch(() => undefined) }, [flush])

  return { estado, motivo, flush, cerrar }
}
