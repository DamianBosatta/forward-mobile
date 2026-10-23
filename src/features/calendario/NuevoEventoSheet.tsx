import React, { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { FONT, radii, space, typeScale, useColors } from '@/libs/theme'
import { BottomSheet, Button, Field, Notice, Segmented } from '@/core/ui/fw'
import { useCrearEvento } from '@/libs/api-client/calendario'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { SelectorDia } from './SelectorDia'
import { DIAS_SEMANA, TIPOS_MANUALES, diaDeLaSemana, esHoraValida, textoSemanal, type TipoManual } from './presentacion'

export interface Precarga {
  titulo: string
  descripcion?: string
  /** Número de la venta de la que viene ("A00421"). */
  origen?: string
  /** Id de esa venta: el evento queda vinculado ("agendado desde la venta A00421"). */
  ventaId?: string
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
type Repite = 'no' | 'semanal'

/**
 * Lámina CalendarioEvento. Es personal. Con hora opcional ("HH:mm", sin hora = todo el día) y
 * "Se repite" semanal por días de la semana. "Agendar" desde una venta precarga el texto y deja el
 * evento vinculado a la venta (el servidor verifica que el usuario la pueda ver).
 */
export function NuevoEventoSheet({ fecha: inicial, precarga, onCerrar, onCreado }: Props) {
  const c = useColors()
  const crear = useCrearEvento()
  const [tipo, setTipo] = useState<TipoManual>('Manual')
  const [titulo, setTitulo] = useState((precarga?.titulo ?? '').slice(0, MAX_TITULO))
  const [descripcion, setDescripcion] = useState((precarga?.descripcion ?? '').slice(0, MAX_DESCRIPCION))
  const [fecha, setFecha] = useState(inicial)
  const [aviso, setAviso] = useState<Aviso>('1')
  const [hora, setHora] = useState('')
  const [repite, setRepite] = useState<Repite>('no')
  const [dias, setDias] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const horaValida = esHoraValida(hora.trim())
  // Sin días elegidos, el del primer día del evento (lo mismo que hace el servidor).
  const diasElegidos = dias.length > 0 ? dias : [diaDeLaSemana(fecha)]

  const alternarDia = (valor: number) =>
    setDias(diasElegidos.includes(valor) ? diasElegidos.filter((d) => d !== valor) : [...diasElegidos, valor])

  const guardar = async () => {
    setError(null)
    try {
      await crear.mutateAsync({
        tipo,
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || null,
        fechaInicio: fecha,
        avisarDiasAntes: Number(aviso),
        visibilidad: 'Personal',
        ...(hora.trim() ? { hora: hora.trim() } : {}),
        ...(precarga?.ventaId ? { ventaId: precarga.ventaId } : {}),
        ...(repite === 'semanal'
          ? { recurrencia: { frecuencia: 'Semanal' as const, intervalo: 1, diasSemana: diasElegidos } }
          : {}),
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
        <Notice tone="info">
          {precarga.ventaId
            ? `Queda agendado desde la venta ${precarga.origen}: el título y la descripción ya están cargados.`
            : `Viene de la venta ${precarga.origen}: el título y la descripción ya están cargados.`}
        </Notice>
      ) : null}
      <Text style={{ ...typeScale.secundario, fontFamily: FONT.semibold, fontWeight: '600', color: c.text }}>Tipo de evento</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Tipo de evento" style={{ gap: space[2] }}>
        {TIPOS_MANUALES.map((t) => {
          const activo = t.value === tipo
          return (
            <Pressable
              key={t.value}
              onPress={() => setTipo(t.value)}
              accessibilityRole="radio"
              accessibilityLabel={t.label}
              accessibilityState={{ checked: activo }}
              style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: space[3], borderRadius: radii.campo, borderWidth: activo ? 2 : 1, borderColor: activo ? c.brand : c.border, backgroundColor: activo ? c.brandSoft : c.surface }}
            >
              <Text style={{ ...typeScale.cuerpoDestacado, color: activo ? c.brandInk : c.text }}>{t.label}</Text>
            </Pressable>
          )
        })}
      </View>
      <Field label="Título" value={titulo} onChangeText={setTitulo} maxLength={MAX_TITULO} />
      <SelectorDia fecha={fecha} onCambiar={setFecha} />
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
      <Text style={{ ...typeScale.secundario, fontFamily: FONT.semibold, fontWeight: '600', color: c.text }}>Se repite</Text>
      <Segmented<Repite>
        accessibilityLabel="Se repite"
        value={repite}
        onChange={setRepite}
        options={[
          { value: 'no', label: 'Una vez' },
          { value: 'semanal', label: 'Todas las semanas' },
        ]}
      />
      {repite === 'semanal' ? (
        <>
          <View accessibilityLabel="Días de la semana" style={{ flexDirection: 'row', gap: space[1] }}>
            {DIAS_SEMANA.map((d) => {
              const activo = diasElegidos.includes(d.valor)
              return (
                <Pressable
                  key={d.valor}
                  accessibilityRole="checkbox"
                  accessibilityLabel={d.largo}
                  accessibilityState={{ checked: activo }}
                  onPress={() => alternarDia(d.valor)}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: radii.campo,
                    borderWidth: activo ? 2 : 1,
                    borderColor: activo ? c.brand : c.border,
                    backgroundColor: activo ? c.brandSoft : c.surface,
                  }}
                >
                  <Text style={{ ...typeScale.cuerpoDestacado, color: activo ? c.brandInk : c.text }}>{d.corto}</Text>
                </Pressable>
              )
            })}
          </View>
          <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{textoSemanal(diasElegidos)}</Text>
        </>
      ) : null}
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
      <Button label="Guardar evento" disabled={!titulo.trim() || !horaValida} loading={crear.isPending} onPress={guardar} />
    </BottomSheet>
  )
}
