import React, { useRef, useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Check } from 'lucide-react-native'
import { FONT, radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, Field, Notice, TopBar } from '@/core/ui/fw'
import { safeHaptics } from '@/core/utils/haptics'
import { MotivoDeshabilitado } from '@/core/ui/fw/MotivoDeshabilitado'
import type { ParadaDto } from '@/libs/api-client/types'
import { useLineasParada, useMediosCobroChofer } from '@/libs/api-client/logistica'
import { mostrarFecha } from '@/features/cuentas/lib/cobro'
import { ElegirChip } from '@/features/cuentas/components/ElegirChip'
import { leerNumero } from '@/src/utils/numero'
import { diaArgentina } from '@/src/utils/date'
import { MOTIVOS_NO_ENTREGA } from './hojaDeRuta'
import { etiquetaNota, importeParada } from './cobroParada'
import { armarEntrega, observacionesDeEntrega, razonPendiente, type EntregaArmada, type FormEntrega } from './entrega'
import { pasosDeEntrega, razonCobro, razonDevolucion, razonReporte, textoRepartido, avisoDeCobro, comparacionDeCobro, type ContextoCobro, type Paso } from './pasosEntrega'
import { FotoEntrega } from './FotoEntrega'
import { CobroEnEntrega } from './CobroEnEntrega'
import { DevolucionEnEntrega } from './DevolucionEnEntrega'
import { FirmaEnEntrega } from './FirmaEnEntrega'
import { ResumenEntrega } from './ResumenEntrega'

export type ReporteParada =
  | { entregado: true; entrega: EntregaArmada }
  | { entregado: false; motivoRechazo?: string; observaciones?: string; evidenciaUrl?: string }

interface Props {
  /** La hoja de la parada: las líneas a devolver se piden por la hoja, no por la venta. */
  hojaDeRutaId: string
  parada: ParadaDto
  numero: number
  enviando: boolean
  error: string | null
  /** El interruptor `ExigirFotoRemitoAlEntregar` del servidor (viene en la hoja). */
  exigeFotoRemito: boolean
  /** Lo decide la pantalla "Llegué": "Entregué todo" o "No pude entregar". */
  resultadoInicial?: Resultado
  onCerrar: () => void
  onConfirmar: (r: ReporteParada) => void
}

export type Resultado = 'entregado' | 'noEntregado'

const formVacio = (): FormEntrega => ({
  receptor: '', observaciones: '', remitoUrl: null, lineas: [], imputacion: 'PedidoActual', firmaUrl: null, devolucion: {},
})

const TITULO: Record<Paso, string> = {
  reporte: 'Reportar entrega',
  devolucion: 'Devolución',
  cobro: 'Cobro mixto',
  resumen: 'Confirmar entrega',
}

/**
 * Láminas de la entrega del chofer: E1 reportar (quién recibió, foto del remito, si hay devolución),
 * E2 devolución, E3/E4 cobro mixto con firma, E5 foto (se saca dentro del paso que la pide, con la
 * cámara del teléfono) y E6 confirmar. Todo lo cargado vive acá: volver no pierde nada. Se confirma
 * una sola vez, al final, con la misma operación única de siempre. "No se pudo entregar" se
 * confirma desde el primer paso. Monta una vez por parada: el estado arranca limpio.
 */
