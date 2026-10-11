import React, { useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { FONT, radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, Field, Notice, Segmented, TopBar } from '@/core/ui/fw'
import type { ParadaDto } from '@/libs/api-client/types'
import { MOTIVOS_NO_ENTREGA } from './hojaDeRuta'

export interface ReporteParada {
  entregado: boolean
  nombreReceptor?: string
  motivoRechazo?: string
  observaciones?: string
}

interface Props {
  parada: ParadaDto
  numero: number
  enviando: boolean
  error: string | null
  onCerrar: () => void
  onConfirmar: (r: ReporteParada) => void
}

type Resultado = 'entregado' | 'noEntregado'

/**
 * Láminas ChoferEntrega y ChoferNoEntrega, sin la foto ni el cobro: esos llegan con 5.1b/c/d
 * (el comando de hoy no los recibe). Monta una vez por parada: el estado arranca limpio.
 */
export function ReportarParada({ parada, numero, enviando, error, onCerrar, onConfirmar }: Props) {
  const c = useColors()
  const { bottom } = useSafeAreaInsets()
  const [resultado, setResultado] = useState<Resultado>('entregado')
  const [receptor, setReceptor] = useState('')
  const [motivo, setMotivo] = useState<string | null>(null)
  const [observaciones, setObservaciones] = useState('')

  const entregado = resultado === 'entregado'
  // La web no deja confirmar sin quién recibió (el servidor guarda la constancia con ese nombre).
  const listo = entregado ? receptor.trim().length > 0 : motivo !== null
  const obs = observaciones.trim() || undefined

  const confirmar = () => {
    if (!listo || enviando) return
    onConfirmar(
      entregado
        ? { entregado: true, nombreReceptor: receptor.trim(), observaciones: obs }
        : { entregado: false, motivoRechazo: motivo ?? undefined, observaciones: obs },
    )
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onCerrar}>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar
          title="Reportar entrega"
          subtitle={`Parada ${numero} · ${parada.direccion} · ${parada.clienteNombre}`}
          leading={{ kind: 'atras', onPress: onCerrar }}
        />
        <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4] }} keyboardShouldPersistTaps="handled">
          <Segmented<Resultado>
            accessibilityLabel="Resultado"
            value={resultado}
            onChange={setResultado}
            options={[
              { value: 'entregado', label: 'Entregado' },
              { value: 'noEntregado', label: 'No se pudo entregar' },
            ]}
          />
          {entregado ? (
            <Field label="Quién recibió" value={receptor} onChangeText={setReceptor} placeholder="Nombre de quien firma" />
          ) : (
            <View accessibilityLabel="Motivo" style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[4], gap: space[2] }}>
              <Text style={{ ...typeScale.seccion, color: c.text }}>Motivo</Text>
              {MOTIVOS_NO_ENTREGA.map((m) => {
                const elegido = motivo === m
                return (
                  <Pressable
                    key={m}
                    onPress={() => setMotivo(m)}
                    accessibilityRole="radio"
                    accessibilityLabel={m}
                    accessibilityState={{ checked: elegido }}
                    style={{
                      minHeight: space[12],
                      justifyContent: 'center',
                      paddingHorizontal: space[3],
                      borderRadius: radii.campo,
                      borderWidth: elegido ? 2 : 1,
                      borderColor: elegido ? c.brand : c.border,
                      backgroundColor: elegido ? c.brandSoft : c.surface,
                    }}
                  >
                    <Text style={{ ...typeScale.cuerpo, ...(elegido ? { fontFamily: FONT.semibold, fontWeight: '600' } : null), color: elegido ? c.brandInk : c.text }}>
                      {m}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          )}
          <Field label="Observaciones" value={observaciones} onChangeText={setObservaciones} placeholder="Algo que la oficina tenga que saber" />
          {error ? <Notice tone="peligro">{error}</Notice> : null}
        </ScrollView>
        <View style={{ backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border, padding: space[4], paddingBottom: space[4] + bottom }}>
          <Button
            label={entregado ? 'Confirmar entrega' : 'Confirmar: no se entregó'}
            variant={entregado ? 'primario' : 'peligro'}
            disabled={!listo}
            loading={enviando}
            onPress={confirmar}
          />
        </View>
      </View>
    </Modal>
  )
}
