import React from 'react'
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Check, Navigation } from 'lucide-react-native'
import { importe, radii, shadowMd, space, typeScale, useColors, useIsDark } from '@/libs/theme'
import { Button, Notice, StatusChip, formatImporte } from '@/core/ui/fw'
import { EstadoParada, type ParadaDto } from '@/libs/api-client/types'
import type { ParadaNumerada, ResumenRuta } from './hojaDeRuta'
import { chipCobro, etiquetaNota, importeParada, leyendaSinCobro } from './cobroParada'
import { ParadaGrande } from './ParadaGrande'
import { piezasDeParada, textoPiezas } from './piezasParada'

interface Props {
  resumen: ResumenRuta
  soloLectura: boolean
  /** Antes de iniciar el recorrido no se reporta: se ve la ruta, nada más. */
  puedeReportar: boolean
  /** "¡Llegué!": abre la pantalla de la parada. */
  onLlegue: (p: ParadaDto) => void
  onComoLlegar: (p: ParadaDto) => void
  onLlamar: (p: ParadaDto) => void
  puedeLlamar: (p: ParadaDto) => boolean
  onVerPedido: (p: ParadaDto) => void
  /** Comparte el PDF de la nota de entrega de la parada. */
  onNota: (p: ParadaDto) => void
  notaCargando: boolean
  /** Progreso y total a cobrar del día, arriba de la próxima parada. */
  cabecera?: React.ReactNode
  /** Avisos (sin señal, hoja ajena…), entre la cabecera y la parada. */
  avisos?: React.ReactNode
  /** Acción del viaje en la barra fija (Iniciar recorrido, Finalizar, Cambiar de ruta). */
  pie?: React.ReactNode
}

/** Láminas chofer-01-viaje: próxima parada grande, las que siguen compactas y las hechas; barra fija con Ir y ¡Llegué!. */
export function HojaDeRutaVista({ resumen, soloLectura, puedeReportar, onLlegue, onComoLlegar, onLlamar, puedeLlamar, onVerPedido, onNota, notaCargando, cabecera, avisos, pie }: Props) {
  const c = useColors()
  const { bottom } = useSafeAreaInsets()
  const sombra = shadowMd[useIsDark() ? 'dark' : 'light']
  const { proxima, despues, reportadas } = resumen
  // Tablet: la hoja queda en una columna legible, no estirada.
  const { width } = useWindowDimensions()
  const columna = width >= 768 ? { maxWidth: 640, width: '100%' as const, alignSelf: 'center' as const } : null
  const tituloSeccion = { ...typeScale.seccion, color: c.text }
  const tarjeta = { backgroundColor: c.surface, borderRadius: radii.tarjeta, ...sombra }
  const puedeLlegar = !!proxima && !soloLectura && puedeReportar

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[3], ...columna }}>
        {cabecera}
        {avisos}
        {proxima ? (
          <ParadaGrande
            parada={proxima.parada}
            numero={proxima.numero}
            total={resumen.total}
            puedeLlamar={puedeLlamar(proxima.parada)}
            notaCargando={notaCargando}
            onLlamar={() => onLlamar(proxima.parada)}
            onVerPedido={() => onVerPedido(proxima.parada)}
            onNota={() => onNota(proxima.parada)}
          />
        ) : resumen.total > 0 ? (
          <Notice tone="exito" title="Ruta completa.">Todas las paradas están reportadas.</Notice>
        ) : (
          <Notice tone="info">Esta hoja de ruta no tiene paradas.</Notice>
        )}

        {despues.length > 0 ? (
          <>
            <Text accessibilityRole="header" style={tituloSeccion}>{`Después (${despues.length})`}</Text>
            <View style={tarjeta}>
              {despues.map((n, i) => (
                <Fila key={n.parada.id} n={n} ultima={i === despues.length - 1} onPress={onVerPedido} />
              ))}
            </View>
          </>
        ) : null}

        {reportadas.length > 0 ? (
          <>
            <Text accessibilityRole="header" style={tituloSeccion}>{`Hechas (${reportadas.length})`}</Text>
            <View style={tarjeta}>
              {reportadas.map((n, i) => (
                <Fila key={n.parada.id} n={n} ultima={i === reportadas.length - 1} onPress={onVerPedido} />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
      {proxima || pie ? (
        <View style={{ backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border, padding: space[4], paddingBottom: space[4] + bottom }}>
          <View style={{ gap: space[3], ...columna }}>
            {proxima ? (
              <View style={{ flexDirection: 'row', gap: space[3] }}>
                <View style={{ width: puedeLlegar ? 112 : undefined, flex: puedeLlegar ? undefined : 1 }}>
                  <Button size="xl" variant="secundario" icon={Navigation} label="Ir" accessibilityLabel="Cómo llegar" onPress={() => onComoLlegar(proxima.parada)} />
                </View>
                {puedeLlegar ? (
                  <View style={{ flex: 1 }}>
                    <Button size="xl" icon={Check} label="¡Llegué!" onPress={() => onLlegue(proxima.parada)} />
                  </View>
                ) : null}
              </View>
            ) : null}
            {pie}
          </View>
        </View>
      ) : null}
    </View>
  )
}

function Fila({ n, ultima, onPress }: { n: ParadaNumerada; ultima: boolean; onPress: (p: ParadaDto) => void }) {
  const c = useColors()
  const { parada, numero } = n
  const pendiente = parada.estado === EstadoParada.Pendiente
  return (
    <Pressable
      onPress={() => onPress(parada)}
      accessibilityRole="button"
      accessibilityLabel={`Parada ${numero}: ${parada.direccion}`}
      accessibilityHint="Abre el pedido"
      style={{
        minHeight: 64,
        paddingVertical: space[3],
        paddingHorizontal: space[4],
        gap: space[1],
        borderBottomWidth: ultima ? 0 : 1,
        borderBottomColor: c.border,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2] }}>
        <Text style={{ ...typeScale.cuerpoDestacado, color: c.text, flex: 1 }}>{`${numero} · ${parada.direccion}`}</Text>
        {/* Estado = texto + ícono del chip, nunca solo color. */}
        {parada.estado === EstadoParada.Entregado ? <StatusChip estado="entregado" /> : null}
        {parada.estado === EstadoParada.NoEntregado ? <StatusChip estado="porAutorizar" label="No entregado" /> : null}
        {pendiente ? <ChipCobro parada={parada} /> : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
        <Text style={{ ...typeScale.secundario, color: c.textSecondary, flex: 1 }}>
          {parada.estado === EstadoParada.NoEntregado && parada.motivoRechazo
            ? `${parada.clienteNombre} · ${parada.motivoRechazo}`
            : `${parada.clienteNombre} · ${textoPiezas(piezasDeParada(parada).total)}`}
        </Text>
        {/* Las ya reportadas (Hechas) muestran el total del pedido como antes: no hay nada que cobrar. */}
        {!pendiente ? (
          <Text style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.text }}>{formatImporte(parada.montoTotal)}</Text>
        ) : leyendaSinCobro(parada) ? (
          <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
            {[etiquetaNota(parada), leyendaSinCobro(parada)].filter(Boolean).join(' · ')}
          </Text>
        ) : (
          <Text style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.text }}>{formatImporte(importeParada(parada).valor)}</Text>
        )}
      </View>
    </Pressable>
  )
}

function ChipCobro({ parada }: { parada: ParadaDto }) {
  const chip = chipCobro(parada)
  return chip ? <StatusChip estado={chip.estado} label={chip.label} /> : null
}
