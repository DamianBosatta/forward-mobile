import React, { useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { CircleCheck, PackageCheck, PackageX } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, Field, Notice, OptionCard, Stepper } from '@/core/ui/fw'
import type { LineaParada } from '@/libs/api-client/logistica'
import { ElegirChip } from '@/features/cuentas/components/ElegirChip'
import { leerNumero } from '@/core/utils/numero'
import { RENGLONES_PARA_BUSCAR } from '@/core/utils/texto'
import { MOTIVOS_DEVOLUCION } from './entrega'

/** Lámina chofer-03-devoluciones: "¿Tiene devoluciones?", Sí o No y nada más. Tocar una opción avanza; la elegida se ve al volver. */
export function EleccionDevolucion({ valor, onElegir }: { valor: boolean | null; onElegir: (hay: boolean) => void }) {
  const c = useColors()
  return (
    <View accessibilityLabel="¿Hay devolución?" style={{ gap: space[3] }}>
      <Text accessibilityRole="header" style={{ ...typeScale.titulo, fontSize: 24, lineHeight: 32, color: c.text }}>¿Tiene devoluciones?</Text>
      <OptionCard minHeight={132} icon={PackageCheck} label="No" selected={valor === false} onPress={() => onElegir(false)} />
      <OptionCard minHeight={132} icon={PackageX} label="Sí" selected={valor === true} onPress={() => onElegir(true)} />
    </View>
  )
}

const marcaDe = (r: LineaParada) => r.marca ?? ''

/** Lámina "Devolución enviada" (S19): lo marcado queda para que el depósito la autorice; el chofer sigue con el cobro. */
export function DevolucionEnviada({ onSeguir }: { onSeguir: () => void }) {
  const c = useColors()
  return (
    <View accessibilityLabel="Devolución enviada" style={{ gap: space[3], alignItems: 'center', paddingTop: space[6] }}>
      <CircleCheck size={56} color={c.brandInk} strokeWidth={2.5} />
      <Text accessibilityRole="header" style={{ ...typeScale.titulo, fontSize: 24, lineHeight: 32, color: c.text, textAlign: 'center' }}>Devolución enviada</Text>
      <Text style={{ ...typeScale.cuerpo, color: c.textSecondary, textAlign: 'center' }}>Depósito la va a autorizar cuando reciba la mercadería. Seguí con el cobro.</Text>
      <View style={{ alignSelf: 'stretch' }}>
        <Button size="xl" label="Seguir con el cobro" onPress={onSeguir} />
      </View>
    </View>
  )
}

interface Props {
  renglones: LineaParada[] | undefined
  cargando: boolean
  conError: boolean
  /** Cantidad devuelta por renglón (`ventaDetalleId` → texto del campo). */
  valores: Record<string, string>
  onCambio: (ventaDetalleId: string, valor: string) => void
  /** TODO API: el motivo no tiene campo por devolución; viaja en las observaciones de la entrega. */
  motivo: string | null
  onMotivo: (motivo: string) => void
}

/** Lo que el cliente devuelve en el momento (chofer-03--productos). Queda Solicitada: el depósito la autoriza después. */
export function DevolucionEnEntrega({ renglones, cargando, conError, valores, onCambio, motivo, onMotivo }: Props) {
  const c = useColors()
  const [busqueda, setBusqueda] = useState('')
  const disponibles = (renglones ?? []).filter((r) => (r.cantidadDisponible ?? 0) > 0)
  // Con pocos renglones se ve todo de un vistazo; desde 8 se busca por nombre o marca (S12).
  const conBuscador = disponibles.length >= RENGLONES_PARA_BUSCAR
  const buscado = busqueda.trim().toLowerCase()
  const visibles = conBuscador && buscado
    ? disponibles.filter((r) => `${r.productoNombre ?? ''} ${marcaDe(r)}`.toLowerCase().includes(buscado))
    : disponibles
  const cantidadDe = (id: string) => Math.max(0, leerNumero(valores[id] ?? '') ?? 0)
  const cargadas = disponibles.map((r) => cantidadDe(r.ventaDetalleId ?? '')).filter((n) => n > 0)
  const unidades = cargadas.reduce((t, n) => t + n, 0)
  return (
    <View accessibilityLabel="Devolución" style={{ gap: space[4] }}>
      <Text accessibilityRole="header" style={{ ...typeScale.titulo, fontSize: 24, lineHeight: 32, color: c.text }}>¿Qué devuelve?</Text>
      {cargando ? <ActivityIndicator color={c.brand} accessibilityLabel="Cargando los productos del pedido" /> : null}
      {conError ? <Notice tone="peligro">No se pudieron cargar los productos del pedido.</Notice> : null}
      {conBuscador ? <Field label="Buscar producto o marca" value={busqueda} onChangeText={setBusqueda} autoCorrect={false} /> : null}
      {visibles.map((r) => {
        const id = r.ventaDetalleId ?? ''
        const nombre = r.productoNombre ?? 'Producto'
        return (
          <View key={id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], padding: space[3], borderRadius: radii.tarjeta, backgroundColor: c.surface, borderWidth: 2, borderColor: c.border }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{nombre}</Text>
              <Text style={{ ...typeScale.secundario, ...importe, color: c.textSecondary }}>{`Pidió ${r.cantidadVendida ?? r.cantidadDisponible} · hasta ${r.cantidadDisponible}`}</Text>
            </View>
            <Stepper nombre={nombre} max={r.cantidadDisponible ?? 0} value={cantidadDe(id)} onChange={(n) => onCambio(id, n > 0 ? String(n) : '')} />
          </View>
        )
      })}
      <ElegirChip
        titulo="Motivo"
        opciones={MOTIVOS_DEVOLUCION.map((m) => ({ id: m, label: m }))}
        valor={motivo}
        onCambio={onMotivo}
      />
      <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
        La nota de crédito queda pendiente hasta que el depósito reciba la mercadería. La deuda del cliente no cambia todavía.
      </Text>
      {unidades > 0 ? (
        <Text accessibilityLiveRegion="polite" style={{ ...typeScale.cuerpoDestacado, color: c.text }}>
          {`Devuelve ${unidades} ${unidades === 1 ? 'unidad' : 'unidades'} en ${cargadas.length} ${cargadas.length === 1 ? 'producto' : 'productos'}`}
        </Text>
      ) : null}
    </View>
  )
}
