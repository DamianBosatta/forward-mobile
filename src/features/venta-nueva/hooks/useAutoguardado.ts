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
  /** Relee el borrador del servidor (versión y contenido en la misma forma que `valores`). */
  releer?: () => Promise<{ version: number; valores: T }>
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
 *
 * Reintentos: mientras espera el próximo intento, los cambios nuevos solo actualizan lo pendiente;
 * el intento sale en la hora prevista con lo último. El contador de fallos se pone en cero con un
 * guardado exitoso o al tocar Reintentar. Un fallo ambiguo (sin respuesta o 5xx: el servidor pudo
 * haber aplicado el PUT) se concilia antes de reintentar: se relee el borrador y, si ya tiene lo
 * que se mandó, se adopta su versión; si nadie lo tocó se reintenta con su versión; si no, es un
 * conflicto real.
 */
export function useAutoguardado<T>({ borradorId, versionInicial, valores, guardar, releer, base, debounceMs = 800 }: Opciones<T>) {
  const [estado, setEstado] = useState<EstadoGuardado>('inactivo')
  const [motivo, setMotivo] = useState<string | null>(null)
  const [reintentable, setReintentable] = useState(false)
  const snapshot = JSON.stringify(valores)
  const r = useRef({
    valores, snapshot, guardar, releer, base, borradorId, version: versionInicial, guardado: snapshot, intentado: '',
    conflicto: false, pendiente: false, cerrado: false, desmontado: false, enEspera: false, ambiguo: false, fallos: 0,
  })
  Object.assign(r.current, { valores, snapshot, guardar, releer, base, borradorId })
  const enVuelo = useRef<Promise<void> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const reintento = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  /** Tras un fallo ambiguo: ¿el servidor aplicó lo que mandamos, sigue como estaba o lo cambió otro? */
  const conciliar = useCallback(async (): Promise<'aplicado' | 'intacto' | 'ajeno' | 'ilegible'> => {
    const s = r.current
    if (!s.releer) return 'ilegible'
    try {
      const srv = await s.releer()
      const contenido = JSON.stringify(srv.valores)
      if (contenido === s.intentado) { s.version = srv.version; s.guardado = contenido; s.ambiguo = false; return 'aplicado' }
      if (contenido === s.guardado || srv.version === s.version) { s.version = srv.version; s.ambiguo = false; return 'intacto' }
      return 'ajeno'
    } catch {
      return 'ilegible'
    }
  }, [])

  const ejecutar = useCallback((): Promise<void> => {
    const s = r.current
    if (!s.borradorId) return Promise.resolve()
    if (enVuelo.current) {
      s.pendiente = true
      return enVuelo.current
    }
    // En espera de un reintento: lo último queda pendiente y sale a la hora prevista.
    if (s.enEspera) return Promise.resolve()
    clearTimeout(reintento.current)
    const { valores: v, snapshot: snap } = s
    setEstado('guardando')
    enVuelo.current = (async () => {
      let conciliado = false
      try {
        if (s.ambiguo) {
          const c = await conciliar()
          conciliado = c !== 'ilegible'
          if (c === 'ajeno') throw new ApiError(409, 'El borrador cambió en el servidor.')
        }
        if (snap !== s.guardado) {
          s.version = await s.guardar(v, s.version)
          s.guardado = snap
        }
        s.ambiguo = false
        s.fallos = 0
        if (!s.desmontado) { setEstado('guardado'); setMotivo(null); setReintentable(false) }
      } catch (e) {
        let conflicto = e instanceof ApiError && e.status === 409
        let resuelto = false
        // Un 409 después de un fallo ambiguo puede ser nuestro propio PUT ya aplicado: se relee antes de darlo por perdido.
        if (conflicto && s.ambiguo && !conciliado) {
          const c = await conciliar()
          if (c === 'aplicado' || c === 'intacto') {
            conflicto = false
            resuelto = true
            s.pendiente = true
            if (!s.desmontado) { setEstado(snap === s.guardado ? 'guardado' : 'guardando'); setMotivo(null); setReintentable(false) }
          }
        }
        if (!resuelto) {
          s.conflicto = conflicto
          const ambiguo = esDeRed(e)
          if (ambiguo) { s.ambiguo = true; s.intentado = snap } else s.ambiguo = false
          const espera = ambiguo && !s.cerrado && !s.desmontado && s.borradorId ? ESPERAS_REINTENTO_MS[s.fallos++] : undefined
          if (espera !== undefined) {
            // Sigue "Guardando…" mientras espera el próximo intento.
            s.enEspera = true
            reintento.current = setTimeout(() => {
              s.enEspera = false
              if (!s.cerrado && !s.desmontado && s.borradorId) void ejecutar()
            }, espera)
          } else if (!s.desmontado) {
            setEstado(conflicto ? 'conflicto' : 'error')
            setReintentable(ambiguo)
            setMotivo(conflicto
              ? 'Este borrador se cambió desde otro lado. Volvé a abrirlo para seguir.'
              : mensajeDelServidor(e, 'No se pudo guardar por un error de conexión.'))
          }
        }
      } finally {
        enVuelo.current = null
      }
      if (s.pendiente) {
        s.pendiente = false
        if (s.snapshot !== s.guardado && !s.conflicto && !s.enEspera) await ejecutar()
      }
    })()
    return enVuelo.current
  }, [conciliar])

  // Borrador nuevo: lo guardado es lo que el servidor tiene (la base); lo que se cargó mientras nacía se guarda después.
  useEffect(() => {
    const { base: b, snapshot: s } = r.current
    clearTimeout(reintento.current)
    Object.assign(r.current, { version: versionInicial, guardado: b === undefined ? s : JSON.stringify(b), conflicto: false, pendiente: false, cerrado: false, enEspera: false, ambiguo: false, fallos: 0 })
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
    // Pedido del usuario (confirmar o salir): no espera el reintento programado, intenta ya.
    clearTimeout(reintento.current)
    s.enEspera = false
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
    clearTimeout(reintento.current)
    s.enEspera = false
    s.fallos = 0
    void ejecutar()
  }, [ejecutar])

  // Al salir se intenta una última vez, sin reintentos automáticos después ni timers vivos.
  useEffect(() => {
    r.current.desmontado = false
    return () => {
      const s = r.current
      clearTimeout(timer.current)
      clearTimeout(reintento.current)
      s.desmontado = true
      s.fallos = ESPERAS_REINTENTO_MS.length
      flush().catch(() => undefined)
    }
  }, [flush])

  return { estado, motivo, reintentable, reintentar, flush, cerrar }
}
