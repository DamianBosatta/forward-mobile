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
  /** Lo que el servidor ya tiene al nacer el borrador; sin base, lo que está en pantalla (retomar). */
  base?: T
  debounceMs?: number
}

/** Esperas entre reintentos ante un error de red o del servidor (5xx); un 4xx no se reintenta. */
export const ESPERAS_REINTENTO_MS = [2000, 5000, 10_000]
const esDeRed = (e: unknown) => !(e instanceof ApiError) || e.status >= 500

/**
 * Autoguardado del borrador con las reglas de la web (useAutosaveDocumento): 800 ms sin cambios,
 * versión encadenada, el último cambio gana (si cambia mientras guarda, guarda otra vez al
 * terminar) y ante un 409 se frena: el borrador se cambió desde otro lado. Un error de red se
 * reintenta solo (ESPERAS_REINTENTO_MS) y después queda "Sin guardar" con Reintentar.
 */
export function useAutoguardado<T>({ borradorId, versionInicial, valores, guardar, base, debounceMs = 800 }: Opciones<T>) {
  const [estado, setEstado] = useState<EstadoGuardado>('inactivo')
  const [motivo, setMotivo] = useState<string | null>(null)
  const [reintentable, setReintentable] = useState(false)
  const snapshot = JSON.stringify(valores)
  const r = useRef({ valores, snapshot, guardar, base, borradorId, version: versionInicial, guardado: snapshot, conflicto: false, pendiente: false, cerrado: false, fallos: 0 })
  Object.assign(r.current, { valores, snapshot, guardar, base, borradorId })
  const enVuelo = useRef<Promise<void> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const reintento = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const ejecutar = useCallback((): Promise<void> => {
    const s = r.current
    if (enVuelo.current) {
      s.pendiente = true
      return enVuelo.current
    }
    clearTimeout(reintento.current)
    const { valores: v, snapshot: snap } = s
    setEstado('guardando')
    enVuelo.current = (async () => {
      try {
        s.version = await s.guardar(v, s.version)
        s.guardado = snap
        s.fallos = 0
        setEstado('guardado')
        setMotivo(null)
        setReintentable(false)
      } catch (e) {
        const conflicto = e instanceof ApiError && e.status === 409
        s.conflicto = conflicto
        const espera = esDeRed(e) && !s.cerrado ? ESPERAS_REINTENTO_MS[s.fallos++] : undefined
        if (espera !== undefined) {
          // Sigue "Guardando…" mientras espera el próximo intento.
          reintento.current = setTimeout(() => { if (!r.current.cerrado) void ejecutar() }, espera)
        } else {
          setEstado(conflicto ? 'conflicto' : 'error')
          setReintentable(esDeRed(e))
          setMotivo(conflicto
            ? 'Este borrador se cambió desde otro lado. Volvé a abrirlo para seguir.'
            : mensajeDelServidor(e, 'No se pudo guardar por un error de conexión.'))
        }
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

  // Borrador nuevo: lo guardado es lo que el servidor tiene (la base); lo que se cargó mientras nacía se guarda después.
  useEffect(() => {
    const { base: b, snapshot: s } = r.current
    clearTimeout(reintento.current)
    Object.assign(r.current, { version: versionInicial, guardado: b === undefined ? s : JSON.stringify(b), conflicto: false, pendiente: false, cerrado: false, fallos: 0 })
    setEstado('inactivo')
    setMotivo(null)
    setReintentable(false)
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
    clearTimeout(reintento.current)
    r.current.cerrado = true
    r.current.pendiente = false
  }, [])

  /** Reintentar a mano tras agotar los reintentos automáticos. */
  const reintentar = useCallback(() => {
    const s = r.current
    if (!s.borradorId || s.cerrado || s.conflicto) return
    s.fallos = 0
    void ejecutar()
  }, [ejecutar])

  // Al salir se intenta una última vez, sin reintentos automáticos después.
  useEffect(() => () => { r.current.fallos = ESPERAS_REINTENTO_MS.length; flush().catch(() => undefined) }, [flush])

  return { estado, motivo, reintentable, reintentar, flush, cerrar }
}
