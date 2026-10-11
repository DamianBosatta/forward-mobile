import { useCallback, useState } from 'react'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { useQueryClient } from '@tanstack/react-query'
import { guardarBorradorVenta, useDescartarBorradorVenta, useIniciarBorradorVenta, ventasKeys } from '@/libs/api-client/ventas'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { useAutoguardado } from './useAutoguardado'
import { aAutoguardado, type AutoguardadoVenta } from '../lib/payload'

/**
 * Borrador de la venta nueva (mismo flujo que la web): nace en el servidor al elegir el cliente y
 * desde ahí se autoguarda. Si no se puede crear, la venta se sigue armando sin autoguardado.
 */
export function useBorradorVenta(valores: AutoguardadoVenta) {
  // `base`: lo que tiene el servidor al nacer el borrador (vacío); sin base, lo que hay en pantalla (retomar).
  const [borrador, setBorrador] = useState<{ id: string; version: number; base?: AutoguardadoVenta } | null>(null)
  const [errorAlCrear, setErrorAlCrear] = useState<string | null>(null)
  const iniciar = useIniciarBorradorVenta()
  const descartarMut = useDescartarBorradorVenta()
  const qc = useQueryClient()
  const guardar = useCallback(
    async (v: AutoguardadoVenta, version: number) => {
      const r = await guardarBorradorVenta(borrador!.id, version, { ...v })
      // El detalle en caché ya no es el del servidor: quien reabra el borrador tiene que traer el vigente (sin recargar ahora: nadie lo está mirando).
      void qc.invalidateQueries({ queryKey: ventasKeys.detail(borrador!.id), refetchType: 'none' })
      return r.version
    },
    [borrador, qc],
  )
  const autoguardado = useAutoguardado({ borradorId: borrador?.id, versionInicial: borrador?.version ?? 0, base: borrador?.base, valores, guardar })

  const crear = async (clienteId: string) => {
    setErrorAlCrear(null)
    try {
      const r = await iniciar.mutateAsync({ clienteId, depositoId: DEPOSITO_CENTRAL_ID })
      // Lo que se cargó mientras el POST estaba en vuelo no está en el servidor: el autoguardado lo manda.
      setBorrador({ id: r.ventaId, version: r.version, base: aAutoguardado([]) })
    } catch (e) {
      setErrorAlCrear(mensajeDelServidor(e, 'No se pudo crear el borrador.'))
    }
  }
  /** Retoma un borrador que ya existe en el servidor (no crea otro). */
  const retomar = (id: string, version: number) => setBorrador({ id, version })
  const descartar = async () => {
    if (borrador) await descartarMut.mutateAsync(borrador.id)
    setBorrador(null)
  }

  const etiqueta = iniciar.isPending ? 'Creando borrador…'
    : errorAlCrear ? 'Sin autoguardado'
    : !borrador ? undefined
    : autoguardado.estado === 'guardando' ? 'Guardando…'
    : autoguardado.estado === 'error' || autoguardado.estado === 'conflicto' ? 'Sin guardar' : 'Guardado'

  return { borrador, errorAlCrear, crear, retomar, descartar, etiqueta, ...autoguardado }
}