export function ReportarParada({ hojaDeRutaId, parada, numero, enviando, error, exigeFotoRemito, resultadoInicial = 'entregado', onCerrar, onConfirmar }: Props) {
  const c = useColors()
  const { bottom } = useSafeAreaInsets()
  // Tablet: los pasos van en una columna centrada, no se estiran a todo el ancho.
  const { width } = useWindowDimensions()
  const columna = width >= 768 ? { maxWidth: 640, width: '100%' as const, alignSelf: 'center' as const } : null
  const [resultado] = useState<Resultado>(resultadoInicial)
  const [paso, setPaso] = useState<Paso>('reporte')
  const [f, setF] = useState<FormEntrega>(formVacio)
  const [hayDevolucion, setHayDevolucion] = useState<boolean | null>(null)
  const [firmar, setFirmar] = useState(false)
  const firmarRef = useRef(false)
  const [motivo, setMotivo] = useState<string | null>(null)
  /** Lámina ChoferNoEntrega (C5): foto del lugar, opcional, ya subida. */
  const [lugarUrl, setLugarUrl] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(0)
  const [errorForm, setErrorForm] = useState<string | null>(null)
  const entregado = resultado === 'entregado'
  const medios = useMediosCobroChofer(entregado)
  // Quien ve la hoja ve las líneas de sus paradas: el chofer con solo viajes también devuelve.
  const renglones = useLineasParada(hojaDeRutaId, parada.id, entregado)

  const cambiar = (cambio: Partial<FormEntrega>) => setF((p) => ({ ...p, ...cambio }))
  const alSubir = (s: boolean) => setSubiendo((n) => n + (s ? 1 : -1))
  const aCobrar = importeParada(parada)
  const disponibles = Object.fromEntries((renglones.data ?? []).map((r) => [r.ventaDetalleId ?? '', r.cantidadDisponible ?? 0]))
  // Con "No, recibió todo" las cantidades que se hayan cargado antes no viajan (pero se conservan por si vuelve).
  // La firma solo viaja con la casilla tildada (una foto que termina de subir tarde no la reactiva).
  // Con "No cobré" las líneas cargadas no viajan (se conservan por si vuelve a "Cobré").
  const lineas = f.noCobro ? [] : f.lineas
  const form: FormEntrega = { ...f, lineas, devolucion: hayDevolucion ? f.devolucion : {}, firmaUrl: firmar ? f.firmaUrl : null }

  const pasos = pasosDeEntrega(hayDevolucion)
  const indice = Math.max(0, pasos.indexOf(paso))
  const ctxCobro: ContextoCobro = {
    lineas, imputacion: f.imputacion, firmar, firmaUrl: form.firmaUrl, noCobro: f.noCobro,
    aCobrar: aCobrar.aCobrar ? aCobrar.valor : null, hayDevolucion: hayDevolucion === true, subiendo: subiendo > 0,
  }
  let razon: string | null
  if (!entregado) razon = razonPendiente({ entregado: false, receptor: '', motivo, subiendo: subiendo > 0 })
  else if (paso === 'reporte') razon = razonReporte({ receptor: f.receptor, hayDevolucion, exigeFotoRemito, remitoUrl: f.remitoUrl, subiendo: subiendo > 0 })
  else if (paso === 'devolucion') razon = razonDevolucion(f.devolucion, disponibles)
  else if (paso === 'cobro') razon = razonCobro(ctxCobro)
  else razon = subiendo > 0 ? 'Subiendo la foto: esperá un momento' : null
  const listo = razon === null
  const ultimo = !entregado || paso === 'resumen'

  const atras = () => (entregado && indice > 0 ? setPaso(pasos[indice - 1]) : onCerrar())
  const seguir = () => {
    if (!listo) return
    setErrorForm(null)
    setPaso(pasos[indice + 1])
  }

  const confirmar = () => {
    if (!listo || enviando) return
    setErrorForm(null)
    if (!entregado) {
      safeHaptics.notification('warning')
      onConfirmar({ entregado: false, motivoRechazo: motivo ?? undefined, observaciones: (motivo === 'Otro' ? f.observaciones.trim() : '') || undefined, evidenciaUrl: lugarUrl ?? undefined })
      return
    }
    const r = armarEntrega(form, { exigeFotoRemito, disponibles })
    if ('error' in r) {
      setErrorForm(r.error)
      return
    }
    onConfirmar({ entregado: true, entrega: r.entrega })
  }

  const porDeudaAnterior = f.imputacion === 'DeudaAnterior' && lineas.length > 0
  const tituloPaso = paso === 'cobro' && porDeudaAnterior ? 'Paga lo anterior y firma lo actual' : TITULO[paso]
  const cmp = comparacionDeCobro(ctxCobro)

  return (
    <Modal visible animationType="slide" onRequestClose={atras}>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar
          title={entregado ? tituloPaso : 'No pude entregar'}
          subtitle={`${entregado ? `Paso ${indice + 1} de ${pasos.length} · ` : ''}Parada ${numero} · ${parada.direccion} · ${parada.clienteNombre}`}
          leading={{ kind: 'atras', onPress: atras }}
        />
        <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4], ...columna }} keyboardShouldPersistTaps="handled">
          {entregado && paso === 'reporte' ? (
            <>
              <View accessibilityLabel="¿Hay devolución?" style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[4], gap: space[3] }}>
                <Text style={{ ...typeScale.seccion, color: c.text }}>¿Hay devolución?</Text>
                <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
                  Si el cliente no se queda con todo, marcá lo que devuelve antes de cobrar.
                </Text>
                <ElegirChip
                  titulo="¿Hay devolución?"
                  opciones={[
                    { id: 'no', label: 'No, recibió todo' },
                    { id: 'si', label: 'Sí, devuelve' },
                  ]}
                  valor={hayDevolucion === null ? null : hayDevolucion ? 'si' : 'no'}
                  onCambio={(id) => setHayDevolucion(id === 'si')}
                />
              </View>
              <Field label="Quién recibió" value={f.receptor} onChangeText={(v) => cambiar({ receptor: v })} placeholder="Nombre de quien firma" />
              <FotoEntrega
                que="del remito firmado"
                titulo="Foto del remito"
                obligatoria={exigeFotoRemito}
                guia="Encuadrá el remito entero, con la firma y la aclaración a la vista"
                referencia={etiquetaNota(parada) ? `Remito ${etiquetaNota(parada)}` : undefined}
                lugar={parada.direccion}
                ayuda={exigeFotoRemito ? 'Sin la foto del remito firmado no se confirma la entrega.' : undefined}
                url={f.remitoUrl}
                onUrl={(url) => cambiar({ remitoUrl: url })}
                onSubiendo={alSubir}
              />
            </>
          ) : null}
          {!entregado && paso === 'reporte' ? (
            <View accessibilityLabel="Motivo" style={{ gap: space[3] }}>
              <Text accessibilityRole="header" style={{ ...typeScale.titulo, fontSize: 24, lineHeight: 32, color: c.text }}>¿Qué pasó?</Text>
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
                      minHeight: 76,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space[3],
                      paddingHorizontal: space[4],
                      borderRadius: radii.tarjeta,
                      borderWidth: elegido ? 3 : 2,
                      borderColor: elegido ? c.brandInk : c.textSecondary,
                      backgroundColor: elegido ? c.brandSoft : c.surface,
                    }}
                  >
                    <Text style={{ ...typeScale.seccion, fontSize: 19, lineHeight: 26, color: elegido ? c.brandInk : c.text, flex: 1 }}>{m}</Text>
                    {/* La elección se ve por el tilde y el borde grueso, no solo por el color. */}
                    {elegido ? <Check size={28} color={c.brandInk} strokeWidth={3} /> : null}
                  </Pressable>
                )
              })}
              <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>Ventas reprograma la entrega. Vos seguís con la próxima parada.</Text>
            </View>
          ) : null}
          {!entregado && paso === 'reporte' ? (
            <FotoEntrega
              que="del lugar"
              titulo="Foto del lugar"
              guia="Encuadrá el frente del lugar, con la puerta y el número a la vista"
              lugar={parada.direccion}
              url={lugarUrl}
              onUrl={setLugarUrl}
              onSubiendo={alSubir}
            />
          ) : null}
          {paso === 'reporte' && (entregado || motivo === 'Otro') ? (
            <Field label="Observaciones" value={f.observaciones} onChangeText={(v) => cambiar({ observaciones: v })} placeholder="Algo que la oficina tenga que saber" />
          ) : null}
          {entregado && paso === 'devolucion' ? (
            <DevolucionEnEntrega
              renglones={renglones.data}
              cargando={renglones.isLoading}
              conError={renglones.isError}
              valores={f.devolucion}
              onCambio={(id, v) => cambiar({ devolucion: { ...f.devolucion, [id]: v } })}
            />
          ) : null}
          {entregado && paso === 'cobro' ? (
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
                repartido={lineas.length > 0 ? textoRepartido(ctxCobro) : undefined}
                aviso={avisoDeCobro(ctxCobro)}
                porDeudaAnterior={porDeudaAnterior}
                noCobro={f.noCobro}
                onNoCobro={(noCobro) => cambiar({ noCobro })}
              />
              {cmp && hayDevolucion ? (
                <Notice tone="info">La devolución se descuenta de lo que hay que cobrar: el servidor hace la cuenta cuando la autoriza el depósito.</Notice>
              ) : null}
              <FirmaEnEntrega
                firmar={firmar}
                onFirmar={(v) => {
                  firmarRef.current = v
                  setFirmar(v)
                  if (!v) cambiar({ firmaUrl: null })
                }}
                url={f.firmaUrl}
                onUrl={(url) => firmarRef.current && cambiar({ firmaUrl: url })}
                onSubiendo={alSubir}
              />
            </>
          ) : null}
          {entregado && paso === 'resumen' ? (
            <ResumenEntrega
              d={{
                receptor: f.receptor.trim(),
                conFotoRemito: !!f.remitoUrl,
                devueltos: (renglones.data ?? [])
                  .map((r) => ({ nombre: r.productoNombre ?? 'Producto', cantidad: leerNumero(form.devolucion[r.ventaDetalleId ?? ''] ?? '') ?? 0 }))
                  .filter((x) => x.cantidad > 0),
                cobros: lineas.map((l) => ({ medio: l.medio?.nombre ?? '', monto: leerNumero(l.monto) ?? 0, conFoto: !!l.fotoUrl })),
                firmada: !!form.firmaUrl,
                aDeudaAnterior: porDeudaAnterior,
                noCobro: observacionesDeEntrega('', f.noCobro) ?? null,
              }}
            />
          ) : null}
          {errorForm ? <Notice tone="peligro">{errorForm}</Notice> : null}
          {error && ultimo ? <Notice tone="peligro">{error}</Notice> : null}
        </ScrollView>
        <View style={{ backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border, padding: space[4], paddingBottom: space[4] + bottom, gap: space[2] }}>
          <View style={{ gap: space[2], ...columna }}>
            {razon ? <MotivoDeshabilitado>{razon}</MotivoDeshabilitado> : null}
            <Button
              size={entregado ? 'md' : 'xl'}
              label={!entregado ? 'Avisar a Ventas' : ultimo ? 'Confirmar entrega' : 'Continuar'}
              disabled={!listo}
              loading={ultimo && enviando}
              onPress={ultimo ? confirmar : seguir}
            />
          </View>
        </View>
      </View>
    </Modal>
  )
}
