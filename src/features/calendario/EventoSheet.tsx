import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import { BottomSheet, Button, Field, Notice, StatusChip } from '@/core/ui/fw'
import { useQueryClient } from '@tanstack/react-query'
import {
  calendarioKeys, useBorrarEvento, useEditarEvento, useEventoCalendario, useMarcarPagado,
  type EventoCalendario, type EventoDetalle,
} from '@/libs/api-client/calendario'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { chipDe, esRecordatorio, TIPO } from './presentacion'
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

/** La ocurrencia se identifica por su fecha ORIGINAL (la de la clave): no cambia al reprogramarla. */
const fechaOriginalDe = (e: EventoCalendario) => /:(\d{4}-\d{2}-\d{2})$/.exec(e.clave)?.[1] ?? e.fecha

/**
 * Detalle de un evento. Igual que la web, solo los que cargó una persona (`origen` Manual) se
 * editan, se borran y se marcan: el DTO no dice si es editable, y el servidor ya filtró que solo
 * lleguen los que el usuario puede ver (y, por eso, tocar). Cheques y compras son automáticos.
 */
export function EventoSheet({ evento, onCerrar, onMovido }: Props) {
  const c = useColors()
  const { height } = useWindowDimensions()
  const chip = chipDe(evento)
  const original = fechaOriginalDe(evento)
  return (
    <BottomSheet visible onClose={onCerrar} accessibilityLabel={evento.titulo}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ maxHeight: height * 0.8 }} contentContainerStyle={{ gap: space[4] }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2] }}>
            <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text, flex: 1 }}>{evento.titulo}</Text>
            {chip ? <StatusChip estado={chip.estado} label={chip.label} /> : null}
          </View>
          <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
            {`${nombreLargo(moverDia(evento.fecha, 0))} · ${TIPO[evento.tipo] ?? evento.tipo}`}
          </Text>
          {original !== evento.fecha ? (
            <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
              {`Reprogramado: el original era el ${nombreLargo(moverDia(original, 0)).toLowerCase()}.`}
            </Text>
          ) : null}
          {evento.origen === 'Manual' ? (
            <Edicion evento={evento} onCerrar={onCerrar} onMovido={onMovido} />
          ) : (
            <Notice tone="info">Es automático: sale de cheques y compras, y no se cambia desde acá.</Notice>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </BottomSheet>
  )
}

function Edicion({ evento, ...props }: Props) {
  const c = useColors()
  const qc = useQueryClient()
  const detalle = useEventoCalendario(evento.origenId)
  // Borrado: al cerrar la hoja (ya sin quien lo mire) se olvida su detalle, que daría 404.
  const borrado = useRef(false)
  useEffect(() => () => {
    if (borrado.current) qc.removeQueries({ queryKey: calendarioKeys.evento(evento.origenId), exact: true })
  }, [qc, evento.origenId])
  // El PUT reemplaza el evento entero: la primera vez se espera la versión fresca. Después se
  // queda con esa, para que un refetch (vuelve la red) no borre lo que se está escribiendo.
  const [d, setD] = useState<EventoDetalle | null>(null)
  // `isSuccess`: si el refetch falla, react-query conserva el dato viejo con el error.
  if (!d && detalle.isSuccess && !detalle.isFetching) setD(detalle.data)
  if (!d && detalle.isError) {
    return (
      <>
        <Notice tone="peligro">{mensajeDelServidor(detalle.error, 'No se pudo cargar el evento.')}</Notice>
        <Button label="Cerrar" variant="secundario" onPress={props.onCerrar} />
      </>
    )
  }
  if (!d) return <ActivityIndicator color={c.brand} accessibilityLabel="Cargando el evento" />
  return <Formulario d={d} evento={evento} {...props} onBorrado={() => { borrado.current = true; props.onCerrar() }} />
}

function Formulario({ d, evento, onCerrar, onMovido, onBorrado }: Props & { d: EventoDetalle; onBorrado: () => void }) {
  const c = useColors()
  const editar = useEditarEvento()
  const borrar = useBorrarEvento()
  const pagar = useMarcarPagado()
  const [titulo, setTitulo] = useState(d.titulo)
  const [descripcion, setDescripcion] = useState(d.descripcion ?? '')
  const [fecha, setFecha] = useState(d.fechaInicio)
  const [confirmando, setConfirmando] = useState<'borrar' | 'mover' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ocupado = editar.isPending || borrar.isPending || pagar.isPending
  // Lo mismo se manda como Pagado; un recordatorio se lee "hecho".
  const verbo = esRecordatorio(evento) ? 'hecho' : 'pagado'
  const n = d.ocurrencias.length
  const marcas = n === 1 ? '1 marca (pagada u omitida)' : `${n} marcas (pagadas u omitidas)`

  const correr = async (accion: () => Promise<unknown>, listo: () => void, porDefecto: string) => {
    setError(null)
    try {
      await accion()
      listo()
    } catch (e) {
      setConfirmando(null)
      setError(mensajeDelServidor(e, porDefecto))
    }
  }

  const guardar = () => {
    // Al mover el día, el servidor descarta las marcas que ya no caen en el evento: se avisa antes.
    if (fecha !== d.fechaInicio && d.ocurrencias.length > 0 && confirmando !== 'mover') {
      setConfirmando('mover')
      return
    }
    // Lo que mobile no edita (tipo, recurrencia, monto, proveedor, aviso) viaja como estaba.
    void correr(() => editar.mutateAsync({
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
  }

  const marcar = (pagado: boolean) =>
    correr(() => pagar.mutateAsync({ id: d.id, fecha: fechaOriginalDe(evento), pagado }), onCerrar, 'No se pudo marcar el evento.')

  return (
    <>
      {confirmando ? null : evento.estado === 'Pagado' ? (
        <Button label={`Desmarcar ${verbo}`} variant="secundario" disabled={ocupado} loading={pagar.isPending} onPress={() => void marcar(false)} />
      ) : evento.estado !== 'Cancelado' ? (
        <Button label={`Marcar ${verbo}`} variant="secundario" disabled={ocupado} loading={pagar.isPending} onPress={() => void marcar(true)} />
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
      {confirmando === 'borrar' ? (
        <>
          <Notice tone="advertencia">Se borra el evento y todas sus fechas. No se puede deshacer.</Notice>
          <Button label="Sí, borrar" variant="peligro" disabled={ocupado} loading={borrar.isPending} onPress={() => void correr(() => borrar.mutateAsync(d.id), onBorrado, 'No se pudo borrar el evento.')} />
          <Button label="No borrar" variant="secundario" disabled={ocupado} onPress={() => setConfirmando(null)} />
        </>
      ) : confirmando === 'mover' ? (
        <>
          {/* El servidor descarta solo las marcas que quedan fuera de la serie nueva. */}
          <Notice tone="advertencia">
            {d.recurrencia
              ? `Tiene ${marcas}. Al cambiar el primer día se pierden las que ya no caigan en la serie.`
              : n === 1 ? 'Se pierde su marca (pagada u omitida).' : `Se pierden sus ${marcas}.`}
          </Notice>
          <Button label="Sí, guardar" disabled={!titulo.trim() || ocupado} loading={editar.isPending} onPress={guardar} />
          <Button label="No guardar" variant="secundario" disabled={ocupado} onPress={() => setConfirmando(null)} />
        </>
      ) : (
        <>
          <Button label="Guardar cambios" disabled={!titulo.trim() || ocupado} loading={editar.isPending} onPress={guardar} />
          <Button label="Borrar evento" variant="secundario" disabled={ocupado} onPress={() => setConfirmando('borrar')} />
        </>
      )}
    </>
  )
}
