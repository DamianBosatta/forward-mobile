import React, { useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import { BottomSheet, Button, Field, Notice, StatusChip } from '@/core/ui/fw'
import {
  useBorrarEvento, useEditarEvento, useEventoCalendario, useMarcarPagado,
  type EventoCalendario, type EventoDetalle,
} from '@/libs/api-client/calendario'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { CHIP, TIPO } from './presentacion'
import { moverDia, nombreLargo } from './semana'
import { SelectorDia } from './SelectorDia'

/** Límites del servidor (EventoCalendario.MaxTitulo / MaxDescripcion). */
const MAX_TITULO = 150
const MAX_DESCRIPCION = 500

interface Props {
  evento: EventoCalendario
  onCerrar: () => void
  /** Se guardó un evento que no se repite: el calendario pasa a su día (puede haber cambiado). */
  onMovido: (fecha: string) => void
}

/**
 * Detalle de un evento. Igual que la web, solo los que cargó una persona (`origen` Manual) se
 * editan, se borran y se marcan: el DTO no dice si es editable, y el servidor ya filtró que solo
 * lleguen los que el usuario puede ver (y, por eso, tocar). Cheques y compras son automáticos.
 */
export function EventoSheet({ evento, onCerrar, onMovido }: Props) {
  const c = useColors()
  const chip = CHIP[evento.estado]
  return (
    <BottomSheet visible onClose={onCerrar} accessibilityLabel={evento.titulo}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2] }}>
        <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text, flex: 1 }}>{evento.titulo}</Text>
        {chip ? <StatusChip estado={chip.estado} label={chip.label} /> : null}
      </View>
      <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
        {`${nombreLargo(moverDia(evento.fecha, 0))} · ${TIPO[evento.tipo] ?? evento.tipo}`}
      </Text>
      {evento.origen === 'Manual' ? (
        <Edicion evento={evento} onCerrar={onCerrar} onMovido={onMovido} />
      ) : (
        <Notice tone="info">Es automático: sale de cheques y compras, y no se cambia desde acá.</Notice>
      )}
    </BottomSheet>
  )
}

function Edicion({ evento, ...props }: Props) {
  const c = useColors()
  const detalle = useEventoCalendario(evento.origenId)
  if (detalle.isError) return <Notice tone="peligro">No se pudo cargar el evento.</Notice>
  // El PUT reemplaza el evento entero: se espera la versión fresca para no pisar algo más nuevo.
  if (!detalle.data || detalle.isFetching) return <ActivityIndicator color={c.brand} accessibilityLabel="Cargando el evento" />
  return <Formulario key={detalle.dataUpdatedAt} d={detalle.data} evento={evento} {...props} />
}

function Formulario({ d, evento, onCerrar, onMovido }: Props & { d: EventoDetalle }) {
  const c = useColors()
  const editar = useEditarEvento()
  const borrar = useBorrarEvento()
  const pagar = useMarcarPagado()
  const [titulo, setTitulo] = useState(d.titulo)
  const [descripcion, setDescripcion] = useState(d.descripcion ?? '')
  const [fecha, setFecha] = useState(d.fechaInicio)
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // La ocurrencia se marca por su fecha ORIGINAL (la de la clave): no cambia al reprogramarla.
  const fechaOriginal = /:(\d{4}-\d{2}-\d{2})$/.exec(evento.clave)?.[1] ?? evento.fecha
  const ocupado = editar.isPending || borrar.isPending || pagar.isPending

  const correr = async (accion: () => Promise<unknown>, listo: () => void, porDefecto: string) => {
    setError(null)
    try {
      await accion()
      listo()
    } catch (e) {
      setConfirmando(false)
      setError(mensajeDelServidor(e, porDefecto))
    }
  }

  // Lo que mobile no edita (tipo, recurrencia, monto, proveedor, aviso) viaja como estaba.
  const guardar = () => correr(() => editar.mutateAsync({
    id: d.id,
    tipo: d.tipo,
    subtipo: d.subtipo ?? null,
    titulo: titulo.trim(),
    descripcion: descripcion.trim() || null,
    fechaInicio: fecha,
    recurrencia: d.recurrencia ?? undefined,
    montoEstimado: d.montoEstimado ?? null,
    socioComercialId: d.socioComercialId ?? null,
    avisarDiasAntes: d.avisarDiasAntes,
  }), () => (d.recurrencia ? onCerrar() : onMovido(fecha)), 'No se pudo guardar el evento.')

  const marcar = (pagado: boolean) =>
    correr(() => pagar.mutateAsync({ id: d.id, fecha: fechaOriginal, pagado }), onCerrar, 'No se pudo marcar el evento.')

  return (
    <>
      {evento.estado === 'Pagado' ? (
        <Button label="Desmarcar pagado" variant="secundario" disabled={ocupado} loading={pagar.isPending} onPress={() => void marcar(false)} />
      ) : evento.estado !== 'Cancelado' ? (
        <Button label="Marcar pagado" variant="secundario" disabled={ocupado} loading={pagar.isPending} onPress={() => void marcar(true)} />
      ) : null}
      <Field label="Título" value={titulo} onChangeText={setTitulo} maxLength={MAX_TITULO} />
      {d.recurrencia ? (
        <SelectorDia fecha={fecha} onCambiar={setFecha} etiqueta="Primer día de la serie" nota="Se repite: cambiar el primer día mueve toda la serie." />
      ) : (
        <SelectorDia fecha={fecha} onCambiar={setFecha} />
      )}
      <Field label="Descripción (opcional)" value={descripcion} onChangeText={setDescripcion} maxLength={MAX_DESCRIPCION} />
      <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
        {d.visibilidad === 'Personal' ? 'Lo ves solo vos.' : 'Lo ve Administración.'}
      </Text>
      {error ? <Notice tone="peligro">{error}</Notice> : null}
      {confirmando ? (
        <>
          <Notice tone="advertencia">Se borra el evento y todas sus fechas. No se puede deshacer.</Notice>
          <Button label="Sí, borrar" variant="peligro" loading={borrar.isPending} onPress={() => void correr(() => borrar.mutateAsync(d.id), onCerrar, 'No se pudo borrar el evento.')} />
          <Button label="No borrar" variant="secundario" disabled={ocupado} onPress={() => setConfirmando(false)} />
        </>
      ) : (
        <>
          <Button label="Guardar cambios" disabled={!titulo.trim() || ocupado} loading={editar.isPending} onPress={() => void guardar()} />
          <Button label="Borrar evento" variant="secundario" disabled={ocupado} onPress={() => setConfirmando(true)} />
        </>
      )}
    </>
  )
}
