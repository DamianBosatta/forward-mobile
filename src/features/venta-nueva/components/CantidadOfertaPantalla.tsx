import React, { useState } from 'react'
import { Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { Package, Trash2 } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, Notice, StatusChip, TopBar, formatImporte } from '@/core/ui/fw'
import { MotivoDeshabilitado } from '@/core/ui/fw/MotivoDeshabilitado'
import type { CatalogoStockItem } from '@/libs/api-client'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { hasCapability } from '@/features/auth/lib/capabilities'
import { calcularSubtotalConDescuento, canViewCost, pctFromPrecio, precioFromPct } from '@/features/ventas/lib/descuentos'
import { calcularRentabilidadVenta } from '@/features/ventas/lib/rentabilidad-venta'
import { multiploDe, precioServidor, type LineaCarrito } from '../lib/carrito'
import { disponibleParaLinea, faltaStock } from '../lib/avisos'
import { MENSAJE_TOPE_SIN_CONFIGURAR, avisoPiso, avisoTope, leerNumero, mostrarNumero } from '../lib/linea'
import { MAX_DIGITOS, TOPE_CANTIDAD, errorDeCantidad, limitarDigitos } from '../lib/teclado'
import { chipsDeDescuento, presentacionDe, rotuloPresentacion, unidadesDe, valorEn, convertirModo, modoDeCantidad, type ModoCantidad } from '../lib/presentacion'
import { useCarritoVenta } from '../hooks/useCarritoVenta'

interface Props {
  /** Abierta o cerrada; al cerrarse se descarta lo tipeado. */
  visible: boolean
  /** Producto del catálogo con el stock vivo (`disponible` actualizado por el padre). Alta nueva o edición. */
  producto: CatalogoStockItem
  /** Línea que ya está en el carrito; sin ella es una alta (sin tacho de quitar). */
  linea?: LineaCarrito | null
  /** Señal de stock en vivo (`useStockVivoVenta().enVivo`); sin dato no se dibuja el indicador. */
  enVivo?: boolean
  /** Editando una venta: las unidades que ya tenía de este producto (ya descontadas del `disponible`). */
  yaReservada?: number
  /** Vuelve sin cambios, o después de quitar la línea. */
  onClose: () => void
  /** "Listo, seguir cargando": la línea ya quedó en el carrito; el padre cierra la pantalla. */
  onListo?: (linea: LineaCarrito) => void
}

const ROTULO_MODO: Record<ModoCantidad, string> = { bultos: 'Bultos', unidades: 'Unidades' }

/**
 * Cantidad y oferta (lámina Oferta, S4/S6/S7): pantalla completa que une "Cantidad" y "Editar línea".
 * El carrito guarda unidades; Bultos/Unidades solo cambia cómo se ingresan (solo Bultos si el producto
 * se vende únicamente por caja). Más de lo disponible avisa pero nunca bloquea: la venta va a autorización.
 * "Listo" y el tacho escriben en `useCarritoVenta` (reemplazar / quitar), como las hojas de hoy.
 */
export function CantidadOfertaPantalla(props: Props) {
  if (!props.visible) return null
  return <Contenido key={props.producto.id} {...props} />
}

