import React, { useState } from 'react'
import { Modal, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Check, ChevronRight, Phone, ScanLine } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, TopBar, useColumnaDeFormulario } from '@/core/ui/fw'
import { PressableFx } from '@/core/ui/fw/PressableFx'
import { safeHaptics } from '@/core/utils/haptics'
import type { ParadaDto } from '@/libs/api-client/types'
import { EscanearEtiqueta } from './EscanearEtiqueta'
import { urlLlamar } from './hojaDeRuta'
import { piezasDeParada, textoPiezas, tituloPieza } from './piezasParada'

interface Props {
  parada: ParadaDto
  onVolver: () => void
  /** "Entregué todo": sigue al reporte de la entrega (quién recibió, remito, devolución, cobro). */
  onEntregueTodo: () => void
  onNoPudeEntregar: () => void
  /** "Llamar cliente": marca `parada.telefono`; sin número válido el botón queda apagado y dice por qué. */
  onLlamarCliente?: () => void
}

/**
 * Lámina chofer-02-llegue: qué se entrega acá. La lista de piezas es una ayuda visual: tildarlas o no
 * no cambia lo que se manda (el primario "Entregué todo" no pregunta por piezas sin tildar).
 */
export function LlegueParada({ parada, onVolver, onEntregueTodo, onNoPudeEntregar, onLlamarCliente }: Props) {
  const c = useColors()
  const { bottom } = useSafeAreaInsets()
  const columna = useColumnaDeFormulario()
  const piezas = piezasDeParada(parada)
  const puedeLlamar = urlLlamar(parada.telefono) !== null
  const [marcadas, setMarcadas] = useState<ReadonlySet<number>>(new Set())
  const [escaneando, setEscaneando] = useState(false)

  const alternar = (i: number) =>
    setMarcadas((prev) => {
      const next = new Set(prev)
      if (!next.delete(i)) next.add(i)
      return next
    })
  const marcar = (i: number) => setMarcadas((prev) => new Set(prev).add(i))
  const entregueTodo = () => {
    safeHaptics.impact('medium')
    onEntregueTodo()
  }

  return (
    <Modal visible animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onVolver}>
      <View accessibilityLabel="Llegué" style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar title={parada.clienteNombre} subtitle={parada.direccion} leading={{ kind: 'atras', onPress: onVolver }} />
        <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4], ...columna }}>
          <Text accessibilityRole="header" style={{ ...typeScale.tituloGrande, color: c.text }}>
            {piezas.total > 0 ? `Tenés ${textoPiezas(piezas.total)} para entregar acá` : 'Entregá el pedido acá'}
          </Text>
          {piezas.total > 0 ? (
            <View style={{ gap: space[2] }}>
              {Array.from({ length: piezas.total }, (_, i) => (
                <PiezaFila
                  key={i}
                  titulo={tituloPieza(i, piezas.total, piezas.etiquetas?.[i] ?? (piezas.numeros[i] != null ? `Bulto ${piezas.numeros[i]}` : null))}
                  marcada={marcadas.has(i)}
                  onPress={() => alternar(i)}
                />
              ))}
            </View>
          ) : null}
          {/* Sin etiquetas del servidor (TODO API) no se ofrece escanear. */}
          {piezas.etiquetas ? (
            <>
              <PressableFx
                accessibilityRole="button"
                accessibilityLabel="Escanear etiqueta"
                accessibilityHint="Tilda la pieza sola. Es opcional."
                onPress={() => setEscaneando(true)}
                android_ripple={{ color: c.surfaceAlt }}
                style={{ minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], paddingHorizontal: space[4], borderRadius: radii.fila, backgroundColor: c.surface }}
              >
                <View style={{ width: 44, height: 44, borderRadius: radii.pastilla, backgroundColor: c.lime, alignItems: 'center', justifyContent: 'center' }}>
                  <ScanLine size={24} color={c.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typeScale.seccion, color: c.text }}>Escanear etiqueta</Text>
                  <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Tilda la pieza sola. Es opcional.</Text>
                </View>
                <ChevronRight size={22} color={c.text} />
              </PressableFx>
              <Text style={{ ...typeScale.cuerpo, color: c.textSecondary, textAlign: 'center' }}>{`${marcadas.size} de ${piezas.total} marcadas`}</Text>
              <EscanearEtiqueta visible={escaneando} etiquetas={piezas.etiquetas} marcadas={marcadas} onLeida={marcar} onCerrar={() => setEscaneando(false)} />
            </>
          ) : null}
        </ScrollView>
        <View style={{ backgroundColor: c.bg, padding: space[4], paddingBottom: space[4] + bottom }}>
          <View style={{ gap: space[3], ...columna }}>
            <Button size="xl" variant="listo" icon={Check} label="Entregué todo" onPress={entregueTodo} />
            <View style={{ flexDirection: 'row', gap: space[3] }}>
              <View style={{ flex: 1 }}>
                <Button size="lg" variant="secundario" label="No pude entregar" onPress={onNoPudeEntregar} />
              </View>
              {onLlamarCliente ? (
                <View style={{ flex: 1 }}>
                  <Button size="lg" variant="secundario" icon={Phone} label="Llamar cliente" disabled={!puedeLlamar} onPress={onLlamarCliente} />
                </View>
              ) : null}
            </View>
            {onLlamarCliente && !puedeLlamar ? <Text style={{ ...typeScale.secundario, color: c.textSecondary, textAlign: 'center' }}>Este cliente no tiene teléfono cargado.</Text> : null}
          </View>
        </View>
      </View>
    </Modal>
  )
}

/**
 * Una pieza con casilla de 36 px (se lee al sol). Tildada: tarjeta teal con casilla ink y tilde lime;
 * sin tildar: tarjeta superficie con casilla de borde 3. Nunca solo color: el tilde marca el estado.
 */
function PiezaFila({ titulo, marcada, onPress }: { titulo: string; marcada: boolean; onPress: () => void }) {
  const c = useColors()
  return (
    <PressableFx
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityLabel={titulo}
      accessibilityState={{ checked: marcada }}
      android_ripple={{ color: c.surfaceAlt }}
      style={{ minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], borderRadius: radii.fila, backgroundColor: marcada ? c.teal : c.surface }}
    >
      <View
        testID="casilla-caja"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          borderWidth: 3,
          borderColor: marcada ? c.ink : c.textSecondary,
          backgroundColor: marcada ? c.ink : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {marcada ? <Check size={22} color={c.lime} strokeWidth={3} /> : null}
      </View>
      <Text style={{ ...typeScale.seccion, color: marcada ? c.ink : c.text, flex: 1 }}>{titulo}</Text>
    </PressableFx>
  )
}
