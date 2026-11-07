import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { space, typeScale, useColors } from '@/libs/theme'
import { useTeclado } from '@/core/utils/useTecladoVisible'
import { BottomSheet, Button, Field, Notice, OptionCard, StatusChip } from '@/core/ui/fw'
import { useQueryClient } from '@tanstack/react-query'
import {
  calendarioKeys, useBorrarEvento, useEditarEvento, useEventoCalendario, useMarcarPagado,
  type EventoCalendario, type EventoDetalle,
} from '@/libs/api-client/calendario'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { chipDe, esHoraValida, esRecordatorio, textoSemanal, TIPO } from './presentacion'
import { moverDia, nombreLargo } from './semana'
import { SelectorDia } from './SelectorDia'
import { usePuedeCobrar } from '@/features/cuentas/lib/permiso'
import { cobroAbierto, depositoDe, ESTADOS_DE_TAREA, esTareaAsignada, type EstadoTarea, type EventoConTarea } from './tarea'
import { useCambiarEstadoTarea } from './api'

/** Límites del servidor (EventoCalendario.MaxTitulo / MaxDescripcion). */
const MAX_TITULO = 150
const MAX_DESCRIPCION = 500
/** Lo mínimo que se deja de scroll aunque el teclado y el pie ocupen casi todo. */
const ALTO_MINIMO = 128

interface Props {
  evento: EventoConTarea
  onCerrar: () => void
  /** Se guardó un evento que no se repite: el calendario pasa a su día (puede haber cambiado). */
  onMovido: (fecha: string) => void
  /** Abre la venta desde la que se agendó el evento. Sin él, el vínculo solo se nombra. */
  onAbrirVenta?: (ventaId: string) => void
  /** Abre el cobro del cliente de una tarea de cobro (flujo de cobranza de siempre). */
  onCobrar?: (socioId: string) => void
}

/** La ocurrencia se identifica por su fecha ORIGINAL (la de la clave): no cambia al reprogramarla. */
const fechaOriginalDe = (e: EventoCalendario) => /:(\d{4}-\d{2}-\d{2})$/.exec(e.clave)?.[1] ?? e.fecha

/**
 * Detalle de un evento. Igual que la web, solo los que cargó una persona (`origen` Manual) se
 * editan, se borran y se marcan: el DTO no dice si es editable, y el servidor ya filtró que solo
 * lleguen los que el usuario puede ver (y, por eso, tocar). Cheques y compras son automáticos.
 */
export function EventoSheet({ evento, onCerrar, onMovido, onAbrirVenta, onCobrar }: Props) {
  const c = useColors()
  const chip = chipDe(evento)
  const original = fechaOriginalDe(evento)
  const cabecera = (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2] }}>
        <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text, flex: 1 }}>{evento.titulo}</Text>
        {chip ? <StatusChip estado={chip.estado} label={chip.label} /> : null}
      </View>
      <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
        {[nombreLargo(moverDia(evento.fecha, 0)), evento.hora, TIPO[evento.tipo] ?? evento.tipo].filter(Boolean).join(' · ')}
      </Text>
      {evento.ventaId && onAbrirVenta ? (
        <Button
          label={`Agendado desde la venta ${evento.ventaCodigo ?? ''}`.trim()}
          variant="secundario"
          onPress={() => {
            onCerrar()
            onAbrirVenta(evento.ventaId!)
          }}
        />
      ) : evento.ventaCodigo ? (
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`Agendado desde la venta ${evento.ventaCodigo}`}</Text>
      ) : null}
      {original !== evento.fecha ? (
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
          {`Reprogramado: el original era el ${nombreLargo(moverDia(original, 0)).toLowerCase()}.`}
        </Text>
      ) : null}
    </>
  )
  return (
    <BottomSheet visible onClose={onCerrar} accessibilityLabel={evento.titulo}>
      {esTareaAsignada(evento) ? (
        <DetalleTarea evento={evento} cabecera={cabecera} onCerrar={onCerrar} onCobrar={onCobrar} />
      ) : evento.origen === 'Manual' ? (
        <Edicion evento={evento} cabecera={cabecera} onCerrar={onCerrar} onMovido={onMovido} />
      ) : (
        <Cuerpo cabecera={cabecera}>
          <Notice tone="info">Es automático: sale de cheques y compras, y no se cambia desde acá.</Notice>
        </Cuerpo>
      )}
    </BottomSheet>
  )
}

