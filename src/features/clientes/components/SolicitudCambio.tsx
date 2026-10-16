import React, { useState } from 'react'
import { Text, View } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, Field, Notice } from '@/core/ui/fw'
import { api } from '@/core/api/client'
import type { SocioDetailDto } from '@/libs/api-client/types'
import type { components } from '@/libs/api-client/generated/schema'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'

type Solicitud = components['schemas']['SolicitarCambioSocioCommand']
type Sensibles = Pick<SocioDetailDto, 'id' | 'razonSocial' | 'cuit' | 'direccion'>

export const SOLICITUD_ENVIADA = 'Solicitud enviada. Un administrador la va a revisar; te llega el resultado a la bandeja.'

/** Solo viajan los campos que cambiaron: el servidor arma el antes y el después contra lo que tiene guardado. */
export function armarSolicitud(actual: Sensibles, propuesto: { razonSocial: string; cuit: string; direccion: string }, motivo: string): Solicitud {
  const cambio = (campo: keyof typeof propuesto) => {
    const nuevo = propuesto[campo].trim()
    return nuevo && nuevo !== (actual[campo] ?? '').trim() ? { [campo]: nuevo } : {}
  }
  return { socioId: actual.id, ...cambio('razonSocial'), ...cambio('cuit'), ...cambio('direccion'), motivo: motivo.trim() }
}

/**
 * Pedir el cambio de la dirección, la razón social o el CUIT (`POST /socios-comerciales/{id}/solicitudes-cambio`):
 * un no administrador no los cambia directo. Qué se puede pedir y si falta el motivo lo dice el servidor.
 */
export function SolicitudCambio({ cliente, onCerrar }: { cliente: Sensibles; onCerrar: () => void }) {
  const c = useColors()
  const [propuesto, setPropuesto] = useState({ razonSocial: cliente.razonSocial ?? '', cuit: cliente.cuit ?? '', direccion: cliente.direccion ?? '' })
  const [motivo, setMotivo] = useState('')
  const enviar = useMutation({
    mutationFn: (s: Solicitud) => api.post<string>(`/api/v1/socios-comerciales/${cliente.id}/solicitudes-cambio`, s),
  })
  const campo = (k: keyof typeof propuesto) => (v: string) => setPropuesto(p => ({ ...p, [k]: v }))

  return (
    <View style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[4], gap: space[3] }}>
      <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>Pedir cambio de datos</Text>
      {enviar.isSuccess ? (
        <>
          <Notice tone="exito">{SOLICITUD_ENVIADA}</Notice>
          <Button label="Listo" variant="secundario" onPress={onCerrar} />
        </>
      ) : (
        <>
          <Field label="Nueva dirección de entrega" value={propuesto.direccion} onChangeText={campo('direccion')} />
          <Field label="Nueva razón social" value={propuesto.razonSocial} onChangeText={campo('razonSocial')} />
          <Field label="Nuevo CUIT" value={propuesto.cuit} onChangeText={campo('cuit')} keyboardType="number-pad" />
          <Field label="Motivo" value={motivo} onChangeText={setMotivo} help="Lo lee el administrador para decidir." />
          {enviar.error ? <Notice tone="peligro">{mensajeDelServidor(enviar.error, 'No se pudo enviar la solicitud.')}</Notice> : null}
          <Button label="Enviar solicitud" loading={enviar.isPending} disabled={enviar.isPending} onPress={() => enviar.mutate(armarSolicitud(cliente, propuesto, motivo))} />
          <Button label="Cancelar" variant="secundario" onPress={onCerrar} />
        </>
      )}
    </View>
  )
}
