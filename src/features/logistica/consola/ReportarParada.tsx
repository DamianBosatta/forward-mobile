import React, { useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { FONT, radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, Field, Notice, Segmented, TopBar } from '@/core/ui/fw'
import type { ParadaDto } from '@/libs/api-client/types'
import { useLineasParada, useMediosCobroChofer } from '@/libs/api-client/logistica'
import { mostrarFecha } from '@/features/cuentas/lib/cobro'
import { diaArgentina } from '@/src/utils/date'
import { MOTIVOS_NO_ENTREGA } from './hojaDeRuta'
import { etiquetaNota, importeParada } from './cobroParada'
import { armarEntrega, razonPendiente, type EntregaArmada, type FormEntrega } from './entrega'
import { FotoEntrega } from './FotoEntrega'
import { CobroEnEntrega } from './CobroEnEntrega'
import { DevolucionEnEntrega } from './DevolucionEnEntrega'

export type ReporteParada =
  | { entregado: true; entrega: EntregaArmada }
  | { entregado: false; motivoRechazo?: string; observaciones?: string }

interface Props {
  /** La hoja de la parada: las líneas a devolver se piden por la hoja, no por la venta. */
  hojaDeRutaId: string
  parada: ParadaDto
  numero: number
  enviando: boolean
  error: string | null
  /** El interruptor `ExigirFotoRemitoAlEntregar` del servidor (viene en la hoja). */
  exigeFotoRemito: boolean
  onCerrar: () => void
  onConfirmar: (r: ReporteParada) => void
}

type Resultado = 'entregado' | 'noEntregado'

const formVacio = (): FormEntrega => ({
  receptor: '', observaciones: '', remitoUrl: null, lineas: [], imputacion: 'PedidoActual', firmaUrl: null, devolucion: {},
})

/**
 * Láminas ChoferEntrega y ChoferNoEntrega. La entrega lleva quién recibió (siempre), la foto del
 * remito (obligatoria si el servidor la exige), el cobro mixto, la firma y la devolución.
 * Monta una vez por parada: el estado arranca limpio.
 */
export function ReportarParada({ hojaDeRutaId, parada, numero, enviando, error, exigeFotoRemito, onCerrar, onConfirmar }: Props) {
  const c = useColors()
  const { bottom } = useSafeAreaInsets()
  // Tablet: el formulario no se estira a todo el ancho.
  const { width } = useWindowDimensions()
  const columna = width >= 768 ? { maxWidth: 640, width: '100%' as const, alignSelf: 'center' as const } : null
  const [resultado, setResultado] = useState<Resultado>('entregado')
  const [f, setF] = useState<FormEntrega>(formVacio)
  const [motivo, setMotivo] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(0)
  const [errorForm, setErrorForm] = useState<string | null>(null)
  const entregado = resultado === 'entregado'
  const medios = useMediosCobroChofer(entregado)
  // Quien ve la hoja ve las líneas de sus paradas: el chofer con solo viajes también devuelve.
  const renglones = useLineasParada(hojaDeRutaId, parada.id, entregado)

  const cambiar = (cambio: Partial<FormEntrega>) => setF((p) => ({ ...p, ...cambio }))
  const alSubir = (s: boolean) => setSubiendo((n) => n + (s ? 1 : -1))
  // Quién recibió es obligatorio siempre (decisión del dueño del 16-10), con o sin la foto del remito.
  // Con una foto subiendo tampoco: se confirmaría sin ella.
  const razon = razonPendiente({ entregado, receptor: f.receptor, motivo, subiendo: subiendo > 0 })
  const listo = razon === null
  const faltaFoto = entregado && exigeFotoRemito && !f.remitoUrl
  const aCobrar = importeParada(parada)

  const confirmar = () => {
    if (!listo || enviando) return
    setErrorForm(null)
    if (!entregado) {
      onConfirmar({ entregado: false, motivoRechazo: motivo ?? undefined, observaciones: f.observaciones.trim() || undefined })
      return
    }
    const disponibles = Object.fromEntries((renglones.data ?? []).map((r) => [r.ventaDetalleId ?? '', r.cantidadDisponible ?? 0]))
    const r = armarEntrega(f, { exigeFotoRemito, disponibles })
    if ('error' in r) {
      setErrorForm(r.error)
      return
    }
    onConfirmar({ entregado: true, entrega: r.entrega })
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onCerrar}>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar
          title="Reportar entrega"
          subtitle={`Parada ${numero} · ${parada.direccion} · ${parada.clienteNombre}`}
          leading={{ kind: 'atras', onPress: onCerrar }}
        />
        <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4], ...columna }} keyboardShouldPersistTaps="handled">
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
            <>
              <CobroEnEntrega
                medios={medios.data}
                mediosError={medios.isError}
                lineas={f.lineas}
                imputacion={f.imputacion}
                onLineas={(lineas) => cambiar({ lineas })}
                onImputacion={(imputacion) => cambiar({ imputacion })}
                onSubiendo={alSubir}
                aCobrar={aCobrar.aCobrar ? aCobrar.valor : null}
                hoy={mostrarFecha(diaArgentina(Date.now()))}
              />
              <Field label="Quién recibió" value={f.receptor} onChangeText={(v) => cambiar({ receptor: v })} placeholder="Nombre de quien firma" />
              <FotoEntrega
                que="del remito firmado"
                titulo="Foto del remito"
                obligatoria={exigeFotoRemito}
                guia="Encuadrá el remito entero, con la firma y la aclaración a la vista"
                referencia={etiquetaNota(parada) ? `Remito ${etiquetaNota(parada)}` : undefined}
                ayuda={exigeFotoRemito ? 'Sin la foto del remito firmado no se confirma la entrega.' : undefined}
                url={f.remitoUrl}
                onUrl={(url) => cambiar({ remitoUrl: url })}
                onSubiendo={alSubir}
              />
              <FotoEntrega
                que="de la firma del cliente"
                ayuda="Si el cliente firma por lo que no paga."
                url={f.firmaUrl}
                onUrl={(url) => cambiar({ firmaUrl: url })}
                onSubiendo={alSubir}
              />
              <DevolucionEnEntrega
                renglones={renglones.data}
                cargando={renglones.isLoading}
                conError={renglones.isError}
                valores={f.devolucion}
                onCambio={(id, v) => cambiar({ devolucion: { ...f.devolucion, [id]: v } })}
              />
            </>
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
          <Field label="Observaciones" value={f.observaciones} onChangeText={(v) => cambiar({ observaciones: v })} placeholder="Algo que la oficina tenga que saber" />
          {errorForm ? <Notice tone="peligro">{errorForm}</Notice> : null}
          {error ? <Notice tone="peligro">{error}</Notice> : null}
        </ScrollView>
        <View style={{ backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border, padding: space[4], paddingBottom: space[4] + bottom, gap: space[2] }}>
          {razon || faltaFoto ? (
            <Text style={{ ...typeScale.secundario, color: c.textSecondary, textAlign: 'center' }}>
              {razon ?? 'Falta la foto del remito'}
            </Text>
          ) : null}
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
