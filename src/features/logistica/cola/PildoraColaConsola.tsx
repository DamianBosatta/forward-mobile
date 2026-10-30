import React, { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { RefreshCw } from 'lucide-react-native'
import { BottomSheet, formatImporte } from '@/core/ui/fw'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { partesArgentina } from '@/src/utils/date'
import type { AccionEnCola } from './colaConsola'

const horaDe = (ms: number) => {
  const p = partesArgentina(ms)
  return `${String(p.hora).padStart(2, '0')}:${String(p.minuto).padStart(2, '0')}`
}

const accionesTexto = (n: number) => `${n} ${n === 1 ? 'acción' : 'acciones'}`

/** Qué hizo el chofer, en sus palabras: "Entrega y cobro", "Entrega, cobro y devolución", "No pude entregar". */
export function queEs(a: AccionEnCola): string {
  if (a.tipo === 'noEntrega') return 'No pude entregar'
  const partes = ['entrega', ...(a.cobrado > 0 ? ['cobro'] : []), ...(a.conDevolucion ? ['devolución'] : [])]
  const texto = partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

interface Props {
  acciones: AccionEnCola[]
}

/**
 * Lámina chofer-01-viaje--sin-senal: la cola colapsada a una píldora ("3 acciones esperando señal") y una hoja con la
 * lista (qué, a quién y a qué hora) que abre "Ver". Sin ícono girando: el envío es invisible, la píldora solo cuenta.
 */
export function ColaConsola({ acciones }: Props) {
  const c = useColors()
  const [abierta, setAbierta] = useState(false)
  if (acciones.length === 0) return null
  const esperando = acciones.filter((a) => a.estado.tipo === 'esperando').length
  const aRevisar = acciones.length - esperando
  const texto = esperando > 0 ? `${accionesTexto(esperando)} esperando señal` : `${accionesTexto(aRevisar)} para revisar`
  const par = c.chip[esperando > 0 ? 'porAutorizar' : 'anulado']
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] }}>
        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={texto}
          style={{
            flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 44,
            paddingHorizontal: space[4], borderRadius: radii.pastilla, borderWidth: 2, borderColor: par.text, backgroundColor: par.bg,
          }}
        >
          <RefreshCw size={20} color={par.text} strokeWidth={2} />
          <Text style={{ ...typeScale.seccion, fontSize: 17, color: par.text, flexShrink: 1 }}>{texto}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver las acciones esperando señal"
          hitSlop={8}
          onPress={() => setAbierta(true)}
          style={{ minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ ...typeScale.seccion, fontSize: 17, color: c.brandInk }}>Ver</Text>
        </Pressable>
      </View>
      <BottomSheet visible={abierta} onClose={() => setAbierta(false)} accessibilityLabel="Acciones esperando señal">
        <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>Esperando señal</Text>
        <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>Se mandan solas, en este orden, cuando vuelva la conexión.</Text>
        <View style={{ gap: space[2], marginTop: space[3] }}>
          {acciones.map((a) => (
            <View
              key={a.clave}
              accessible
              style={{ gap: space[1], padding: space[3], borderRadius: radii.campo, backgroundColor: c.surface2 }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
                <Text style={{ ...typeScale.seccion, color: c.text, flexShrink: 1 }}>{queEs(a)}</Text>
                <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{horaDe(a.encoladaEn)}</Text>
              </View>
              <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>
                {a.tipo === 'entrega' && a.cobrado > 0 ? `${a.clienteNombre} · cobrado ${formatImporte(a.cobrado)}` : a.clienteNombre}
              </Text>
              {a.estado.tipo === 'revisar' ? (
                <Text style={{ ...typeScale.secundario, color: c.chip.anulado.text }}>{`Para revisar: ${a.estado.mensaje}`}</Text>
              ) : null}
            </View>
          ))}
        </View>
      </BottomSheet>
    </>
  )
}
