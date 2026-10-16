import React from 'react'
import { Text } from 'react-native'
import { typeScale, useColors } from '@/libs/theme'
import { usePermissions } from '@/core/auth/RequirePermission'
import { useCuentasPropias, type MedioDePago } from '../api/cobros'
import { subirComprobanteCobro } from '../api/fotos'
import { ElegirChip } from './ElegirChip'
import { FotoDelCobro } from './FotoDelCobro'

interface Props {
  medio: Pick<MedioDePago, 'cuentaPropiaDefaultId'>
  cuentaPropiaId: string | null
  comprobanteUrl: string | null
  onCuenta: (id: string) => void
  onComprobante: (url: string) => void
  onSubiendo: (subiendo: boolean) => void
}

/**
 * Transferencia o depósito: en qué cuenta propia entró y la foto del comprobante. Listar las cuentas pide
 * MOD_CC:Read; sin ese permiso (o si la lista falla) no se elige y el servidor usa la cuenta del medio.
 */
export function DestinoDelCobro({ medio, cuentaPropiaId, comprobanteUrl, onCuenta, onComprobante, onSubiendo }: Props) {
  const c = useColors()
  const { canRead } = usePermissions()
  const cuentas = useCuentasPropias(canRead('MOD_CC'))
  const opciones = cuentas.error ? [] : (cuentas.data ?? []).map(k => ({ id: k.id, label: k.nombre }))

  return (
    <>
      {opciones.length > 0 ? (
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Cuenta donde entró</Text>
      ) : null}
      {opciones.length > 0 ? (
        // Sin elegir, se marca la cuenta del medio, que es la que usa el servidor si no se manda ninguna.
        <ElegirChip titulo="Cuenta donde entró" opciones={opciones} valor={cuentaPropiaId ?? medio.cuentaPropiaDefaultId ?? null} onCambio={onCuenta} />
      ) : null}
      <FotoDelCobro que="del comprobante" url={comprobanteUrl} subir={subirComprobanteCobro} onUrl={onComprobante} onSubiendo={onSubiendo} />
    </>
  )
}
