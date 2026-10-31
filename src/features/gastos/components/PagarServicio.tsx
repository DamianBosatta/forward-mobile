import React, { useState } from 'react'
import { ActivityIndicator, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { space, useColors } from '@/libs/theme'
import { MOTIVO_SIN_PERMISO_DE_SERVICIO, MotivoDeshabilitado } from '@/core/ui/fw/MotivoDeshabilitado'
import { Button, Field, FormContainer, Notice } from '@/core/ui/fw'
import { useToast } from '@/core/ui/Toast'
import { usePermissions } from '@/core/auth/RequirePermission'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { useCuentasPropias, useMediosDeCobro } from '@/features/cuentas/api/cobros'
import { subirComprobanteCobro } from '@/features/cuentas/api/fotos'
import { ElegirChip } from '@/features/cuentas/components/ElegirChip'
import { FotoDelCobro } from '@/features/cuentas/components/FotoDelCobro'
import { ElegirCuenta } from '@/features/tesoreria/components/ElegirCuenta'
import { useRegistrarGasto, useTiposGasto } from '../api/gastos'
import { usePuedePagarServicio } from '../lib/permiso'
import { cuerpoDelGasto, validarServicio, type FormServicio } from '../lib/servicio'

const VACIO: FormServicio = { monto: '', tipoGastoId: null, descripcion: '', medioPagoId: null, requiereCaja: false, cuentaOrigenId: null, comprobanteUrl: null }

/**
 * Pagar un servicio (lámina tesoreria-pagar-servicio): registra un gasto (luz, gas, alquiler, flete) con
 * `POST /gastos`. Concepto y medio salen de los catálogos del servidor; el cheque queda afuera (L22) y la
 * fecha es la de hoy (el servidor la pone). En efectivo no se elige cuenta: sale de la caja.
 */
export function PagarServicio({ onListo }: { onListo: () => void }) {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const { canRead } = usePermissions()
  const puede = usePuedePagarServicio()
  const tipos = useTiposGasto(puede)
  const medios = useMediosDeCobro()
  const cuentas = useCuentasPropias(puede, canRead('MOD_CC'))
  const registrar = useRegistrarGasto()
  const [f, setF] = useState<FormServicio>(VACIO)
  const [subiendo, setSubiendo] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const conceptos = (tipos.data ?? []).filter(t => t.activo && t.id)
  // El cheque tiene su propio flujo (L22): acá solo efectivo, transferencia y similares.
  const mediosDePago = (medios.data ?? []).filter(m => m.activo && m.id && !m.esCheque)

  const enviar = () => {
    if (registrar.isPending || subiendo) return
    const falta = validarServicio(f)
    setAviso(falta)
    if (falta) return
    const concepto = conceptos.find(t => t.id === f.tipoGastoId)?.nombre ?? ''
    registrar.mutate(cuerpoDelGasto(f, concepto), {
      onSuccess: () => {
        toast.show('Pago registrado', 'success')
        onListo()
      },
    })
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space[4] }} keyboardShouldPersistTaps="handled">
        <FormContainer style={{ gap: space[4] }}>
          {tipos.isLoading || medios.isLoading ? <ActivityIndicator color={c.brandInk} /> : null}
          {tipos.error ? <Notice tone="peligro">{mensajeDelServidor(tipos.error, 'No se pudieron cargar los conceptos.')}</Notice> : null}
          {medios.error ? <Notice tone="peligro">{mensajeDelServidor(medios.error, 'No se pudieron cargar los medios de pago.')}</Notice> : null}

          <Field label="Monto" value={f.monto} onChangeText={monto => setF(p => ({ ...p, monto }))} keyboardType="decimal-pad" alignRight />
          <ElegirChip
            titulo="Concepto"
            opciones={conceptos.map(t => ({ id: t.id!, label: t.nombre ?? '' }))}
            valor={f.tipoGastoId}
            onCambio={tipoGastoId => setF(p => ({ ...p, tipoGastoId }))}
          />
          <Field label="Descripción (opcional)" value={f.descripcion} onChangeText={descripcion => setF(p => ({ ...p, descripcion }))} maxLength={200} />
          <ElegirChip
            titulo="Medio de pago"
            opciones={mediosDePago.map(m => ({ id: m.id!, label: m.nombre ?? '' }))}
            valor={f.medioPagoId}
            onCambio={id => setF(p => ({ ...p, medioPagoId: id, requiereCaja: !!mediosDePago.find(m => m.id === id)?.requiereCaja, cuentaOrigenId: null }))}
          />
          {f.medioPagoId && !f.requiereCaja ? (
            <>
              {cuentas.error ? <Notice tone="peligro">{mensajeDelServidor(cuentas.error, 'No se pudieron cargar las cuentas.')}</Notice> : null}
              <ElegirCuenta titulo="Cuenta de origen" cuentas={cuentas.data ?? []} valor={f.cuentaOrigenId} onCambio={cuentaOrigenId => setF(p => ({ ...p, cuentaOrigenId }))} />
            </>
          ) : null}
          <FotoDelCobro que="del comprobante" url={f.comprobanteUrl} subir={subirComprobanteCobro} onUrl={comprobanteUrl => setF(p => ({ ...p, comprobanteUrl }))} onSubiendo={setSubiendo} />

          {aviso ? <Notice tone="advertencia">{aviso}</Notice> : null}
          {registrar.error ? <Notice tone="peligro">{mensajeDelServidor(registrar.error, 'No se pudo registrar el pago.')}</Notice> : null}
        </FormContainer>
      </ScrollView>
      <View style={{ padding: space[4], paddingBottom: space[4] + insets.bottom, gap: space[2], borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface }}>
        <Button label="Registrar pago" loading={registrar.isPending} disabled={registrar.isPending || subiendo || !puede} onPress={enviar} />
        {!puede ? <MotivoDeshabilitado>{MOTIVO_SIN_PERMISO_DE_SERVICIO}</MotivoDeshabilitado> : null}
      </View>
    </View>
  )
}
