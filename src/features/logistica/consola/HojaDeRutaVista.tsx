import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { importe, radii, shadowMd, space, typeScale, useColors, useIsDark } from '@/libs/theme'
import { Button, Notice, StatusChip, formatImporte } from '@/core/ui/fw'
import { EstadoParada, type ParadaDto } from '@/libs/api-client/types'
import type { ParadaNumerada, ResumenRuta } from './hojaDeRuta'

interface Props {
  resumen: ResumenRuta
  soloLectura: boolean
  /** Antes de iniciar el recorrido no se reporta: se ve la ruta, nada más. */
  puedeReportar: boolean
  onReportar: (p: ParadaDto) => void
  onComoLlegar: (p: ParadaDto) => void
  onLlamar: (p: ParadaDto) => void
  puedeLlamar: (p: ParadaDto) => boolean
  onVerPedido: (p: ParadaDto) => void
  /** Comparte el PDF de la nota de entrega de la parada. */
  onNota: (p: ParadaDto) => void
  notaCargando: boolean
  pie?: React.ReactNode
}

/** Lámina ChoferRuta (y ChoferRutaOscuro): próxima parada destacada, las que siguen y las hechas. */
export function HojaDeRutaVista({ resumen, soloLectura, puedeReportar, onReportar, onComoLlegar, onLlamar, puedeLlamar, onVerPedido, onNota, notaCargando, pie }: Props) {
  const c = useColors()
  const sombra = shadowMd[useIsDark() ? 'dark' : 'light']
  const { proxima, despues, reportadas } = resumen
  const tituloSeccion = { ...typeScale.secundario, fontWeight: '600' as const, color: c.textSecondary }
  const tarjeta = { backgroundColor: c.surface, borderRadius: radii.tarjeta, ...sombra }

  return (
    <ScrollView contentContainerStyle={{ padding: space[4], gap: space[3] }}>
      {proxima ? (
        <>
          <Text style={tituloSeccion}>Próxima parada</Text>
          <View
            accessibilityLabel="Próxima parada"
            style={{ ...tarjeta, borderWidth: 2, borderColor: c.brand, padding: space[4], gap: space[3] }}
          >
            <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
              {`Parada ${proxima.numero} · ${proxima.parada.cantidadBultos} ${proxima.parada.cantidadBultos === 1 ? 'bulto' : 'bultos'}`}
            </Text>
            {/* El cliente se identifica por la dirección; el nombre va aparte. */}
            <View>
              <Text style={{ ...typeScale.titulo, color: c.text }}>{proxima.parada.direccion}</Text>
              <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>{proxima.parada.clienteNombre}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Total del pedido</Text>
              <Text style={{ ...typeScale.titulo, ...importe, color: c.text }}>{formatImporte(proxima.parada.montoTotal)}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: space[2] }}>
              <View style={{ flex: 1 }}>
                <Button label="Cómo llegar" variant="secundario" onPress={() => onComoLlegar(proxima.parada)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Llamar"
                  variant="secundario"
                  disabled={!puedeLlamar(proxima.parada)}
                  onPress={() => onLlamar(proxima.parada)}
                />
              </View>
            </View>
            {!soloLectura && puedeReportar ? (
              <Button label="Reportar entrega" onPress={() => onReportar(proxima.parada)} />
            ) : null}
            <View style={{ flexDirection: 'row', gap: space[2] }}>
              <View style={{ flex: 1 }}>
                <Button label="Ver pedido" variant="secundario" onPress={() => onVerPedido(proxima.parada)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Nota de entrega" variant="secundario" loading={notaCargando} onPress={() => onNota(proxima.parada)} />
              </View>
            </View>
          </View>
        </>
      ) : resumen.total > 0 ? (
        <Notice tone="exito" title="Ruta completa.">Todas las paradas están reportadas.</Notice>
      ) : (
        <Notice tone="info">Esta hoja de ruta no tiene paradas.</Notice>
      )}

      {despues.length > 0 ? (
        <>
          <Text style={tituloSeccion}>Después</Text>
          <View style={tarjeta}>
            {despues.map((n, i) => (
              <Fila key={n.parada.id} n={n} ultima={i === despues.length - 1} onPress={onVerPedido} />
            ))}
          </View>
        </>
      ) : null}

      {reportadas.length > 0 ? (
        <>
          <Text style={tituloSeccion}>Hechas</Text>
          <View style={tarjeta}>
            {reportadas.map((n, i) => (
              <Fila key={n.parada.id} n={n} ultima={i === reportadas.length - 1} onPress={onVerPedido} />
            ))}
          </View>
        </>
      ) : null}
      {pie}
    </ScrollView>
  )
}

function Fila({ n, ultima, onPress }: { n: ParadaNumerada; ultima: boolean; onPress: (p: ParadaDto) => void }) {
  const c = useColors()
  const { parada, numero } = n
  return (
    <Pressable
      onPress={() => onPress(parada)}
      accessibilityRole="button"
      accessibilityLabel={`Parada ${numero}: ${parada.direccion}`}
      accessibilityHint="Abre el pedido"
      style={{
        minHeight: 44,
        paddingVertical: space[3],
        paddingHorizontal: space[4],
        gap: space[1],
        borderBottomWidth: ultima ? 0 : 1,
        borderBottomColor: c.border,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2] }}>
        <Text style={{ ...typeScale.cuerpoDestacado, color: c.text, flex: 1 }}>{`${numero} · ${parada.direccion}`}</Text>
        {parada.estado === EstadoParada.Entregado ? <StatusChip estado="entregado" /> : null}
        {parada.estado === EstadoParada.NoEntregado ? <StatusChip estado="porAutorizar" label="No entregado" /> : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
        <Text style={{ ...typeScale.secundario, color: c.textSecondary, flex: 1 }}>
          {parada.estado === EstadoParada.NoEntregado && parada.motivoRechazo
            ? `${parada.clienteNombre} · ${parada.motivoRechazo}`
            : parada.clienteNombre}
        </Text>
        <Text style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.text }}>{formatImporte(parada.montoTotal)}</Text>
      </View>
    </Pressable>
  )
}
