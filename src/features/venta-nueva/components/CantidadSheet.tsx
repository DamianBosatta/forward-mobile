import React, { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { BottomSheet, Button, Field, Notice, formatImporte } from '@/core/ui/fw'
import { MotivoDeshabilitado } from '@/core/ui/fw/MotivoDeshabilitado'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { hasCapability } from '@/features/auth/lib/capabilities'
import { calcularSubtotalConDescuento, precioFromPct } from '@/features/ventas/lib/descuentos'
import { multiploDe, precioServidor, type LineaCarrito } from '../lib/carrito'
import { MENSAJE_TOPE_SIN_CONFIGURAR, avisoTope, leerNumero, mostrarNumero } from '../lib/linea'
import { cantidadDeTeclas, errorDeCantidad, teclear } from '../lib/teclado'

interface Props {
  /** Línea a editar; null = cerrada. */
  linea: LineaCarrito | null
  onClose: () => void
  onConfirm: (linea: LineaCarrito) => void
  onQuitar: (productoId: string) => void
  /** Abre "Editar línea" (precio con descuento, semáforo del servidor, stock y margen). */
  onDetalle?: (linea: LineaCarrito) => void
}

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clr', '0', 'del'] as const
const ROTULO_TECLA = { clr: 'C', del: '⌫' } as const
const ARIA_TECLA = { clr: 'Borrar todo', del: 'Borrar' } as const
const CAJAS = [1, 2, 4, 8]

/**
 * Los descuentos que se ofrecen de un toque: sin descuento, 5 % y el tope del vendedor, sin pasarse de su tope
 * (quien está exento no tiene tope). Para otro valor está "Otro", que sí deja pasarse y avisa que queda por autorizar.
 */
export function opcionesDeDescuento(tope: number, exento = false): number[] {
  const hasta = exento ? 100 : tope
  return [...new Set([0, 5, tope].filter((p) => p >= 0 && p <= hasta))].sort((a, b) => a - b)
}

export function CantidadSheet(props: Props) {
  if (!props.linea) return null
  return <Contenido key={props.linea.productoId} {...props} linea={props.linea} />
}

function Contenido({ linea, onClose, onConfirm, onQuitar, onDetalle }: Props & { linea: LineaCarrito }) {
  const c = useColors()
  const user = useAuthStore((s) => s.user)
  const p = linea.producto
  const base = precioServidor(p)
  const m = multiploDe(p)
  const tope = user?.maxDescuentoPorcentaje ?? 0
  const exento = hasCapability(user?.permissions, 'CAP_EXENTO_TOPE_DESCUENTO')
  const [texto, setTexto] = useState(String(linea.cantidad))
  const [pctTexto, setPctTexto] = useState(mostrarNumero(linea.descuentoPct))
  const [otro, setOtro] = useState(false)
  const cantidad = cantidadDeTeclas(texto)
  const pctLeido = leerNumero(pctTexto)
  const pctInvalido = pctLeido === null || pctLeido < 0 || pctLeido > 100
  const pct = pctInvalido ? 0 : pctLeido
  const opciones = opcionesDeDescuento(tope, exento)
  const enOtro = otro || !opciones.includes(pct)
  const aviso = avisoTope(pct, tope, exento)
  const errorCantidad = errorDeCantidad(cantidad, m)
  const deshabilitado = errorCantidad !== null || pctInvalido
  const secundario = { ...typeScale.secundario, color: c.textSecondary }
  const chip = (activo: boolean) => ({
    minHeight: 44, paddingHorizontal: space[4], borderRadius: radii.pastilla, justifyContent: 'center' as const,
    backgroundColor: activo ? c.action : c.surface, borderWidth: activo ? 0 : 1, borderColor: c.border,
  })

  return (
    <BottomSheet visible onClose={onClose} accessibilityLabel="Cantidad y descuento">
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}>
        <View style={{ flex: 1 }}>
          <Text style={secundario}>{[p.codigoPropio, p.puedeVenderse ? 'Hay stock' : 'Sin stock'].filter(Boolean).join(' · ')}</Text>
          <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>{p.nombre}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Quitar la línea" onPress={() => onQuitar(p.id)} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ ...typeScale.cuerpoDestacado, color: c.brandInk }}>Quitar</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: space[3] }}>
        <View style={{ flex: 1, padding: space[3], borderRadius: radii.tarjeta, backgroundColor: c.surface2 }}>
          <Text style={secundario}>Cantidad</Text>
          <Text accessibilityLabel={`Cantidad: ${cantidad}`} style={{ ...typeScale.titulo, ...importe, color: c.text }}>{texto || '0'}</Text>
        </View>
        <View style={{ flex: 1, padding: space[3], borderRadius: radii.tarjeta, backgroundColor: c.surface2 }}>
          <Text style={secundario}>Subtotal</Text>
          <Text testID="cantidad-subtotal" style={{ ...typeScale.titulo, ...importe, color: c.text }}>{formatImporte(calcularSubtotalConDescuento(base, cantidad, pct))}</Text>
          <Text style={{ ...secundario, ...importe }}>{`${formatImporte(precioFromPct(base, pct))} c/u`}</Text>
        </View>
      </View>

      {m > 1 ? (
        <View style={{ gap: space[2] }}>
          <Text style={secundario}>Por caja</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {CAJAS.map((k) => (
              <Pressable key={k} accessibilityRole="button" accessibilityLabel={`${k} ${k === 1 ? 'caja' : 'cajas'}, ${k * m} unidades`} accessibilityState={{ selected: cantidad === k * m }}
                onPress={() => setTexto(String(k * m))} style={chip(cantidad === k * m)}>
                <Text style={{ ...typeScale.cuerpoDestacado, color: cantidad === k * m ? c.onAction : c.text }}>{`${k} · ${k * m}`}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ gap: space[2] }}>
        <Text style={secundario}>{tope > 0 ? `Descuento · tu tope ${mostrarNumero(tope)} %` : 'Descuento'}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          {opciones.map((o) => {
            const activo = !enOtro && pct === o
            return (
              <Pressable key={o} accessibilityRole="button" accessibilityLabel={`${mostrarNumero(o)} %`} accessibilityState={{ selected: activo }}
                onPress={() => { setOtro(false); setPctTexto(mostrarNumero(o)) }} style={chip(activo)}>
                <Text style={{ ...typeScale.cuerpoDestacado, color: activo ? c.onAction : c.text }}>{o === tope && o > 5 ? `${mostrarNumero(o)} % tope` : `${mostrarNumero(o)} %`}</Text>
              </Pressable>
            )
          })}
          <Pressable accessibilityRole="button" accessibilityLabel="Otro descuento" accessibilityState={{ selected: enOtro }} onPress={() => setOtro(true)} style={chip(enOtro)}>
            <Text style={{ ...typeScale.cuerpoDestacado, color: enOtro ? c.onAction : c.text }}>Otro</Text>
          </Pressable>
        </View>
        {enOtro ? (
          <Field label="Descuento (%)" keyboardType="decimal-pad" alignRight value={pctTexto} onChangeText={setPctTexto}
            error={pctInvalido ? 'Ingresá un descuento entre 0 y 100.' : undefined} />
        ) : null}
        {aviso === 'porAutorizar' ? (
          <Notice tone="advertencia">{`Supera tu tope de ${mostrarNumero(tope)} %: el pedido queda por autorizar.`}</Notice>
        ) : null}
        {aviso === 'sinConfigurar' ? <Notice tone="peligro">{MENSAJE_TOPE_SIN_CONFIGURAR}</Notice> : null}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        {TECLAS.map((t) => (
          <Pressable key={t} accessibilityRole="button" accessibilityLabel={t in ARIA_TECLA ? ARIA_TECLA[t as keyof typeof ARIA_TECLA] : t}
            onPress={() => setTexto((a) => teclear(a, t))}
            style={{ width: '31%', flexGrow: 1, minHeight: 52, borderRadius: radii.campo, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface2 }}>
            <Text style={{ ...typeScale.titulo, color: c.text }}>{t in ROTULO_TECLA ? ROTULO_TECLA[t as keyof typeof ROTULO_TECLA] : t}</Text>
          </Pressable>
        ))}
      </View>

      <Button label="Listo" disabled={deshabilitado} onPress={() => onConfirm({ ...linea, cantidad, descuentoPct: pct })} />
      {errorCantidad ? <MotivoDeshabilitado>{errorCantidad}</MotivoDeshabilitado> : null}
      {onDetalle ? (
        <Pressable accessibilityRole="link" onPress={() => onDetalle({ ...linea, cantidad: cantidad > 0 ? cantidad : linea.cantidad, descuentoPct: pct })} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ ...typeScale.cuerpoDestacado, color: c.brandInk }}>Ver precio, stock y margen</Text>
        </Pressable>
      ) : null}
    </BottomSheet>
  )
}
