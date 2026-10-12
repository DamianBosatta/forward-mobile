import React, { useState } from 'react'
import { Text } from 'react-native'
import { FONT, typeScale, useColors } from '@/libs/theme'
import { BottomSheet, Button, Field, Notice, Segmented } from '@/core/ui/fw'
import { useCrearEvento } from '@/libs/api-client/calendario'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { SelectorDia } from './SelectorDia'

export interface Precarga {
  titulo: string
  descripcion?: string
  /** Número de la venta de la que viene ("A00421"). */
  origen?: string
}

interface Props {
  /** Día propuesto (YYYY-MM-DD). */
  fecha: string
  precarga?: Precarga | null
  onCerrar: () => void
  onCreado: (fecha: string) => void
}

/** Límites del servidor (EventoCalendario.MaxTitulo / MaxDescripcion). */
const MAX_TITULO = 150
const MAX_DESCRIPCION = 500

type Aviso = '0' | '1' | '3'

/**
 * Lámina CalendarioEvento. El servidor guarda el día (sin hora) y no vincula el evento a la
 * venta: "Agendar" desde una venta solo precarga el título y la descripción. Es personal.
 */
export function NuevoEventoSheet({ fecha: inicial, precarga, onCerrar, onCreado }: Props) {
  const c = useColors()
  const crear = useCrearEvento()
  const [titulo, setTitulo] = useState((precarga?.titulo ?? '').slice(0, MAX_TITULO))
  const [descripcion, setDescripcion] = useState((precarga?.descripcion ?? '').slice(0, MAX_DESCRIPCION))
  const [fecha, setFecha] = useState(inicial)
  const [aviso, setAviso] = useState<Aviso>('1')
  const [error, setError] = useState<string | null>(null)

  const guardar = async () => {
    setError(null)
    try {
      await crear.mutateAsync({
        tipo: 'Manual',
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || null,
        fechaInicio: fecha,
        avisarDiasAntes: Number(aviso),
        visibilidad: 'Personal',
      })
      onCreado(fecha)
    } catch (e) {
      setError(mensajeDelServidor(e, 'No se pudo guardar el evento.'))
    }
  }

  return (
    <BottomSheet visible onClose={onCerrar} accessibilityLabel="Nuevo evento">
      <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>Agendar</Text>
      {precarga?.origen ? (
        <Notice tone="info">{`Viene de la venta ${precarga.origen}: el título y la descripción ya están cargados.`}</Notice>
      ) : null}
      <Field label="Título" value={titulo} onChangeText={setTitulo} maxLength={MAX_TITULO} />
      <SelectorDia fecha={fecha} onCambiar={setFecha} />
      <Text style={{ ...typeScale.secundario, fontFamily: FONT.semibold, fontWeight: '600', color: c.text }}>Avisarme</Text>
      <Segmented<Aviso>
        accessibilityLabel="Avisarme"
        value={aviso}
        onChange={setAviso}
        options={[
          { value: '0', label: 'El mismo día' },
          { value: '1', label: '1 día antes' },
          { value: '3', label: '3 días antes' },
        ]}
      />
      <Field label="Descripción (opcional)" value={descripcion} onChangeText={setDescripcion} maxLength={MAX_DESCRIPCION} />
      <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Lo ves solo vos.</Text>
      {error ? <Notice tone="peligro">{error}</Notice> : null}
      <Button label="Guardar evento" disabled={!titulo.trim()} loading={crear.isPending} onPress={guardar} />
    </BottomSheet>
  )
}
