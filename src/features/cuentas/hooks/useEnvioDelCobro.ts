import { useState } from 'react'
import { nuevaClaveIdempotencia } from '@/features/venta-nueva/lib/payload'
import { claveDeOtroSocio, useCajasAbiertas, useRegistrarCobro, type CobroRegistrado } from '../api/cobros'
import { armarCobro, entraACaja, type FormCobro } from '../lib/cobro'

/**
 * El envío de un cobro, compartido por el formulario de siempre (`RegistrarCobro`) y el cobro en pasos
 * (`CobroEnPasos`): la clave de idempotencia, las cajas abiertas y el POST.
 *
 * Una clave por cobro, la misma en cada reintento (tocar de nuevo tras un corte no lo carga dos veces);
 * «Registrar otro cobro» (`reiniciar`) arranca otra. Un cobro duplicado es peor que perder una edición: se edite
 * lo que se edite del formulario (monto, medio, cheque, referencia) la clave NO cambia, y si el cobro anterior sí
 * se había grabado el servidor lo dice con un 409 y lo nuevo no se guarda. Solo se cambia si el servidor dice que
 * la clave era de otro socio.
 *
 * `pedirCajas`: pide las cajas abiertas aunque ninguna línea del formulario entre a caja todavía (el medio que
 * se está cargando sí entra).
 */
export function useEnvioDelCobro(socioId: string, f: FormCobro, pedirCajas = false) {
  const registrar = useRegistrarCobro()
  const [clave, setClave] = useState(nuevaClaveIdempotencia)
  // Con el cobro combinado, cualquiera de las líneas puede ser efectivo.
  const conCaja = entraACaja(f)
  const cajas = useCajasAbiertas(conCaja || pedirCajas)
  const [aviso, setAviso] = useState<string | null>(null)
  const [cobro, setCobro] = useState<CobroRegistrado | null>(null)

  // Con caja: sin lista cargada, con error (aunque haya datos viejos) o sin ninguna abierta, no se cobra.
  const sinCajas = conCaja && !!cajas.data && !cajas.error && cajas.data.length === 0
  const sinCajaUtil = conCaja && (!cajas.data || !!cajas.error || cajas.data.length === 0)

  const enviar = (subiendo: boolean) => {
    if (registrar.isPending || subiendo) return
    // Con caja, sin las cajas abiertas no se sabe en cuál entra el efectivo: no se manda incompleto.
    if (sinCajaUtil) return
    // Con una sola caja abierta se manda esa; con varias, la elige quien cobra.
    const abiertas = cajas.data ?? []
    const depositoId = f.depositoId ?? (abiertas.length === 1 ? abiertas[0].depositoId : null)
    if (conCaja && abiertas.length > 1 && !depositoId) return setAviso('Elegí en qué caja entra el efectivo.')
    const r = armarCobro(socioId, { ...f, depositoId }, clave)
    if ('error' in r) return setAviso(r.error)
    setAviso(null)
    registrar.mutate(r.payload, {
      onSuccess: setCobro,
      onError: e => { if (claveDeOtroSocio(e)) setClave(nuevaClaveIdempotencia()) },
    })
  }

  /** Otro cobro: otra clave, sin el registrado ni el error del anterior. */
  const reiniciar = () => {
    setCobro(null)
    setAviso(null)
    setClave(nuevaClaveIdempotencia())
    registrar.reset()
  }

  return { registrar, cajas, conCaja, sinCajas, sinCajaUtil, aviso, setAviso, cobro, enviar, reiniciar }
}
