import { useState, useMemo, useEffect, useCallback } from 'react'
import { Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { createCompraSchema } from '@/libs/validations'

import {
  useCreateCompra,
  useUpdateCompra,
  useConfirmarCompra,
  useRecibirCompra,
  useCompra,
  comprasKeys,
} from '../api/queries'
import { api, useInfiniteProductos, useProveedores, useDepositos } from '@/libs/api-client'
import type { SocioComercial, Deposito, Producto, CompraDetalle, ProductoDetailDto } from '@/libs/api-client'
import { mensajeDelServidor } from '../lib/mensaje-error'

export interface DetalleItem {
  productoId: string
  nombre: string
  imageUrl?: string
  /** null = sin costo: el servidor no tiene uno previo y el usuario todavía no lo cargó. */
  costoUnitario: number | null
  cantidad: number
}

export type EstadoOrden = 'Presupuesto' | 'Confirmado' | 'Recibida'

export function useCompraForm(editId?: string) {
  const router = useRouter()
  const queryClient = useQueryClient()

  // Queries
  const { data: compraEdit, isLoading: loadingEdit } = useCompra(editId ?? '')
  const [productSearch, setProductSearch] = useState('')
  const [busquedaServidor, setBusquedaServidor] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setBusquedaServidor(productSearch.trim()), 300)
    return () => clearTimeout(t)
  }, [productSearch])
  // La búsqueda la hace el servidor (nombre y códigos), paginada: sin tope de productos.
  const {
    data: productosPaginas,
    isLoading: loadingProds,
    hasNextPage: hayMasProductos,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteProductos({ pageSize: 30, search: busquedaServidor })
  const { data: proveedoresResponse } = useProveedores()
  const { data: depositosResponse } = useDepositos()

  const productosFiltrados = useMemo(
    () => productosPaginas?.pages.flatMap(p => p.items ?? []) ?? [],
    [productosPaginas]
  )
  const cargarMasProductos = useCallback(() => {
    if (hayMasProductos && !isFetchingNextPage) fetchNextPage()
  }, [hayMasProductos, isFetchingNextPage, fetchNextPage])
  const proveedores = proveedoresResponse?.items ?? []
  const depositos = depositosResponse ?? []

  // Mutations
  const { mutateAsync: createCompra, isPending: isCreating } = useCreateCompra()
  const { mutateAsync: updateCompra, isPending: isUpdating } = useUpdateCompra()
  const { mutateAsync: confirmarCompra, isPending: isConfirming } = useConfirmarCompra()
  const { mutateAsync: recibirCompra, isPending: isReceiving } = useRecibirCompra()

  const isPending = isCreating || isUpdating || isConfirming || isReceiving

  // Form state
  const [proveedorSelected, setProveedorSelected] = useState<SocioComercial | null>(null)
  const [depositoSelected, setDepositoSelected] = useState<Deposito | null>(null)
  const [detalles, setDetalles] = useState<DetalleItem[]>([])
  const [gastosStr, setGastosStr] = useState('')
  const [descuentoStr, setDescuentoStr] = useState('')
  const [estadoOrden, setEstadoOrden] = useState<EstadoOrden>('Presupuesto')
  const [successModal, setSuccessModal] = useState(false)

  // Modal state
  const [showProvModal, setShowProvModal] = useState(false)
  const [showDepModal, setShowDepModal] = useState(false)
  const [showProductModal, setShowProductModal] = useState(false)
  const [provSearch, setProvSearch] = useState('')

  // ── State Lifecycle Management ───────────────────────────────────────────
  const [focusKey, setFocusKey] = useState(0)

  const resetFormState = useCallback(() => {
    setProveedorSelected(null)
    setDepositoSelected(null)
    setDetalles([])
    setGastosStr('')
    setDescuentoStr('')
    setEstadoOrden('Presupuesto')
    setSuccessModal(false)
    setShowProvModal(false)
    setShowDepModal(false)
    setShowProductModal(false)
    setProvSearch('')
    setProductSearch('')
  }, [])

  const bumpFocusKey = useCallback(() => setFocusKey(k => k + 1), [])

  // Pre-fill Edit Mode
  useEffect(() => {
    if (editId && compraEdit) {
      setProveedorSelected(proveedores.find(p => p.id === compraEdit.proveedorId) || null)
      setDepositoSelected(depositos.find((d: Deposito) => d.id === compraEdit.depositoId) || null)
      setDetalles(compraEdit.detalles?.map((d: CompraDetalle) => ({
        productoId: d.productoId ?? '',
        nombre: d.nombreProducto ?? '—',
        costoUnitario: d.costoUnitarioBaseAmount ?? null,
        cantidad: d.cantidad ?? 0,
      })) ?? [])
      setGastosStr(String(compraEdit.gastosOperativos || ''))
      setDescuentoStr(String((compraEdit as typeof compraEdit & { descuentoPorcentaje?: number }).descuentoPorcentaje || ''))
      
      const s = String(compraEdit.estado)
      if (s === 'Presupuesto' || s === '1' || s === 'NotaPedido') setEstadoOrden('Presupuesto')
      else if (s === 'Confirmado' || s === '2') setEstadoOrden('Confirmado')
      else if (s === 'Recibida' || s === '3' || s === 'Entregado') setEstadoOrden('Recibida')
    }
  }, [compraEdit, editId, proveedores, depositos, focusKey])

  // Computed
  const gastos = useMemo(() => Math.max(parseFloat(gastosStr) || 0, 0), [gastosStr])
  const descPct = useMemo(() => Math.max(parseFloat(descuentoStr) || 0, 0), [descuentoStr])
  const bruto = useMemo(() => detalles.reduce((acc, d) => acc + d.cantidad * (d.costoUnitario ?? 0), 0), [detalles])
  const subtotal = useMemo(() => bruto * (1 - descPct / 100), [bruto, descPct])
  const total = useMemo(() => subtotal + gastos, [subtotal, gastos])

  const proveedoresFiltrados = useMemo(
    () => proveedores.filter(p => (p.razonSocial ?? '').toLowerCase().includes(provSearch.toLowerCase())),
    [proveedores, provSearch]
  )

  // Handlers
  // Precarga el último costo de la ficha del producto (el servidor lo entrega solo con permiso
  // de ver costos). Si no hay, la línea queda sin costo: nunca se inventa uno.
  const precargarUltimoCosto = useCallback(async (productoId: string) => {
    try {
      const ficha = await api.get<ProductoDetailDto>(`/api/v1/Productos/${productoId}`)
      const costo = ficha?.precioCompraBase
      if (typeof costo !== 'number' || costo <= 0) return
      setDetalles(prev => prev.map(d =>
        d.productoId === productoId && d.costoUnitario === null ? { ...d, costoUnitario: costo } : d
      ))
    } catch {
      // Sin costo previo: lo carga el usuario.
    }
  }, [])

  const setProductoCantidad = useCallback((prod: Producto, qty: number) => {
    if (qty > 0 && prod.id && !detalles.some(d => d.productoId === prod.id)) {
      precargarUltimoCosto(prod.id)
    }
    setDetalles(prev => {
      if (qty <= 0) return prev.filter(d => d.productoId !== prod.id)
      const idx = prev.findIndex(d => d.productoId === prod.id)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = { ...copy[idx], cantidad: qty }
        return copy
      }
      return [...prev, {
        productoId: prod.id ?? '',
        nombre: prod.nombre ?? '',
        imageUrl: prod.imageUrl ?? undefined,
        costoUnitario: null,
        cantidad: qty,
      }]
    })
  }, [detalles, precargarUltimoCosto])

  const updateCantidad = useCallback((id: string, delta: number) => {
    setDetalles(prev => prev.map(d =>
      d.productoId === id ? { ...d, cantidad: Math.max(1, d.cantidad + delta) } : d
    ))
  }, [])

  const updateCosto = useCallback((id: string, value: string) => {
    const num = value.trim() === '' ? null : parseFloat(value)
    if (num === null || (!isNaN(num) && num >= 0))
      setDetalles(prev => prev.map(d => d.productoId === id ? { ...d, costoUnitario: num } : d))
  }, [])

  const removeDetalle = useCallback((id: string) => {
    setDetalles(prev => prev.filter(d => d.productoId !== id))
  }, [])

  const onSubmit = useCallback(async () => {
    const payload = {
      id: editId,
      proveedorId: proveedorSelected?.id ?? '',
      depositoId: depositoSelected?.id ?? '',
      gastosOperativos: gastos,
      descuentoPorcentaje: descPct,
      detalles: detalles.map(d => ({
        productoId: d.productoId,
        cantidad: d.cantidad,
        costoUnitario: d.costoUnitario ?? 0,
        descuentoPorcentaje: 0,
        monedaCosto: 'ARS',
      })),
      estado: estadoOrden === 'Presupuesto' ? 1 : estadoOrden === 'Confirmado' ? 2 : 3,
    }

    // ── Zod Validation ──
    const validation = createCompraSchema.safeParse(payload)
    if (!validation.success) {
      const firstError = validation.error.errors[0]?.message ?? 'Datos inválidos'
      return Alert.alert('⚠️ Validación', firstError)
    }

    if (editId) {
      // Editar solo guarda: los cambios de estado se hacen desde el detalle de la compra.
      try {
        await updateCompra({ id: editId, data: payload })
        setSuccessModal(true)
      } catch (e: unknown) {
        Alert.alert('No se guardaron los cambios', mensajeDelServidor(e))
      }
      return
    }

    // Crear, confirmar y recibir son llamadas separadas: si una falla, se dice qué quedó hecho.
    let newId: string | undefined
    const hechos: string[] = []
    const pasos = [
      ...(estadoOrden !== 'Presupuesto'
        ? [{ hecho: 'La orden quedó confirmada.', fallo: 'No se confirmó la orden', correr: () => confirmarCompra(newId!) }]
        : []),
      ...(estadoOrden === 'Recibida'
        ? [{ hecho: 'La mercadería quedó recibida.', fallo: 'No se recibió la mercadería', correr: () => recibirCompra(newId!) }]
        : []),
    ]
    try {
      const resultId = await createCompra(payload)
      newId = typeof resultId === 'string' ? resultId : resultId.id
    } catch (e: unknown) {
      Alert.alert('No se creó la compra', mensajeDelServidor(e))
      return
    }
    hechos.push('La orden quedó creada como nota de pedido.')

    for (const [i, paso] of pasos.entries()) {
      try {
        await paso.correr()
        hechos.push(paso.hecho)
      } catch (e: unknown) {
        const sinHacer = pasos.slice(i + 1).map(p => `${p.fallo}.`)
        const mensaje = [...hechos, `${paso.fallo}: ${mensajeDelServidor(e)}`, ...sinHacer].join('\n')
        Alert.alert('La compra quedó a medias', mensaje, [
          { text: 'Ver la compra', onPress: () => router.replace(`/(tabs)/compras/${newId}`) },
        ])
        return
      }
    }
    setSuccessModal(true)
  }, [editId, proveedorSelected, depositoSelected, gastos, descPct, detalles, estadoOrden, updateCompra, confirmarCompra, recibirCompra, createCompra, router])

  // Toda línea necesita un costo cargado (el servidor exige > 0): sin eso no se confirma.
  const lineasSinCosto = detalles.filter(d => d.costoUnitario === null || d.costoUnitario <= 0).length
  const canSubmit = !!proveedorSelected && !!depositoSelected && detalles.length > 0 && lineasSinCosto === 0 && !isPending

  return {
    loadingEdit, loadingProds, isPending,
    proveedorSelected, setProveedorSelected,
    depositoSelected, setDepositoSelected,
    detalles, setDetalles,
    gastosStr, setGastosStr,
    descuentoStr, setDescuentoStr,
    estadoOrden, setEstadoOrden,
    successModal, setSuccessModal,
    showProvModal, setShowProvModal,
    showDepModal, setShowDepModal,
    showProductModal, setShowProductModal,
    provSearch, setProvSearch,
    productSearch, setProductSearch,
    subtotal, total,
    proveedoresFiltrados, productosFiltrados, depositos,
    hayMasProductos: !!hayMasProductos, cargarMasProductos, lineasSinCosto,
    setProductoCantidad, updateCantidad, updateCosto, removeDetalle,
    onSubmit, canSubmit,
    // State lifecycle management
    resetFormState, bumpFocusKey, queryClient, comprasKeys,
  }
}
