import React, { useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { RefreshCw } from 'lucide-react-native'
import { BottomSheet, Button, formatImporte } from '@/core/ui/fw'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { partesArgentina } from '@/core/utils/fecha'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { descartarAccion, reintentarAccion, type AccionEnCola } from './colaConsola'

const horaDe = (ms: number) => {
  const p = partesArgentina(ms)
  return `${String(p.hora).padStart(2, '0')}:${String(p.minuto).padStart(2, '0')}`
}

const accionesTexto = (n: number) => `${n} ${n === 1 ? 'acción' : 'acciones'}`

/** Qué hizo el chofer, en sus palabras: "Entrega y cobro", "Entrega, cobro y devolución", "No pude entregar". */
export function queEs(a: AccionEnCola): string {
  if (a.tipo === 'noEntrega') return 'No pude entregar'
  if (a.tipo === 'cobroParada') return 'Cobro'
  if (a.tipo === 'noCobroParada') return 'No cobré'
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
  const usuarioId = useAuthStore((st) => st.user?.id)
  const [abierta, setAbierta] = useState(false)
  if (acciones.length === 0) return null
  const esperando = acciones.filter((a) => a.estado.tipo === 'esperando').length
  const aRevisar = acciones.length - esperando
  const texto = esperando > 0 ? `${accionesTexto(esperando)} esperando señal` : `${accionesTexto(aRevisar)} para revisar`
  const par = c.chip[esperando > 0 ? 'porAutorizar' : 'anulado']
  const ayuda = aRevisar === 0
    ? 'Se mandan solas, en este orden, cuando vuelva la conexión.'
    : esperando === 0
      ? `${accionesTexto(aRevisar)} para revisar: no se mandan solas. Tocá Reintentar o Descartar en cada una.`
      : `Las que esperan señal se mandan solas, en este orden, cuando vuelva la conexión. ${accionesTexto(aRevisar)} para revisar: tocá Reintentar o Descartar.`
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
          <Text style={{ ...typeScale.seccion, color: par.text, flexShrink: 1 }}>{texto}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver las acciones esperando señal"
          hitSlop={8}
          onPress={() => setAbierta(true)}
          style={{ minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ ...typeScale.seccion, color: c.brandInk }}>Ver</Text>
        </Pressable>
      </View>
      <BottomSheet visible={abierta} onClose={() => setAbierta(false)} accessibilityLabel="Acciones esperando señal">
        <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>Esperando señal</Text>
        <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>{ayuda}</Text>
        <View style={{ gap: space[2], marginTop: space[3] }}>
          {acciones.map((a) => <FilaAccion key={a.clave} a={a} usuarioId={usuarioId} />)}
        </View>
      </BottomSheet>
    </>
  )
}

/** Qué y a quién, en minúscula, para las etiquetas de los botones: "entrega y cobro de Almacén Don Pepe". */
const deQuien = (a: AccionEnCola) => `${queEs(a).toLowerCase()} de ${a.clienteNombre}`

/**
 * Descartar pide confirmación: borra la acción solo del teléfono. Si el servidor no la tiene, la entrega o el cobro no
 * quedan registrados; si ya la tiene, no se anula nada allá.
 */
function confirmarDescarte(usuarioId: string, a: AccionEnCola) {
  Alert.alert(
    '¿Descartar esta acción?',
    `Se borra solo de este teléfono: ${deQuien(a)}. Si el servidor no la tiene, no queda registrada; avisale a la oficina.`,
    [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => descartarAccion(usuarioId, a.clave) },
    ],
  )
}

/** Una acción de la lista. Las que quedaron para revisar (rechazo o tope de intentos) se reintentan o se descartan acá. */
function FilaAccion({ a, usuarioId }: { a: AccionEnCola; usuarioId: string | undefined }) {
  const c = useColors()
  const revisar = a.estado.tipo === 'revisar' ? a.estado.mensaje : null
  return (
    <View style={{ gap: space[2], padding: space[3], borderRadius: radii.campo, backgroundColor: c.surface2 }}>
      <View accessible style={{ gap: space[1] }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
          <Text style={{ ...typeScale.seccion, color: c.text, flexShrink: 1 }}>{queEs(a)}</Text>
          <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{horaDe(a.encoladaEn)}</Text>
        </View>
        <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>
          {(a.tipo === 'entrega' || a.tipo === 'cobroParada') && a.cobrado > 0 ? `${a.clienteNombre} · cobrado ${formatImporte(a.cobrado)}` : a.clienteNombre}
        </Text>
        {revisar !== null ? (
          <Text style={{ ...typeScale.secundario, color: c.chip.anulado.text }}>{`Para revisar: ${revisar}`}</Text>
        ) : null}
      </View>
      {revisar !== null && usuarioId ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          <View style={{ flexGrow: 1, flexBasis: 140 }}>
            <Button
              label="Reintentar"
              icon={RefreshCw}
              variant="secundario"
              accessibilityLabel={`Reintentar ${deQuien(a)}`}
              onPress={() => reintentarAccion(usuarioId, a.clave)}
            />
          </View>
          <View style={{ flexGrow: 1, flexBasis: 140 }}>
            <Button
              label="Descartar"
              variant="peligroContorno"
              accessibilityLabel={`Descartar ${deQuien(a)}`}
              onPress={() => confirmarDescarte(usuarioId, a)}
            />
          </View>
        </View>
      ) : null}
    </View>
  )
}