function Contenido({ producto: p, linea, enVivo, yaReservada, onClose, onListo }: Props) {
  const c = useColors()
  const user = useAuthStore((s) => s.user)
  const reemplazar = useCarritoVenta((s) => s.reemplazar)
  const quitar = useCarritoVenta((s) => s.quitar)
  const base = precioServidor(p)
  const minimo = multiploDe(p)
  const pr = presentacionDe(p)
  const tope = user?.maxDescuentoPorcentaje ?? 0
  const exento = hasCapability(user?.permissions, 'CAP_EXENTO_TOPE_DESCUENTO')
  const verStock = hasCapability(user?.permissions, 'CAP_VER_CANTIDADES_STOCK')
  const verCosto = canViewCost(user?.permissions)

  const unidadesIniciales = linea?.cantidad ?? minimo
  const modoInicial: ModoCantidad = modoDeCantidad(pr, unidadesIniciales)
  const [modo, setModo] = useState<ModoCantidad>(modoInicial)
  const [texto, setTexto] = useState(String(valorEn(pr, modoInicial, unidadesIniciales)))
  const [pctTexto, setPctTexto] = useState(mostrarNumero(linea?.descuentoPct ?? 0))
  const [precioTexto, setPrecioTexto] = useState(mostrarNumero(precioFromPct(base, linea?.descuentoPct ?? 0)))

  const valor = /^\d+$/.test(texto.trim()) ? parseInt(texto, 10) : 0
  const unidades = unidadesDe(pr, modo, valor)
  const errorCantidad = errorDeCantidad(unidades, minimo)
  const pctLeido = leerNumero(pctTexto)
  const precioLeido = leerNumero(precioTexto)
  const pctInvalido = pctLeido === null || pctLeido < 0 || pctLeido > 100
  const precioInvalido = precioLeido === null || precioLeido < 0 || precioLeido > base
  const pct = pctInvalido ? 0 : pctLeido
  const precioFinal = precioFromPct(base, pct)
  const deshabilitado = errorCantidad !== null || pctInvalido || precioInvalido
  const avisoDeTope = avisoTope(pct, tope, exento)
  const piso = avisoPiso(p, base, pct)
  // Lo que se tipea es la línea: la misma regla de falta de stock que la revisión (sin CAP_VER_CANTIDADES_STOCK decide `puedeVenderse`).
  const lineaTipeada: LineaCarrito = { productoId: p.id, producto: p, cantidad: unidades, descuentoPct: pct }
  const yaReservadas = yaReservada ? { [p.id]: yaReservada } : undefined
  const disponible = disponibleParaLinea(lineaTipeada, yaReservadas)
  const restan = disponible - unidades
  const deMas = faltaStock(lineaTipeada, verStock, yaReservadas)
  const margen = verCosto
    ? calcularRentabilidadVenta({ detalles: [{ precioUnitario: precioFinal, precioCostoSnapshot: p.precioCompraBase, cantidad: unidades }], subtotalBruto: precioFinal * unidades, montoDescuento: 0 })
    : null

  const secundario = { ...typeScale.secundario, color: c.textSecondary }
  const destacado = { ...typeScale.cuerpoDestacado, color: c.text }
  const tarjeta = { padding: space[3], borderRadius: radii.tarjeta, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }
  const campo = { minHeight: 48, borderRadius: radii.campo, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, paddingHorizontal: space[3], color: c.text, ...typeScale.cuerpoDestacado, ...importe }

  const poner = (nuevoPct: number) => {
    setPctTexto(mostrarNumero(nuevoPct))
    setPrecioTexto(mostrarNumero(precioFromPct(base, nuevoPct)))
  }
  const mover = (delta: number) => setTexto(String(Math.min(TOPE_CANTIDAD, Math.max(pr.paso[modo], valor + delta * pr.paso[modo]))))
  const cambiarModo = (m: ModoCantidad) => {
    if (m === modo) return
    setModo(m)
    setTexto(String(valorEn(pr, m, convertirModo(pr, m, unidades > 0 ? unidades : minimo))))
  }
  const listo = () => {
    const nueva: LineaCarrito = { productoId: p.id, producto: p, cantidad: unidades, descuentoPct: pct }
    reemplazar(nueva)
    onListo?.(nueva)
  }
  const quitarLinea = () => {
    quitar(p.id)
    onClose()
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View testID="cantidad-oferta" accessibilityLabel="Cantidad y oferta" style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar
          title="Cantidad y oferta"
          leading={{ kind: 'atras', onPress: onClose }}
          actions={linea ? [{ icon: Trash2, accessibilityLabel: 'Quitar la línea', onPress: quitarLinea }] : []}
        />

        <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4] }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'center' }}>
            <View style={{ width: 84, height: 84, borderRadius: radii.tarjeta, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {p.imageUrl ? <Image source={{ uri: p.imageUrl }} style={{ width: 84, height: 84 }} accessibilityIgnoresInvertColors /> : <Package size={28} color={c.textSecondary} />}
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={{ ...typeScale.etiqueta, color: c.textSecondary }}>{[p.marca, p.codigoPropio].filter(Boolean).join(' · ')}</Text>
              <Text style={{ ...typeScale.titulo, color: c.text }}>{p.nombre}</Text>
              <Text style={secundario}>{`${rotuloPresentacion(pr)} · lista ${formatImporte(base)}`}</Text>
            </View>
          </View>

          <View testID="oferta-stock" style={{ ...tarjeta, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] }}>
            {verStock ? (
              <>
                <View accessible accessibilityLabel={`Disponible: ${disponible}`}>
                  <Text style={secundario}>Disponible</Text>
                  <Text style={{ ...typeScale.titulo, ...importe, color: c.text }}>{disponible}</Text>
                </View>
                <View accessible accessibilityLabel={`Te quedan: ${restan}`}>
                  <Text style={secundario}>Te quedan</Text>
                  <Text style={{ ...typeScale.titulo, ...importe, color: restan < 0 ? c.chip.anulado.text : c.text }}>{restan}</Text>
                </View>
              </>
            ) : (
              <StatusChip estado={p.puedeVenderse ? 'entregado' : 'anulado'} label={p.puedeVenderse ? 'Hay stock' : 'Sin stock'} />
            )}
            {enVivo === undefined ? null : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
                <View style={{ width: 8, height: 8, borderRadius: radii.pastilla, backgroundColor: enVivo ? c.chip.entregado.text : c.textSecondary }} />
                <Text style={{ ...typeScale.secundario, fontWeight: '600', color: enVivo ? c.chip.entregado.text : c.textSecondary }}>{enVivo ? 'En vivo' : 'Sin conexión'}</Text>
              </View>
            )}
          </View>
          {deMas ? <Notice tone="advertencia">Pediste más de lo disponible: la venta va a autorización</Notice> : null}

          <View style={{ gap: space[2] }}>
            <Text style={secundario}>Cantidad</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              {pr.modos.length > 1 ? (
                <View accessibilityRole="radiogroup" accessibilityLabel="Presentación" style={{ flexDirection: 'row', padding: 3, borderRadius: radii.tarjeta, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border }}>
                  {pr.modos.map((m) => (
                    <Pressable key={m} accessibilityRole="button" accessibilityLabel={ROTULO_MODO[m]} accessibilityState={{ selected: modo === m }} onPress={() => cambiarModo(m)}
                      style={{ minHeight: 40, paddingHorizontal: space[3], borderRadius: radii.campo, justifyContent: 'center', backgroundColor: modo === m ? c.action : 'transparent' }}>
                      <Text style={{ ...typeScale.cuerpoDestacado, color: modo === m ? c.onAction : c.textSecondary }}>{ROTULO_MODO[m]}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={destacado}>{ROTULO_MODO[pr.modos[0]]}</Text>
              )}
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, borderRadius: radii.campo, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border }}>
                <Pressable accessibilityRole="button" accessibilityLabel="Uno menos" onPress={() => mover(-1)} style={{ width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ ...typeScale.titulo, color: c.text }}>−</Text>
                </Pressable>
                <TextInput accessibilityLabel="Cantidad" keyboardType="number-pad" value={texto} onChangeText={(t) => setTexto(limitarDigitos(t))} maxLength={MAX_DIGITOS} selectTextOnFocus
                  style={{ ...typeScale.titulo, ...importe, color: c.text, minWidth: 56, textAlign: 'center' }} />
                <Pressable accessibilityRole="button" accessibilityLabel="Uno más" onPress={() => mover(1)} style={{ width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ ...typeScale.titulo, color: c.brandInk }}>+</Text>
                </Pressable>
              </View>
            </View>
            <Text style={secundario}>{`${unidades} ${unidades === 1 ? 'unidad' : 'unidades'} en total`}</Text>
            {errorCantidad ? <MotivoDeshabilitado>{errorCantidad}</MotivoDeshabilitado> : null}
          </View>

          <View style={{ ...tarjeta, gap: space[3] }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text style={destacado}>Oferta</Text>
              <Text style={secundario}>{exento ? 'Sin tope' : `Tu tope: ${mostrarNumero(tope)} %`}</Text>
            </View>
            <View testID="oferta-descuentos" style={{ flexDirection: 'row', gap: space[2] }}>
              {chipsDeDescuento(tope, exento).map((o) => {
                const activo = !pctInvalido && pct === o
                return (
                  <Pressable key={o} accessibilityRole="button" accessibilityLabel={`${o} %`} accessibilityState={{ selected: activo }} onPress={() => poner(o)}
                    style={{ flex: 1, minHeight: 44, borderRadius: radii.campo, alignItems: 'center', justifyContent: 'center', backgroundColor: activo ? c.action : c.surface2, borderWidth: activo ? 0 : 1, borderColor: c.border }}>
                    <Text style={{ ...typeScale.cuerpoDestacado, color: activo ? c.onAction : c.text }}>{`${o} %`}</Text>
                  </Pressable>
                )
              })}
            </View>
            <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: space[1] }}>
                <Text style={secundario}>Descuento</Text>
                <TextInput accessibilityLabel="Descuento (%)" keyboardType="decimal-pad" value={pctTexto} style={campo}
                  onChangeText={(t) => {
                    setPctTexto(t)
                    const n = leerNumero(t)
                    if (n !== null && n >= 0 && n <= 100) setPrecioTexto(mostrarNumero(precioFromPct(base, n)))
                  }} />
                {pctInvalido ? <Text style={{ ...typeScale.secundario, color: c.chip.anulado.text }}>Ingresá un descuento entre 0 y 100.</Text> : null}
              </View>
              <View style={{ flex: 1.4, gap: space[1] }}>
                <Text style={secundario}>Precio con descuento</Text>
                <TextInput accessibilityLabel="Precio con descuento ($)" keyboardType="decimal-pad" value={precioTexto} style={campo}
                  onChangeText={(t) => {
                    setPrecioTexto(t)
                    const n = leerNumero(t)
                    if (n !== null && n >= 0 && n <= base) setPctTexto(mostrarNumero(pctFromPrecio(base, n)))
                  }} />
                {precioInvalido ? <Text style={{ ...typeScale.secundario, color: c.chip.anulado.text }}>{`Ingresá un precio entre 0 y ${formatImporte(base)}.`}</Text> : null}
              </View>
            </View>
            <Text style={secundario}>Cambiás uno y el otro se recalcula solo.</Text>
            {avisoDeTope === 'porAutorizar' ? <Notice tone="advertencia">{`Tu tope de descuento es ${mostrarNumero(tope)} %. Con ${mostrarNumero(pct)} % la venta va a necesitar autorización.`}</Notice> : null}
            {avisoDeTope === 'sinConfigurar' ? <Notice tone="peligro">{MENSAJE_TOPE_SIN_CONFIGURAR}</Notice> : null}
            {piso === 'rojo' ? <Notice tone="peligro" title="Debajo del costo.">El sistema no deja guardar la venta con este precio.</Notice> : null}
            {piso === 'amarillo' ? <Notice tone="advertencia" title={`Debajo del precio mínimo (${formatImporte(p.precioMinimoRentable)}).`}>Va a quedar por autorizar.</Notice> : null}
          </View>

          {verCosto ? (
            <View testID="oferta-costos" style={{ ...tarjeta, gap: space[1] }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ ...typeScale.secundario, color: c.text }}>Precio de compra</Text>
                <Text style={{ ...typeScale.secundario, ...importe, color: c.text }}>{formatImporte(p.precioCompraBase)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ ...typeScale.secundario, color: c.text }}>Margen de la línea</Text>
                <Text style={{ ...typeScale.secundario, ...importe, color: c.text }}>{margen ? `${mostrarNumero(margen.margenPct)} %` : '—'}</Text>
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={{ padding: space[4], gap: space[2], borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={secundario}>{`${unidades} × ${formatImporte(precioFinal)}`}</Text>
            <Text testID="oferta-subtotal" style={{ ...typeScale.titulo, ...importe, color: c.text }}>{formatImporte(calcularSubtotalConDescuento(base, unidades, pct))}</Text>
          </View>
          <Button label="Listo, seguir cargando" disabled={deshabilitado} onPress={listo} />
        </View>
      </View>
    </Modal>
  )
}
