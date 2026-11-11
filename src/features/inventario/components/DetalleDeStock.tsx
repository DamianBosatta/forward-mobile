import React from 'react'
import { ScrollView, Text, View } from 'react-native'
import { AlertTriangle, History } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { BottomSheet, Button, StatusChip, formatImporte } from '@/core/ui/fw'
import { ProductoIdentidad } from '@/core/ui/fw/ProductoIdentidad'
import { mostrarNumero } from '@/core/utils/numero'
import { useProducto } from '@/libs/api-client/productos'
import type { StockItem } from '@/libs/api-client/types'
import { useRentabilidadDeProducto } from '../hooks/useConsultasDeStock'
import { textoKg } from '../lib/stock-presentacion'
import { FotoDeProducto } from './TarjetaDeStock'
import { MovimientosDeStock } from './MovimientosDeStock'

function Titulo({ children }: { children: string }) {
  const c = useColors()
  return <Text accessibilityRole="header" style={[typeScale.etiqueta, { color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 }]}>{children}</Text>
}

function Dato({ label, valor, ultimo }: { label: string; valor: string; ultimo?: boolean }) {
  const c = useColors()
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${valor}`}
      style={{ minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], borderBottomWidth: ultimo ? 0 : 1, borderBottomColor: c.border }}
    >
      <Text style={[typeScale.secundario, { color: c.textSecondary, flexShrink: 1 }]}>{label}</Text>
      <Text style={[typeScale.cuerpoDestacado, importe, { color: c.text }]}>{valor}</Text>
    </View>
  )
}

function Caja({ children }: { children: React.ReactNode }) {
  const c = useColors()
  return <View style={{ borderRadius: radii.tarjeta, borderWidth: 1, borderColor: c.border, paddingHorizontal: space[3] }}>{children}</View>
}

/** Alícuota, peso y umbral propio de COT, de la ficha del producto (web DatosFiscales). */
function DatosFiscales({ productoId }: { productoId: string }) {
  const { data: producto } = useProducto(productoId)
  if (!producto) return null
  return (
    <View style={{ gap: space[2] }}>
      <Titulo>Datos fiscales</Titulo>
      <Caja>
        <Dato label="Alícuota de IVA" valor={`${mostrarNumero(producto.alicuotaIvaPorcentaje)} %`} />
        <Dato label="Peso por unidad" valor={textoKg(producto.pesoKg, 'Sin peso')} />
        <Dato label="Umbral propio de COT" valor={textoKg(producto.cotUmbralPropioKg, 'Régimen general')} ultimo />
      </Caja>
    </View>
  )
}

/** Bandas de precio y costo real (web Rentabilidad), solo para quien ve costos. */
function Rentabilidad({ item }: { item: StockItem }) {
  const { data } = useRentabilidadDeProducto(item.productoId, item.codigoPropio, true)
  const filas = data
    ? ([
        ['Mínimo rentable', data.precioMinimoRentable],
        ['Adecuado', data.precioAdecuado],
        ['Premium', data.precioPremium],
        ['Costo real', data.costoRealPricing],
      ] as const).filter(([, v]) => v != null)
    : []
  return (
    <View style={{ gap: space[2] }}>
      <Titulo>Rentabilidad</Titulo>
      {filas.length > 0 ? (
        <Caja>
          {filas.map(([label, v], i) => <Dato key={label} label={label} valor={formatImporte(v)} ultimo={i === filas.length - 1} />)}
        </Caja>
      ) : null}
    </View>
  )
}

interface Props {
  item: StockItem | null
  onCerrar: () => void
  /** CAP_VER_COSTOS, decidido por capacidad en el contenedor. */
  veCostos: boolean
}

/**
 * Detalle de un producto (web InventarioDetailSheet): foto, nombre, "En alerta" si corresponde, "Stock Físico" grande
 * en unidades, Disponibilidad (Disponible, Reservado, Por entrar: nunca "Virtual"), Datos fiscales y Rentabilidad
 * solo para gestión (CAP_VER_COSTOS). "Ver movimientos" abre la lista de movimientos. Sin "Editar producto": mobile
 * solo mira.
 */
export function DetalleDeStock({ item, onCerrar, veCostos }: Props) {
  const c = useColors()
  const [movimientos, setMovimientos] = React.useState(false)
  if (!item) return null
  const alerta = item.enAlerta === true
  const cerrar = () => {
    setMovimientos(false)
    onCerrar()
  }

  return (
    <BottomSheet visible onClose={cerrar} accessibilityLabel={`Detalle de ${item.producto}`}>
      <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ gap: space[4] }}>
        <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'flex-start' }}>
          <View style={{ width: 64 }}>
            <FotoDeProducto imageUrl={item.imageUrl} alto={64} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: space[1] }}>
            <ProductoIdentidad nombre={item.producto} marca={item.marca} codigo={item.codigoPropio} />
            {alerta ? (
              <View accessibilityLabel="Producto en alerta de stock" style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
                <AlertTriangle size={14} color={c.chip.porAutorizar.text} />
                <StatusChip estado="porAutorizar" label="En alerta" />
              </View>
            ) : null}
          </View>
        </View>

        <View style={{ alignItems: 'center', gap: space[1], padding: space[4], borderRadius: radii.tarjeta, backgroundColor: c.bg }}>
          <Text style={[typeScale.etiqueta, { color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 }]}>Stock Físico</Text>
          <Text
            accessibilityLabel={`Stock real: ${mostrarNumero(item.cantidadActual)} unidades`}
            style={[typeScale.titulo, importe, { color: alerta ? c.chip.porAutorizar.text : c.text }]}
          >
            {mostrarNumero(item.cantidadActual)}
          </Text>
          <Text style={[typeScale.secundario, { color: c.textSecondary }]}>unidades</Text>
        </View>

        <View style={{ gap: space[2] }}>
          <Titulo>Disponibilidad</Titulo>
          <Caja>
            <Dato label="Disponible" valor={mostrarNumero(item.cantidadDisponible)} />
            <Dato label="Reservado" valor={mostrarNumero(item.cantidadReservada)} />
            <Dato label="Por entrar" valor={mostrarNumero(item.cantidadVirtual)} ultimo />
          </Caja>
        </View>

        <DatosFiscales productoId={item.productoId} />

        {veCostos ? (
          <Rentabilidad item={item} />
        ) : (
          <Text style={[typeScale.secundario, { color: c.textSecondary, textAlign: 'center' }]}>Información adicional disponible solo para roles de gestión.</Text>
        )}
      </ScrollView>
      <Button label="Ver movimientos" variant="secundario" icon={History} onPress={() => setMovimientos(true)} />
      <MovimientosDeStock visible={movimientos} onCerrar={() => setMovimientos(false)} productoId={item.productoId} producto={item.producto} />
    </BottomSheet>
  )
}
