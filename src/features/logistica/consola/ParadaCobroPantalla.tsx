import React, { useState } from 'react'
import { Modal, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { Check } from 'lucide-react-native'
import { importe, space, typeScale, useColors } from '@/libs/theme'
import { Button, Notice, OptionCard, PieFijo, TopBar, formatImporte } from '@/core/ui/fw'
import { MotivoDeshabilitado } from '@/core/ui/fw/MotivoDeshabilitado'
import { useMediosCobroChofer } from '@/libs/api-client/logistica'
import { mostrarFecha } from '@/features/cuentas/lib/cobro'
import { diaArgentina } from '@/core/utils/fecha'
import { MOTIVOS_NO_COBRO, type MotivoNoCobro, type ParadaCobro } from '@/features/cobros/paradaCobro'
import { CobroEnEntrega } from './CobroEnEntrega'
import { armarLinea, type LineaCobroForm } from './entrega'
import { razonCobro } from './pasosEntrega'

/** Cómo terminó la parada, para la pantalla de resultado. `guardada`: quedó en el teléfono, sale cuando haya señal. */
export type ResultadoParadaCobro =
  | { tipo: 'cobro'; monto: number; guardada: boolean }
  | { tipo: 'noCobrada'; motivo: string; guardada: boolean }

interface Props {
  parada: ParadaCobro
  /** "Parada 4 de 4": el lugar de la parada en la ruta completa (las entregas van primero). */
  numero: number
  total: number
  enviando: boolean
  error: string | null
  resultado: ResultadoParadaCobro | null
  onCerrar: () => void
  onCobrar: (lineas: LineaCobroForm[]) => void
  onNoCobre: (motivo: MotivoNoCobro) => void
}

/** El monto como se escribe en el campo (coma decimal): `85000` o `85000,5`. */
const comoCampo = (n: number) => String(n).replace('.', ',')

/**
 * Pantalla de una parada de solo cobro (S9, S10): la dirección arriba y el cliente debajo, el aviso de que no se lleva
 * mercadería, el cobro con las mismas líneas de la entrega (sin firma) y, aparte, "No cobré" con su motivo obligatorio.
 * Monta una vez por parada: el estado arranca limpio. El envío (con o sin señal) lo resuelve quien la abre.
 */
export function ParadaCobroPantalla({ parada, numero, total, enviando, error, resultado, onCerrar, onCobrar, onNoCobre }: Props) {
  const c = useColors()
  const { width } = useWindowDimensions()
  const columna = width >= 768 ? { maxWidth: 640, width: '100%' as const, alignSelf: 'center' as const } : null
  const medios = useMediosCobroChofer(true)
  const [lineas, setLineas] = useState<LineaCobroForm[]>([])
  const [subiendo, setSubiendo] = useState(0)
  const [motivo, setMotivo] = useState<MotivoNoCobro | null>(null)
  const [verMotivos, setVerMotivos] = useState(false)

  // Al elegir el primer medio el monto sale con lo acordado: el chofer lo corrige si cobró otra cosa.
  const cambiarLineas = (nuevas: LineaCobroForm[]) =>
    setLineas(lineas.length === 0 && nuevas.length === 1 && nuevas[0].monto === '' && parada.montoAcordado
      ? [{ ...nuevas[0], monto: comoCampo(parada.montoAcordado) }]
      : nuevas)
  const alSubir = (s: boolean) => setSubiendo((n) => n + (s ? 1 : -1))

  const razon = lineas.length === 0
    ? 'Elegí cómo pagó el cliente'
    : razonCobro({ lineas, aCobrar: null, hayDevolucion: false, subiendo: subiendo > 0 })

  if (resultado) {
    return (
      <Modal visible animationType="slide" onRequestClose={onCerrar}>
        <View style={{ flex: 1, backgroundColor: c.bg }}>
          <TopBar title={parada.direccion ?? parada.clienteNombre} subtitle={`Parada ${numero} de ${total} · Solo cobro`} leading={{ kind: 'atras', onPress: onCerrar }} />
          <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4], ...columna }}>
            {resultado.tipo === 'cobro' ? (
              <Notice tone="exito" title={resultado.guardada ? 'Cobro guardado.' : 'Cobro registrado.'}>
                {resultado.guardada
                  ? `${formatImporte(resultado.monto)} de ${parada.clienteNombre}. Se manda solo cuando haya señal.`
                  : `${formatImporte(resultado.monto)} de ${parada.clienteNombre}. Entra en tu rendición de hoy.`}
              </Notice>
            ) : (
              <Notice tone="info" title={resultado.guardada ? 'Parada guardada sin cobrar.' : 'Parada cerrada sin cobrar.'}>
                {resultado.guardada
                  ? `${resultado.motivo}. Se manda solo cuando haya señal.`
                  : `${resultado.motivo}. Queda anotado para Ventas.`}
              </Notice>
            )}
          </ScrollView>
          <PieFijo conInsetInferior>
            <View style={columna ?? undefined}>
              <Button size="xl" icon={Check} label="Volver a la ruta" onPress={onCerrar} />
            </View>
          </PieFijo>
        </View>
      </Modal>
    )
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onCerrar}>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar title={parada.direccion ?? parada.clienteNombre} subtitle={`Parada ${numero} de ${total} · Solo cobro`} leading={{ kind: 'atras', onPress: onCerrar }} />
        <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4], ...columna }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: space[1] }}>
            <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>{parada.direccion ?? parada.clienteNombre}</Text>
            {parada.direccion ? <Text style={{ ...typeScale.cuerpoDestacado, color: c.textSecondary }}>{parada.clienteNombre}</Text> : null}
          </View>
          <Notice tone="info" title="No llevás mercadería.">Pasás solo a cobrar.</Notice>
          <View accessibilityLabel="Montos de la parada" style={{ gap: space[1] }}>
            {parada.montoAcordado ? (
              <Text style={{ ...typeScale.cuerpo, color: c.text }}>
                {'Acordado '}
                <Text style={{ ...typeScale.cuerpoDestacado, ...importe }}>{formatImporte(parada.montoAcordado)}</Text>
              </Text>
            ) : null}
            <Text style={{ ...typeScale.cuerpo, color: c.text }}>
              {'Saldo del cliente '}
              <Text style={{ ...typeScale.cuerpoDestacado, ...importe }}>{formatImporte(parada.deudaCliente)}</Text>
            </Text>
          </View>
          <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>Registrar cobro</Text>
          <CobroEnEntrega
            sinFirma
            medios={medios.data}
            mediosError={medios.isError}
            lineas={lineas}
            onLineas={cambiarLineas}
            onSubiendo={alSubir}
            hoy={mostrarFecha(diaArgentina(Date.now()))}
          />
          <View accessibilityLabel="Si no pudiste cobrar" style={{ gap: space[3] }}>
            <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>Si no pudiste cobrar</Text>
            {verMotivos ? (
              MOTIVOS_NO_COBRO.map((m) => (
                <OptionCard key={m.valor} label={m.texto} selected={motivo === m.valor} onPress={() => setMotivo(m.valor)} />
              ))
            ) : (
              <Button label="No cobré" variant="secundario" onPress={() => setVerMotivos(true)} />
            )}
            {verMotivos ? (
              <>
                {motivo === null ? <MotivoDeshabilitado>Falta elegir el motivo</MotivoDeshabilitado> : null}
                <Button label="Cerrar sin cobrar" variant="secundario" disabled={motivo === null} loading={enviando} onPress={() => motivo !== null && onNoCobre(motivo)} />
              </>
            ) : null}
          </View>
          {error ? <Notice tone="peligro">{error}</Notice> : null}
        </ScrollView>
        <PieFijo conInsetInferior>
          <View style={{ gap: space[2], ...columna }}>
            {razon ? <MotivoDeshabilitado>{razon}</MotivoDeshabilitado> : null}
            <Button
              size="xl"
              label="Registrar cobro"
              disabled={razon !== null}
              loading={enviando}
              onPress={() => onCobrar(lineas)}
            />
          </View>
        </PieFijo>
      </View>
    </Modal>
  )
}

/** Las líneas armadas para mandar: el cuerpo de `cobrar` (misma forma que la entrega). */
export function lineasParaEnviar(lineas: LineaCobroForm[]) {
  return lineas.flatMap((l, i) => {
    const r = armarLinea(l, i + 1)
    return 'linea' in r ? [r.linea] : []
  })
}