/**
/**
 * Cuerpo de la hoja: lo que se lee y se completa hace scroll; `pie` (avisos y botones) queda fijo abajo,
 * siempre a la vista. El scroll se encoge con el teclado abierto: la hoja sube sobre el teclado y su
 * borde de arriba no tiene que salirse de la pantalla.
 */
function Cuerpo({ cabecera, children, pie }: { cabecera: React.ReactNode; children: React.ReactNode; pie?: React.ReactNode }) {
  const c = useColors()
  const { height } = useWindowDimensions()
  const { top, bottom } = useSafeAreaInsets()
  const teclado = useTeclado()
  const [pieAlto, setPieAlto] = useState(0)
  // Manija, relleno y huecos de la hoja que no son ni scroll ni pie (BottomSheet: manija 4, space[2] arriba, space[6] abajo, gap space[4]).
  const reservado = 4 + space[2] + space[6] + space[4] * 2 + (teclado.visible ? 0 : bottom)
  const disponible = (teclado.visible && teclado.arriba > 0 ? teclado.arriba : height) - top - reservado - pieAlto
  const maximo = Math.min(height * 0.8, Math.max(ALTO_MINIMO, disponible))
  return (
    <>
      <ScrollView style={{ maxHeight: maximo, flexGrow: 0 }} contentContainerStyle={{ gap: space[4] }} keyboardShouldPersistTaps="handled">
        {cabecera}
        {children}
      </ScrollView>
      {pie ? (
        <View
          onLayout={(e) => setPieAlto(Math.round(e.nativeEvent.layout.height))}
          style={{ gap: space[2], paddingTop: space[3], borderTopWidth: 1, borderTopColor: c.border }}
        >
          {pie}
        </View>
      ) : null}
    </>
  )
}

/**
 * Tarea asignada (S8): solo se lee. Editar o borrar exige ser quien la creó o tener CAP_ASIGNAR_TAREAS, y eso se hace en la
 * web. "Cobrar" abre el flujo de cobranza de siempre (MOD_PAGOS); la tarea no mueve plata ni se marca hecha sola.
 */
function DetalleTarea({ evento, cabecera, onCerrar, onCobrar }: Pick<Props, 'evento' | 'onCerrar' | 'onCobrar'> & { cabecera: React.ReactNode }) {
  const c = useColors()
  const puedeCobrar = usePuedeCobrar()
  const cambiar = useCambiarEstadoTarea()
  // El estado que se ve es el último confirmado por el servidor: la hoja guarda el evento con el que se abrió.
  const [estado, setEstado] = useState<EstadoTarea | null | undefined>(evento.estadoTarea)
  const [errorEstado, setErrorEstado] = useState<string | null>(null)
  const quiereCobrar = cobroAbierto({ ...evento, estadoTarea: estado }) && puedeCobrar && !!onCobrar
  const detalle = useEventoCalendario(quiereCobrar ? evento.origenId : null)
  const socioId = detalle.data?.socioComercialId ?? null
  const linea = { ...typeScale.secundario, color: c.textSecondary }
  const asignados = (evento.asignados ?? []).map((a) => a.nombre).join(', ')
  return (
    <Cuerpo
      cabecera={cabecera}
      pie={quiereCobrar ? (
        <Button
          label="Cobrar"
          disabled={!socioId}
          loading={detalle.isPending}
          onPress={() => { onCerrar(); onCobrar!(socioId!) }}
        />
      ) : undefined}
    >
      {evento.socioNombre ? <Text style={linea}>{`Cliente: ${evento.socioNombre}`}</Text> : null}
      <Text style={linea}>{`Depósito: ${depositoDe(evento)}`}</Text>
      {asignados ? <Text style={linea}>{`Asignada a ${asignados}`}</Text> : null}
      {evento.descripcion ? <Text style={linea}>{evento.descripcion}</Text> : null}
      <Text style={linea}>La ven quienes la tienen asignada y Administración.</Text>
      <View accessibilityLabel="Estado de la tarea" style={{ gap: space[2] }}>
        {ESTADOS_DE_TAREA.map((e) => (
          <OptionCard
            key={e.valor}
            label={e.texto}
            minHeight={56}
            selected={e.valor === (estado ?? 'Pendiente')}
            disabled={cambiar.isPending}
            onPress={() => {
              if (e.valor === (estado ?? 'Pendiente')) return
              setErrorEstado(null)
              cambiar.mutate({ id: evento.origenId, estado: e.valor }, {
                onSuccess: () => setEstado(e.valor),
                onError: (err) => setErrorEstado(mensajeDelServidor(err, 'No se pudo cambiar el estado de la tarea.')),
              })
            }}
          />
        ))}
      </View>
      {errorEstado ? <Notice tone="peligro">{errorEstado}</Notice> : null}
    </Cuerpo>
  )
}

