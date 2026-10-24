import { useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { gestorStock, type GestorStock, type MensajeStock } from './stockEnVivo'

/** Sin conexión en vivo, lo que se ve se vuelve a pedir cada tanto (y al volver al primer plano). */
export const REFRESCO_SIN_CONEXION_MS = 30_000

interface Opciones {
  depositoIds: string[]
  /** Hay que volver a pedir el stock: al (re)conectar, o sin conexión cada 30 s y al volver al primer plano. */
  alRefrescar: () => void
  alCambio?: (mensaje: MensajeStock) => void
  gestor?: GestorStock
}

/** Stock en vivo para una pantalla: se suscribe al hub y dice si hay conexión ("Stock en vivo" / "Sin conexión"). */
export function useStockEnVivo({ depositoIds, alRefrescar, alCambio, gestor = gestorStock }: Opciones): { enVivo: boolean } {
  const [enVivo, setEnVivo] = useState(false)
  // Los callbacks cambian en cada render: se leen de acá para no reabrir la suscripción.
  const refrescar = useRef(alRefrescar)
  const cambio = useRef(alCambio)
  refrescar.current = alRefrescar
  cambio.current = alCambio
  const clave = [...new Set(depositoIds)].sort().join(',')

  useEffect(() => {
    setEnVivo(false)
    return gestor.suscribir(clave ? clave.split(',') : [], {
      alConectar: () => refrescar.current(),
      alCambio: (m) => cambio.current?.(m),
      alEstado: setEnVivo,
    })
  }, [clave, gestor])

  useEffect(() => {
    if (enVivo) return
    const id = setInterval(() => { refrescar.current(); gestor.reintentar() }, REFRESCO_SIN_CONEXION_MS)
    const sub = AppState.addEventListener('change', (e) => { if (e === 'active') refrescar.current() })
    return () => { clearInterval(id); sub.remove() }
  }, [enVivo, gestor])

  return { enVivo }
}
