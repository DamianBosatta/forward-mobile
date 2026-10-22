import React from 'react'
import { Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Info, Phone, RotateCcw, ScanBarcode, Search } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Notice, Segmented, formatImporte } from '@/core/ui/fw'
import { MotivoDeshabilitado } from '@/core/ui/fw/MotivoDeshabilitado'
import { useSocio } from '@/libs/api-client/socios'
import type { Venta } from '@/libs/api-client/types'
import { partesArgentina } from '@/src/utils/date'
import type { TipoDocumento } from '@/features/clientes/components/SeleccionarClienteSheet'
import { AVISO_DEUDA_VENCIDA, textoDisponible } from '@/features/clientes/components/CreditoDelCliente'
import { urlLlamar } from '@/features/clientes/lib/contacto'
import { direccionDeEntrega, inicialesDeDireccion, nombreDelCliente } from '@/features/clientes/lib/cliente'
import type { ClienteElegido } from '@/features/clientes/lib/recientes'
import { useUltimoPedido } from '../hooks/useUltimoPedido'

export type ViaDeArranque = 'repetir' | 'catalogo' | 'escanear'

interface Props {
  cliente: ClienteElegido
  tipo: TipoDocumento
  onTipo: (t: TipoDocumento) => void
  /** `repetir` lleva el pedido a repetir; las otras dos, nada. */
  onArrancar: (via: ViaDeArranque, ultimo?: Venta) => void
}

const TIPOS = [
  { value: 'Presupuesto' as const, label: 'Presupuesto' },
  { value: 'Pedido' as const, label: 'Pedido' },
]

/** "11/10" del día argentino de la venta. */
const diaYMes = (fecha: string) => {
  const p = partesArgentina(Date.parse(fecha))
  return `${String(p.dia).padStart(2, '0')}/${String(p.mes + 1).padStart(2, '0')}`
}

/**
 * V3 "¿Cómo arrancás?" (CalleArranque / panel derecho de TabCalleCliente): el cliente elegido con su crédito y su
 * deuda (lo que el servidor deja ver), el tipo de venta y las tres formas de empezar. "Repetir el último pedido"
 * sale del historial que ya existe y promete los precios y el stock de hoy (D5); "lo que suele llevar" no está.
 */