type PropsEdicion = Props & { cabecera: React.ReactNode }

function Edicion({ evento, cabecera, ...props }: PropsEdicion) {
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
      <Cuerpo cabecera={cabecera}>
        <Notice tone="peligro">{mensajeDelServidor(detalle.error, 'No se pudo cargar el evento.')}</Notice>
        <Button label="Cerrar" variant="secundario" onPress={props.onCerrar} />
      </Cuerpo>
    )
  }
  if (!d) return <Cuerpo cabecera={cabecera}><ActivityIndicator color={c.brand} accessibilityLabel="Cargando el evento" /></Cuerpo>
  return <Formulario d={d} evento={evento} cabecera={cabecera} {...props} onBorrado={() => { borrado.current = true; props.onCerrar() }} />
}

function Formulario({ d, evento, cabecera, onCerrar, onMovido, onBorrado }: PropsEdicion & { d: EventoDetalle; onBorrado: () => void }) {
  const c = useColors()
  const editar = useEditarEvento()
  const borrar = useBorrarEvento()
  const pagar = useMarcarPagado()
  const [titulo, setTitulo] = useState(d.titulo)
  const [descripcion, setDescripcion] = useState(d.descripcion ?? '')
  const [fecha, setFecha] = useState(d.fechaInicio)
  const [hora, setHora] = useState(d.hora ?? '')
  const horaValida = esHoraValida(hora.trim())
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
      // Solo si cambió: sin el campo el servidor la conserva; vacía la quita (todo el día).
      ...(hora.trim() !== (d.hora ?? '') ? { hora: hora.trim() } : {}),
      recurrencia: d.recurrencia ?? undefined,
      montoEstimado: d.montoEstimado ?? null,
      socioComercialId: d.socioComercialId ?? null,
      avisarDiasAntes: d.avisarDiasAntes,
    }), () => (d.recurrencia ? onCerrar() : onMovido(fecha)), 'No se pudo guardar el evento.')
  }

  const marcar = (pagado: boolean) =>
    correr(() => pagar.mutateAsync({ id: d.id, fecha: fechaOriginalDe(evento), pagado }), onCerrar, 'No se pudo marcar el evento.')

  return (
    <Cuerpo
      cabecera={cabecera}
      pie={(
        <>
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
              <Button label="Sí, guardar" disabled={!titulo.trim() || !horaValida || ocupado} loading={editar.isPending} onPress={guardar} />
              <Button label="No guardar" variant="secundario" disabled={ocupado} onPress={() => setConfirmando(null)} />
            </>
          ) : (
            <>
              <Button label="Guardar cambios" disabled={!titulo.trim() || !horaValida || ocupado} loading={editar.isPending} onPress={guardar} />
              <Button label="Borrar evento" variant="secundario" disabled={ocupado} onPress={() => setConfirmando('borrar')} />
            </>
          )}
        </>
      )}
    >
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
      <Field
        label="Hora (opcional)"
        value={hora}
        onChangeText={setHora}
        placeholder="09:30"
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        help="Sin hora, es de todo el día."
        error={horaValida ? undefined : 'Escribí la hora como 09:30.'}
      />
      {d.recurrencia?.frecuencia === 'Semanal' ? (
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{textoSemanal(d.recurrencia.diasSemana ?? [])}</Text>
      ) : null}
      <Field label="Descripción (opcional)" value={descripcion} onChangeText={setDescripcion} maxLength={MAX_DESCRIPCION} />
      <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
        {d.visibilidad === 'Personal' ? 'Lo ves solo vos.' : 'Lo ve Administración.'}
      </Text>
    </Cuerpo>
  )
}
