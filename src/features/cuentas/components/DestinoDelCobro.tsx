import React from 'react'
import { Text, View } from 'react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import { ApiError } from '@/core/api/client'
import { Button, Notice } from '@/core/ui/fw'
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
  /** En un pago a un proveedor la cuenta es de donde sale la plata. */
  tituloCuenta?: string
}

/**
 * Transferencia o depósito: en qué cuenta propia entró y la foto del comprobante. Las cuentas las lista quien
 * puede cobrar (MOD_PAGOS:Create, sin saldos); si la lista falla, no se elige y el servidor usa la cuenta del medio.
 * La falla se avisa donde iría el selector, con Reintentar (RED-11); lo que se manda no cambia. Un 404 de un servidor
 * anterior sin MOD_CC:Read no es una falla: ahí nunca hubo lista y no se avisa.
 */
export function DestinoDelCobro({ medio, cuentaPropiaId, comprobanteUrl, onCuenta, onComprobante, onSubiendo, tituloCuenta = 'Cuenta donde entró' }: Props) {
  const c = useColors()
  const { canRead, canDo } = usePermissions()
  const cuentas = useCuentasPropias(canDo('MOD_PAGOS', 'create'), canRead('MOD_CC'))
  const opciones = cuentas.error ? [] : (cuentas.data ?? []).map(k => ({ id: k.id, label: k.nombre }))
  const noCargo = !!cuentas.error && !(cuentas.error instanceof ApiError && cuentas.error.status === 404)
  // Lo que se manda no cambia: la cuenta ya elegida, o ninguna y el servidor usa la del medio.
  const adonde = cuentaPropiaId ? 'a la cuenta que ya elegiste' : 'a la cuenta del medio de pago'

  return (
    <>
      {opciones.length > 0 ? (
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{tituloCuenta}</Text>
      ) : null}
      {opciones.length > 0 ? (
        // Sin elegir, se marca la cuenta del medio, que es la que usa el servidor si no se manda ninguna.
        <ElegirChip titulo={tituloCuenta} opciones={opciones} valor={cuentaPropiaId ?? medio.cuentaPropiaDefaultId ?? null} onCambio={onCuenta} />
      ) : null}
      {noCargo ? (
        <View style={{ gap: space[2] }}>
          <Notice tone="advertencia">{`No se pudieron cargar las cuentas. Si seguís, va ${adonde}.`}</Notice>
          <Button label="Reintentar" accessibilityLabel="Reintentar las cuentas" variant="secundario" onPress={() => { void cuentas.refetch() }} loading={cuentas.isFetching} />
        </View>
      ) : null}
      <FotoDelCobro que="del comprobante" url={comprobanteUrl} subir={subirComprobanteCobro} onUrl={onComprobante} onSubiendo={onSubiendo} />
    </>
  )
}