export function ArranqueVenta({ cliente, tipo, onTipo, onArrancar }: Props) {
  const c = useColors()
  const router = useRouter()
  const socio = useSocio(cliente.id)
  const { ultimo, cargando } = useUltimoPedido(cliente.id)
  const direccion = direccionDeEntrega(cliente)
  const nombre = nombreDelCliente(cliente)
  const s = socio.data
  const telefono = s?.telefono?.trim()
  // Crédito y deuda: solo si el servidor los manda y deja ver importes (`puedeVerSaldo`); si no, no se muestran.
  const disponible = s?.puedeVerSaldo === true && typeof s.creditoDisponible === 'number' ? s.creditoDisponible : null
  const vencida = s?.tieneDeudaVencida === true
  const montoVencido = vencida && typeof s?.deudaVencidaAmount === 'number' ? s.deudaVencidaAmount : null
  const subtitulo = nombre

  const tarjeta = (principal: boolean) => ({
    flexDirection: 'row' as const, gap: space[3], alignItems: 'center' as const, padding: space[4], borderRadius: radii.tarjeta,
    backgroundColor: c.surface, borderWidth: principal ? 2 : 1, borderColor: principal ? c.brand : c.border,
  })
  const icono = (children: React.ReactNode, destacado: boolean) => (
    <View style={{ width: 48, height: 48, borderRadius: radii.campo, alignItems: 'center', justifyContent: 'center', backgroundColor: destacado ? c.brandSoft : c.surface2 }}>{children}</View>
  )

  const cantidad = ultimo?.itemsCount ?? 0
  const detalleUltimo = ultimo
    ? `${diaYMes(ultimo.fecha)} · ${cantidad} ${cantidad === 1 ? 'producto' : 'productos'} · ${formatImporte(ultimo.totalAmount)}`
    : cargando ? 'Buscando su último pedido…' : 'Todavía no tiene pedidos para repetir.'

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ gap: space[4] }}>
      <View style={{ backgroundColor: c.topBar, paddingHorizontal: space[3], paddingBottom: space[4], flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <View style={{ width: 52, height: 52, borderRadius: radii.pastilla, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ ...typeScale.titulo, color: c.brandInk }}>{inicialesDeDireccion(direccion)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ ...typeScale.titulo, color: c.onTopBarStrong }}>{direccion}</Text>
          {subtitulo ? <Text numberOfLines={1} style={{ ...typeScale.secundario, color: c.onTopBar }}>{subtitulo}</Text> : null}
        </View>
        {telefono ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Llamar" onPress={() => void Linking.openURL(urlLlamar(telefono))}
            style={{ width: 44, height: 44, borderRadius: radii.pastilla, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface2 }}>
            <Phone size={20} color={c.text} />
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Ver ficha del cliente" onPress={() => router.push(`/(tabs)/socios/${cliente.id}` as never)}
          style={{ width: 44, height: 44, borderRadius: radii.pastilla, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface2 }}>
          <Info size={20} color={c.text} />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: space[4], gap: space[4] }}>
        {disponible !== null || s?.tieneDeudaVencida !== undefined ? (
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            {disponible !== null ? (
              <View accessible accessibilityLabel={`Crédito disponible: ${textoDisponible(disponible)}`} style={{ flex: 1, padding: space[3], borderRadius: radii.tarjeta, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
                <Text style={{ ...typeScale.etiqueta, color: c.textSecondary }}>Crédito disponible</Text>
                <Text style={{ ...typeScale.cuerpoDestacado, ...importe, color: disponible < 0 ? c.chip.anulado.text : c.text }}>{textoDisponible(disponible)}</Text>
              </View>
            ) : null}
            {s?.tieneDeudaVencida !== undefined ? (
              <View accessible accessibilityLabel={`Deuda vencida: ${vencida ? (montoVencido !== null ? formatImporte(montoVencido) : 'Sí') : 'Ninguna'}`}
                style={{ flex: 1, padding: space[3], borderRadius: radii.tarjeta, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
                <Text style={{ ...typeScale.etiqueta, color: c.textSecondary }}>Deuda vencida</Text>
                <Text style={{ ...typeScale.cuerpoDestacado, ...importe, color: vencida ? c.chip.anulado.text : c.chip.entregado.text }}>
                  {vencida ? (montoVencido !== null ? formatImporte(montoVencido) : 'Sí') : 'Ninguna'}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Segmented options={TIPOS} value={tipo} onChange={onTipo} accessibilityLabel="Tipo de venta" />
        {vencida && tipo === 'Pedido' ? <Notice tone="advertencia">{AVISO_DEUDA_VENCIDA}</Notice> : null}

        <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>¿Cómo arrancás?</Text>

        <View style={{ gap: space[2] }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Repetir el último pedido"
            accessibilityState={{ disabled: !ultimo }}
            disabled={!ultimo}
            onPress={() => onArrancar('repetir', ultimo ?? undefined)}
            style={{ ...tarjeta(true), opacity: ultimo ? 1 : 0.6 }}
          >
            {icono(<RotateCcw size={24} color={c.brandInk} />, true)}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>Repetir el último pedido</Text>
              <Text style={{ ...typeScale.secundario, ...importe, color: c.textSecondary }}>{detalleUltimo}</Text>
              {ultimo ? <Text style={{ ...typeScale.secundario, fontFamily: typeScale.cuerpoDestacado.fontFamily, fontWeight: '600', color: c.brandInk }}>Con los precios y el stock de hoy</Text> : null}
            </View>
          </Pressable>
          {!ultimo && !cargando ? <MotivoDeshabilitado>Es la primera venta de este cliente: no hay un pedido para repetir.</MotivoDeshabilitado> : null}
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="Buscar en el catálogo" onPress={() => onArrancar('catalogo')} style={tarjeta(false)}>
          {icono(<Search size={24} color={c.text} />, false)}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>Buscar en el catálogo</Text>
            <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Por nombre, código o línea</Text>
          </View>
        </Pressable>

        <Pressable accessibilityRole="button" accessibilityLabel="Escanear en la góndola" onPress={() => onArrancar('escanear')}
          style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2], borderRadius: radii.tarjeta, borderWidth: 1, borderStyle: 'dashed', borderColor: c.textSecondary }}>
          <ScanBarcode size={22} color={c.text} />
          <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>Escanear en la góndola</Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}
