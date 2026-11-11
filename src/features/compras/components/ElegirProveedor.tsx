import React, { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'
import { Lock } from 'lucide-react-native'
import { Button, Field, FormContainer, Notice, PieFijo, formatImporte } from '@/core/ui/fw'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { useSocio, useSocios } from '@/libs/api-client/socios'
import { useInfiniteCompras } from '@/libs/api-client/compras'
import { usePermissions } from '@/core/auth/RequirePermission'
import { useComprasDelProveedor } from '@/features/proveedores/hooks/useProveedores'
import { MarcaRadio } from '@/features/venta-nueva/components/MarcaRadio'
import { formatToLocalDate } from '@/core/utils/fecha'
import { franjaTexto } from '../lib/fecha'
import { numeroDeCompra } from '../lib/numero'
import { PasosCompra } from './PasosCompra'

/** Cuántos proveedores van en "Recientes" y de cuántas compras se sacan. */
const RECIENTES = 3
const COMPRAS_PARA_RECIENTES = 20

interface Props {
  onElegir: (id: string) => void
  /** Proveedor elegido al que le faltan datos de compra: no se le puede comprar todavía. */
  faltantes: { nombre: string; lista: string[] } | null
  error: string | null
}

interface FilaProveedor {
  id: string
  nombre: string
  cuit?: string | null
  falta?: boolean
  ultima?: string
}

/** Los proveedores de las últimas compras, sin repetir y en el orden en que llegan (la más reciente primero). */
function recientesDe(compras: readonly { id: string; numero?: number | null; proveedorId: string; razonSocialProveedor: string }[]): FilaProveedor[] {
  const vistos = new Set<string>()
  const filas: FilaProveedor[] = []
  for (const c of compras) {
    if (vistos.has(c.proveedorId)) continue
    vistos.add(c.proveedorId)
    filas.push({ id: c.proveedorId, nombre: c.razonSocialProveedor, ultima: `Última compra ${numeroDeCompra(c)}` })
    if (filas.length === RECIENTES) break
  }
  return filas
}

/**
 * Paso 1 de la compra nueva (maqueta "Compras como venta", frames 1 a 4; copia el paso 1 de la venta): filas con radio,
 * "Recientes" y buscador. El proveedor se elige de la lista (no se dan de alta en mobile); elegido, se ven sus condiciones
 * de solo lectura y recién con "Continuar a productos" se crea el borrador. Sin datos de compra no se puede seguir.
 */
export function ElegirProveedor({ onElegir, faltantes, error }: Props) {
  const c = useColors()
  const [busqueda, setBusqueda] = useState('')
  const [enviada, setEnviada] = useState('')
  const [elegido, setElegido] = useState<string | null>(null)
  const ficha = useSocio(elegido ?? '')
  // "Última compra" y "Recientes" salen de GET /Compras (MOD_COMPRAS:Read): sin el permiso no se piden.
  const puedeVerCompras = usePermissions().canDo('MOD_COMPRAS', 'read')
  const ultimas = useComprasDelProveedor(elegido ?? '', puedeVerCompras, 1)
  const ultima = ultimas.data?.items?.[0]
  const delServidor = useInfiniteCompras({ pageSize: COMPRAS_PARA_RECIENTES }, { enabled: puedeVerCompras })
  useEffect(() => {
    const t = setTimeout(() => setEnviada(busqueda.trim()), 300)
    return () => clearTimeout(t)
  }, [busqueda])
  const buscando = enviada.length >= 2
  const q = useSocios({ tipo: 2, activo: true, pageSize: 50, search: buscando ? enviada : undefined })
  const secundario = [typeScale.secundario, { color: c.textSecondary }]

  const recientes = buscando || !puedeVerCompras ? [] : recientesDe(delServidor.data?.pages[0]?.items ?? [])
  const lista: FilaProveedor[] = (q.data?.items ?? []).map((p) => ({ id: p.id, nombre: p.razonSocial, cuit: p.cuit, falta: !!p.requiereCompletar }))
  const faltaElegido = ficha.data?.condicionesDeCompraFaltantes ?? []
  const condicion = ficha.data?.condicionPago?.descripcion ?? null
  const franja = franjaTexto(ficha.data?.franjaEntrega)
  const textoUltima = ultimas.isLoading ? 'Cargando…'
    : ultimas.isError ? 'No se pudo cargar'
    : ultima ? `${formatToLocalDate(ultima.fecha)} · ${formatImporte(ultima.totalAmount, { moneda: ultima.totalCurrency })}`
    : 'Sin compras'
  const conNumero = ultima && typeof ultima.numero === 'number' && ultima.numero > 0 ? `${numeroDeCompra(ultima)} · ${textoUltima}` : textoUltima

  const fila = (p: FilaProveedor, i: number) => {
    const sel = p.id === elegido
    return (
      <Pressable
        key={`${p.id}-${i}`}
        accessibilityRole="radio"
        accessibilityLabel={p.falta ? `${p.nombre}, faltan datos de compra` : p.nombre}
        accessibilityState={{ checked: sel, selected: sel }}
        onPress={() => setElegido(p.id)}
        android_ripple={{ color: c.surface2 }}
        style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3], borderTopWidth: i ? 1 : 0, borderTopColor: c.border, backgroundColor: sel ? c.brandSoft : c.surface }}
      >
        <MarcaRadio elegido={sel} />
        <View style={{ flex: 1, minWidth: 0, gap: space[1] }}>
          <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>{p.nombre}</Text>
          {p.cuit ? <Text style={secundario}>{`CUIT ${p.cuit}`}</Text> : null}
          {p.falta ? <Text style={[typeScale.secundario, { color: c.chip.porAutorizar.text }]}>Faltan datos de compra: se completan en la web</Text> : null}
          {p.ultima ? <Text style={[typeScale.secundario, { color: c.brandInk }]}>{p.ultima}</Text> : null}
        </View>
      </Pressable>
    )
  }
  const tarjeta = (filas: React.ReactNode) => (
    <View style={{ borderRadius: radii.tarjeta, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, overflow: 'hidden' }}>{filas}</View>
  )
  const dato = (k: string, v: string | null) => (
    <View accessible accessibilityLabel={`${k}: ${v ?? '—'}`} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[3], paddingVertical: space[1] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
        <Lock size={14} color={c.textSecondary} />
        <Text style={secundario}>{k}</Text>
      </View>
      <Text style={[typeScale.secundario, { color: c.text, flexShrink: 1, textAlign: 'right' }]}>{v ?? '—'}</Text>
    </View>
  )

  return (
    <View style={{ flex: 1 }}>
      <PasosCompra paso={1} />
      <FlatList
        style={{ flex: 1 }}
        data={lista.length ? [lista] : []}
        keyExtractor={() => 'lista'}
        extraData={[elegido, condicion, franja, textoUltima]}
        contentContainerStyle={{ padding: space[4], gap: space[3] }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <FormContainer style={{ gap: space[3] }}>
            <Text style={secundario}>Elegí el proveedor para ver sus condiciones.</Text>
            <Field label="Buscar proveedor" placeholder="Nombre, CUIT o código" value={busqueda} onChangeText={setBusqueda} autoCorrect={false} />
            {faltantes ? (
              <Notice tone="advertencia" title={`A ${faltantes.nombre} le falta ${faltantes.lista.join(' y ')}.`}>Completalo en la web para poder comprarle.</Notice>
            ) : null}
            {error ? <Notice tone="peligro">{error}</Notice> : null}
            {recientes.length > 0 ? (
              <>
                <Text accessibilityRole="header" style={[typeScale.seccion, { color: c.text }]}>Recientes</Text>
                {tarjeta(recientes.map(fila))}
              </>
            ) : null}
            {lista.length > 0 ? <Text accessibilityRole="header" style={[typeScale.seccion, { color: c.text }]}>{buscando ? 'Resultados' : 'Proveedores'}</Text> : null}
          </FormContainer>
        }
        renderItem={({ item }) => <FormContainer>{tarjeta(item.map(fila))}</FormContainer>}
        ListEmptyComponent={
          <FormContainer style={{ gap: space[2] }}>
            {q.isLoading ? <ActivityIndicator color={c.brand} />
              : q.isError ? (
                <>
                  <Notice tone="peligro">No se pudieron cargar los proveedores.</Notice>
                  <Button label="Reintentar" variant="secundario" onPress={() => { void q.refetch() }} />
                </>
              )
              : <Text style={[secundario, { textAlign: 'center' }]}>No hay proveedores con esa búsqueda.</Text>}
          </FormContainer>
        }
        ListFooterComponent={elegido ? (
          <FormContainer>
            {faltaElegido.length > 0 ? (
              <Notice tone="advertencia" title={`A ${ficha.data?.razonSocial ?? 'este proveedor'} le falta ${faltaElegido.join(' y ')}.`}>Completalo en la web para poder comprarle.</Notice>
            ) : (
              // TODO API: las condiciones editables no existen en el servidor; las condiciones van de solo lectura.
              <View style={{ gap: space[1], padding: space[4], borderRadius: radii.tarjeta, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
                <Text accessibilityRole="header" style={[typeScale.seccion, { color: c.text }]}>Condiciones del proveedor</Text>
                {dato('Plazo de pago', condicion)}
                {dato('Franja horaria', franja)}
                {puedeVerCompras ? dato('Última compra', conNumero) : null}
                <Text style={secundario}>Se cambian en la ficha del proveedor, en la web.</Text>
              </View>
            )}
          </FormContainer>
        ) : undefined}
      />
      <PieFijo>
        <Button label="Continuar a productos" disabled={!elegido || faltaElegido.length > 0}
          onPress={() => { if (elegido) onElegir(elegido) }} />
      </PieFijo>
    </View>
  )
}
