import React, { useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Check, Phone, ScanLine } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, TopBar } from '@/core/ui/fw'
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
  /** Teléfono de la empresa (`HojaRutaDetalleDto.telefonoEmpresa`); sin número válido no se ofrece llamar. */
  telefonoEmpresa?: string | null
  onLlamarEmpresa?: () => void
}

/**
 * Lámina chofer-02-llegue: qué se entrega acá. La lista de piezas es una ayuda visual: tildarlas o no
 * no cambia lo que se manda (el primario "Entregué todo" no pregunta por piezas sin tildar).
 */
export function LlegueParada({ parada, onVolver, onEntregueTodo, onNoPudeEntregar, telefonoEmpresa, onLlamarEmpresa }: Props) {
  const c = useColors()
  const { bottom } = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const columna = width >= 768 ? { maxWidth: 640, width: '100%' as const, alignSelf: 'center' as const } : null
  const piezas = piezasDeParada(parada)
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
    <Modal visible animationType="slide" onRequestClose={onVolver}>
      <View accessibilityLabel="Llegué" style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar title={parada.clienteNombre} subtitle={parada.direccion} leading={{ kind: 'atras', onPress: onVolver }} />
        <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4], ...columna }}>
          <Text accessibilityRole="header" style={{ ...typeScale.titulo, fontSize: 24, lineHeight: 32, color: c.text }}>
            {piezas.total > 0 ? `Tenés ${textoPiezas(piezas.total)} para entregar acá` : 'Entregá el pedido acá'}
          </Text>
          {piezas.total > 0 ? (
            <View style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, borderWidth: 1, borderColor: c.border }}>
              {Array.from({ length: piezas.total }, (_, i) => (
                <PiezaFila
                  key={i}
                  titulo={tituloPieza(i, piezas.total, piezas.etiquetas?.[i] ?? (piezas.numeros[i] != null ? `Bulto ${piezas.numeros[i]}` : null))}
                  marcada={marcadas.has(i)}
                  ultima={i === piezas.total - 1}
                  onPress={() => alternar(i)}
                />
              ))}
            </View>
          ) : null}
          {/* Sin etiquetas del servidor (TODO API) no se ofrece escanear. */}
          {piezas.etiquetas ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Escanear etiqueta"
                accessibilityHint="Tilda la pieza sola. Es opcional."
                onPress={() => setEscaneando(true)}
                style={{ minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3], borderRadius: radii.tarjeta, borderWidth: 2, borderColor: c.textSecondary, backgroundColor: c.surface }}
              >
                <View style={{ width: 48, height: 48, borderRadius: radii.campo, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
                  <ScanLine size={26} color={c.brandInk} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typeScale.seccion, color: c.text }}>Escanear etiqueta</Text>
                  <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Tilda la pieza sola. Es opcional.</Text>
                </View>
              </Pressable>
              <Text style={{ ...typeScale.cuerpo, color: c.textSecondary, textAlign: 'center' }}>{`${marcadas.size} de ${piezas.total} marcadas`}</Text>
              <EscanearEtiqueta visible={escaneando} etiquetas={piezas.etiquetas} marcadas={marcadas} onLeida={marcar} onCerrar={() => setEscaneando(false)} />
            </>
          ) : null}
        </ScrollView>
        <View style={{ backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.border, padding: space[4], paddingBottom: space[4] + bottom }}>
          <View style={{ gap: space[3], ...columna }}>
            <Button size="xl" icon={Check} label="Entregué todo" onPress={entregueTodo} />
            <Button size="xl" variant="secundario" label="No pude entregar" onPress={onNoPudeEntregar} />
            {onLlamarEmpresa && urlLlamar(telefonoEmpresa) ? (
              <Button size="xl" variant="secundario" icon={Phone} label="Llamar a la empresa" onPress={onLlamarEmpresa} />
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  )
}

/** Una pieza con casilla de 36 px y borde de 3 px (se lee al sol); tildada = relleno + tilde, nunca solo color. */
function PiezaFila({ titulo, marcada, ultima, onPress }: { titulo: string; marcada: boolean; ultima: boolean; onPress: () => void }) {
  const c = useColors()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityLabel={titulo}
      accessibilityState={{ checked: marcada }}
      style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], borderBottomWidth: ultima ? 0 : 1, borderBottomColor: c.border }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radii.campo,
          borderWidth: 3,
          borderColor: marcada ? c.action : c.textSecondary,
          backgroundColor: marcada ? c.action : c.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {marcada ? <Check size={22} color={c.onAction} strokeWidth={3} /> : null}
      </View>
      <Text style={{ ...typeScale.seccion, color: c.text, flex: 1 }}>{titulo}</Text>
    </Pressable>
  )
}
