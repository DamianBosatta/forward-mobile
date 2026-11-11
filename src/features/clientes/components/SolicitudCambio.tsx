import React, { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { Check } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { BottomSheet, Button, Field, Notice } from '@/core/ui/fw'
import { api } from '@/core/api/client'
import type { SocioDetailDto } from '@/libs/api-client/types'
import type { components } from '@/libs/api-client/generated/schema'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'

type Solicitud = components['schemas']['SolicitarCambioSocioCommand']
type Sensibles = Pick<SocioDetailDto, 'id' | 'razonSocial' | 'cuit' | 'direccion'>

export const SOLICITUD_ENVIADA = 'Solicitud enviada. Un administrador la va a revisar; te llega el resultado a la bandeja.'
export const TITULO_SOLICITUD = 'Pedir cambio de datos'

/** Solo viajan los campos que cambiaron: el servidor arma el antes y el después contra lo que tiene guardado. */
export function armarSolicitud(actual: Sensibles, propuesto: { razonSocial: string; cuit: string; direccion: string }, motivo: string): Solicitud {
  const cambio = (campo: keyof typeof propuesto) => {
    const nuevo = propuesto[campo].trim()
    return nuevo && nuevo !== (actual[campo] ?? '').trim() ? { [campo]: nuevo } : {}
  }
  return { socioId: actual.id, ...cambio('razonSocial'), ...cambio('cuit'), ...cambio('direccion'), motivo: motivo.trim() }
}

/** Los cuatro campos, el envío y su error: lo mismo en la tarjeta (proveedores) y en la hoja (clientes). */
function useSolicitud(cliente: Sensibles) {
  const [propuesto, setPropuesto] = useState({ razonSocial: cliente.razonSocial ?? '', cuit: cliente.cuit ?? '', direccion: cliente.direccion ?? '' })
  const [motivo, setMotivo] = useState('')
  const enviar = useMutation({
    mutationFn: (s: Solicitud) => api.post<string>(`/api/v1/socios-comerciales/${cliente.id}/solicitudes-cambio`, s),
  })
  const campo = (k: keyof typeof propuesto) => (v: string) => setPropuesto(p => ({ ...p, [k]: v }))
  const formulario = (
    <>
      <Field label="Nueva dirección de entrega" value={propuesto.direccion} onChangeText={campo('direccion')} />
      <Field label="Nueva razón social" value={propuesto.razonSocial} onChangeText={campo('razonSocial')} />
      <Field label="Nuevo CUIT" value={propuesto.cuit} onChangeText={campo('cuit')} keyboardType="number-pad" />
      <Field label="Motivo" value={motivo} onChangeText={setMotivo} help="Lo lee el administrador para decidir." />
      {enviar.error ? <Notice tone="peligro">{mensajeDelServidor(enviar.error, 'No se pudo enviar la solicitud.')}</Notice> : null}
      <Button label="Enviar solicitud" loading={enviar.isPending} disabled={enviar.isPending} onPress={() => enviar.mutate(armarSolicitud(cliente, propuesto, motivo))} />
    </>
  )
  return { enviada: enviar.isSuccess, formulario }
}

/**
 * Pedir el cambio de la dirección, la razón social o el CUIT (`POST /socios-comerciales/{id}/solicitudes-cambio`):
 * un no administrador no los cambia directo. Qué se puede pedir y si falta el motivo lo dice el servidor.
 * Tarjeta dentro de la ficha (proveedores); la ficha de cliente usa `SolicitudCambioSheet`.
 */
export function SolicitudCambio({ cliente, onCerrar }: { cliente: Sensibles; onCerrar: () => void }) {
  const c = useColors()
  const { enviada, formulario } = useSolicitud(cliente)

  return (
    <View style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[4], gap: space[3] }}>
      <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>{TITULO_SOLICITUD}</Text>
      {enviada ? (
        <>
          <Notice tone="exito">{SOLICITUD_ENVIADA}</Notice>
          <Button label="Listo" variant="secundario" onPress={onCerrar} />
        </>
      ) : (
        <>
          {formulario}
          <Button label="Cancelar" variant="secundario" onPress={onCerrar} />
        </>
      )}
    </View>
  )
}

function ContenidoDeLaHoja({ cliente, onCerrar }: { cliente: Sensibles; onCerrar: () => void }) {
  const c = useColors()
  const { enviada, formulario } = useSolicitud(cliente)
  if (enviada) {
    // Confirmación en la misma hoja, con el check de "Venta guardada" (frame 9).
    return (
      <View style={{ alignItems: 'center', gap: space[4] }}>
        <View testID="solicitud-enviada-marca" style={{ width: 56, height: 56, borderRadius: radii.pastilla, backgroundColor: c.action, alignItems: 'center', justifyContent: 'center' }}>
          <Check size={28} color={c.onAction} strokeWidth={2.5} />
        </View>
        <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text, textAlign: 'center' }}>Solicitud enviada</Text>
        <Text accessibilityLiveRegion="polite" style={{ ...typeScale.secundario, color: c.textSecondary, textAlign: 'center' }}>{SOLICITUD_ENVIADA}</Text>
        <View style={{ alignSelf: 'stretch' }}>
          <Button label="Listo" variant="secundario" onPress={onCerrar} />
        </View>
      </View>
    )
  }
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space[4] }}>
      <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>{TITULO_SOLICITUD}</Text>
      {formulario}
      <Button label="Cancelar" variant="secundario" onPress={onCerrar} />
    </ScrollView>
  )
}

/**
 * La misma solicitud como hoja desde abajo sobre la ficha del cliente (frames 8 y 9, como "Editar línea" de la venta).
 * Cada apertura arranca con los valores actuales: la hoja se desmonta al cerrarse.
 */
export function SolicitudCambioSheet({ visible, cliente, onCerrar }: { visible: boolean; cliente: Sensibles; onCerrar: () => void }) {
  return (
    <BottomSheet visible={visible} onClose={onCerrar} accessibilityLabel={TITULO_SOLICITUD}>
      {visible ? <ContenidoDeLaHoja cliente={cliente} onCerrar={onCerrar} /> : null}
    </BottomSheet>
  )
}
