import { useState } from 'react'
import { nuevaClaveIdempotencia } from '@/features/venta-nueva/lib/payload'
import { claveDeOtroSocio, useCajaDelCobro, useRegistrarCobro, type CobroRegistrado } from '../api/cobros'
import { armarCobro, entraACaja, type FormCobro } from '../lib/cobro'
import type { Contraparte } from '../lib/contraparte'

/**
 * El envío de un cobro, compartido por el formulario de siempre (`RegistrarCobro`) y el cobro en pasos
 * (`CobroEnPasos`): la clave de idempotencia, la caja del depósito de la sesión y el POST.
 *
 * Una clave por cobro, la misma en cada reintento (tocar de nuevo tras un corte no lo carga dos veces);
 * «Registrar otro cobro» (`reiniciar`) arranca otra. Un cobro duplicado es peor que perder una edición: se edite
 * lo que se edite del formulario (monto, medio, cheque, referencia) la clave NO cambia, y si el cobro anterior sí
 * se había grabado el servidor lo dice con un 409 y lo nuevo no se guarda. Solo se cambia si el servidor dice que
 * la clave era de otro socio.
 *
 * El efectivo entra a la caja del depósito de la sesión, como en la web (`useCajaDelCobro`): no se elige caja. Sin
 * esa caja abierta, sin saber todavía si lo está o con un error al pedirla, no se cobra en efectivo (la web tampoco).
 *
 * `pedirCajas`: pide la caja aunque ninguna línea del formulario entre a caja todavía (el medio que se está
 * cargando sí entra). `contraparte`: el pago a un proveedor manda el mismo POST (ver `armarCobro`); su efectivo
 * sale de la caja del depósito de la sesión, que sin CAP_VER_TODOS_LOS_DEPOSITOS es siempre el propio (como la web).
 */
export function useEnvioDelCobro(socioId: string, f: FormCobro, pedirCajas = false, contraparte: Contraparte = 'cliente') {
  const registrar = useRegistrarCobro()
  const [clave, setClave] = useState(nuevaClaveIdempotencia)
  // Con el cobro combinado, cualquiera de las líneas puede ser efectivo.
  const conCaja = entraACaja(f)
  const cajaDelCobro = useCajaDelCobro(conCaja || pedirCajas)
  const { caja } = cajaDelCobro
  const [aviso, setAviso] = useState<string | null>(null)
  const [cobro, setCobro] = useState<CobroRegistrado | null>(null)

  // Con caja: sin respuesta todavía, con error (aunque haya datos viejos) o sin la caja abierta, no se cobra.
  const sinCajaUtil = conCaja && (!caja.isSuccess || !!caja.error || !caja.data?.abierta)

  const enviar = (subiendo: boolean) => {
    if (registrar.isPending || subiendo) return
    // Con caja, sin la caja del depósito de la sesión abierta no se manda (como la web).
    if (sinCajaUtil) return
    const depositoId = conCaja ? cajaDelCobro.depositoId : null
    const r = armarCobro(socioId, { ...f, depositoId }, clave, contraparte)
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

  return { registrar, cajaDelCobro, conCaja, sinCajaUtil, aviso, setAviso, cobro, enviar, reiniciar }
}
