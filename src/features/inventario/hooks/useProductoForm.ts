import { useState, useMemo, useEffect, useCallback } from 'react'
import { Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import * as ImagePicker from 'expo-image-picker'
import { useProducto, useCreateProducto, useUpdateProducto, productosKeys } from '../api/queries'
import { uploadProductImage, getFullImageUrl } from '@/libs/api-client/media'
import { calcularRoiProducto } from '../lib/producto-roi'

// Minimum sale fraction. Binary: either per unit or per pack (owner-defined quantity).
// Packaging (blister/bulto) is independent optional metadata about how the product is purchased.
export const FRACCIONES = [
  { label: 'Unidad', value: 'Unidad' },
  { label: 'Pack',   value: 'Pack'   },
]

// Palabra visible de la fracción de venta.
export function fraccionWord(fraccion: string): string {
  return fraccion === 'Unidad' ? 'unidad' : 'pack'
}

export const UBICACIONES = [
  { label: 'Ninguna',      value: '' },
  { label: 'Estantería A', value: 'Estantería A' },
  { label: 'Estantería B', value: 'Estantería B' },
  { label: 'Pasillo 1',    value: 'Pasillo 1' },
  { label: 'Pasillo 2',    value: 'Pasillo 2' },
  { label: 'Cámara Frío',  value: 'Cámara de Frío' },
  { label: 'General',      value: 'General' },
]

export function useProductoForm(id?: string) {
  const router = useRouter()
  const queryClient = useQueryClient()
  
  // Queries & Mutations
  const { data: producto, isLoading: loadingData } = useProducto(id ?? '')
  const createProducto = useCreateProducto()
  const updateProducto = useUpdateProducto()
  
  const isPending = createProducto.isPending || updateProducto.isPending

  // Form State
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  // Packaging is optional metadata; price and stock are ALWAYS per unit.
  const [bultoContenido, setBultoContenido] = useState('')
  const [blisterContenido, setBlisterContenido] = useState('')
  const [fraccionMinimaVenta, setFraccionMinimaVenta] = useState('Unidad')
  const [ventaMinimaUnidades, setVentaMinimaUnidades] = useState('1')
  const [precioCompra, setPrecioCompra] = useState('')
  const [margen, setMargen] = useState('20')
  const [ubicacion, setUbicacion] = useState('')
  const [stockInicial, setStockInicial] = useState('0') // Sólo en creación
  const [stockMinimo, setStockMinimo] = useState('10')
  
  // Media State
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Modal State
  const [modalConfig, setModalConfig] = useState<{
    visible: boolean;
    title: string;
    message?: string;
    variant: 'success' | 'danger' | 'warning' | 'info';
    confirmLabel?: string;
    cancelLabel?: string;
    hideButtons?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    variant: 'info',
    onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false })),
    onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
  })

  // ── State Lifecycle Management ───────────────────────────────────────────
  const [focusKey, setFocusKey] = useState(0)

  const resetFormState = useCallback(() => {
    setNombre('')
    setDescripcion('')
    setBultoContenido('')
    setBlisterContenido('')
    setFraccionMinimaVenta('Unidad')
    setVentaMinimaUnidades('1')
    setPrecioCompra('')
    setMargen('20')
    setUbicacion('')
    setStockInicial('0')
    setStockMinimo('10')
    setImageUri(null)
    setImageUrl(null)
  }, [])

  const bumpFocusKey = useCallback(() => setFocusKey(k => k + 1), [])

  // Hidratar formulario con datos del producto si hay ID
  useEffect(() => {
    if (id && producto) {
      const p = (producto as any).data ?? producto
      setNombre(p.nombre ?? '')
      setDescripcion(p.descripcion ?? '')
      setPrecioCompra(String(p.precioCompraBase ?? p.precioVenta ?? ''))
      setMargen(String((p.margenGanancia ?? 0.2) * 100))
      setBultoContenido(p.bultoContenido && p.bultoContenido > 1 ? String(p.bultoContenido) : '')
      setBlisterContenido(p.blisterContenido ? String(p.blisterContenido) : '')
      setFraccionMinimaVenta(p.fraccionMinimaVenta ?? 'Unidad')
      setVentaMinimaUnidades(p.ventaMinimaUnidades ? String(p.ventaMinimaUnidades) : '1')
      setUbicacion(p.ubicacionDeposito ?? '')
      setStockMinimo(String(p.stockMinimo ?? 10))
      if (p.imageUrl) {
        setImageUri(getFullImageUrl(p.imageUrl))
        setImageUrl(p.imageUrl)
      }
    }
  }, [id, producto, focusKey])

  // Derived minimum-sale units, preview only. The server re-derives and is authoritative.
  const ventaMinimaPreview = useMemo(() => {
    if (fraccionMinimaVenta === 'Pack') return parseFloat(ventaMinimaUnidades) || 0
    return 1
  }, [fraccionMinimaVenta, ventaMinimaUnidades])

  // Lógica de cálculo de precio de venta sugerido
  // Fórmula: Costo / (1 - Margen)
  const precioVentaSugerido = useMemo(() => {
    const costo = parseFloat(precioCompra) || 0
    const m = parseFloat(margen) || 0
    if (costo <= 0) return 0
    const factor = 1 - (m / 100)
    return factor > 0 ? costo / factor : costo
  }, [precioCompra, margen])

  // ROI preview — gross profit + markup-over-cost percentage (D6 / web parity).
  // Formula: grossProfit = price - cost; roiPercentage = grossProfit / cost * 100.
  // Both values are 0 when cost <= 0 (guard in calcularRoiProducto).
  const { grossProfit, roiPercentage } = useMemo(
    () => calcularRoiProducto(precioVentaSugerido, parseFloat(precioCompra) || 0),
    [precioVentaSugerido, precioCompra],
  )

  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      setModalConfig({
        visible: true,
        title: 'Permiso denegado',
        message: 'Necesitamos acceso a tu galería para cargar la imagen.',
        variant: 'warning',
        confirmLabel: 'Entendido',
        onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false })),
        onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
      })
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    })

    if (!result.canceled && result.assets[0]) {
      const selectedUri = result.assets[0].uri
      setImageUri(selectedUri)
      
      setIsUploading(true)
      try {
        const uploadedUrl = await uploadProductImage(selectedUri)
        setImageUrl(uploadedUrl)
      } catch (error) {
        setModalConfig({
          visible: true,
          title: 'Error',
          message: 'No se pudo subir la imagen al servidor.',
          variant: 'danger',
          confirmLabel: 'Entendido',
          onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false })),
          onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
        })
        setImageUri(null)
      } finally {
        setIsUploading(false)
      }
    }
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!nombre || !precioCompra || !margen) {
      setModalConfig({
        visible: true,
        title: 'Campos requeridos',
        message: 'Completá nombre, costo y margen.',
        variant: 'warning',
        confirmLabel: 'Entendido',
        onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false })),
        onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
      })
      return
    }
    
    const costo = parseFloat(precioCompra)
    const m = parseFloat(margen)
    if (costo <= 0) {
      setModalConfig({
        visible: true,
        title: 'Error',
        message: 'El costo base debe ser mayor a 0.',
        variant: 'danger',
        confirmLabel: 'Entendido',
        onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false })),
        onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
      })
      return
    }
    if (m <= 0) {
      setModalConfig({
        visible: true,
        title: 'Error',
        message: 'El margen debe ser mayor a 0.',
        variant: 'danger',
        confirmLabel: 'Entendido',
        onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false })),
        onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
      })
      return
    }

    // Packaging is optional metadata; it is no longer tied to the minimum fraction.
    const bContenido = bultoContenido ? parseFloat(bultoContenido) : undefined
    const blContenido = blisterContenido ? parseFloat(blisterContenido) : undefined

    if (fraccionMinimaVenta === 'Pack' && !(parseFloat(ventaMinimaUnidades) >= 1)) {
      setModalConfig({
        visible: true,
        title: 'Falta el pack',
        message: 'Indicá cuántas unidades tiene el pack.',
        variant: 'warning',
        confirmLabel: 'Entendido',
        onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false })),
        onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
      })
      return
    }

    try {
      if (id) {
        // Modo Edición
        await updateProducto.mutateAsync({
          id,
          nombre,
          descripcion,
          precioCompraBase: costo,
          margenGanancia: m / 100,
          unidadMedida: 'Unidad',
          bultoContenido: bContenido,
          blisterContenido: blContenido,
          fraccionMinimaVenta,
          ventaMinimaUnidades: fraccionMinimaVenta === 'Pack' ? parseFloat(ventaMinimaUnidades) : 1,
          ubicacionDeposito: ubicacion || undefined,
          stockMinimo: parseInt(stockMinimo, 10),
          imageUrl: imageUrl || undefined,
          activo: true,
        })
        setModalConfig({
          visible: true,
          title: '¡Éxito!',
          message: 'Producto actualizado correctamente.',
          variant: 'success',
          confirmLabel: 'Volver',
          onConfirm: () => {
            setModalConfig(prev => ({ ...prev, visible: false }))
            router.replace('/(tabs)/inventario')
          },
          onCancel: () => {
            setModalConfig(prev => ({ ...prev, visible: false }))
            router.replace('/(tabs)/inventario')
          },
        })
      } else {
        // Modo Creación
        await createProducto.mutateAsync({
          nombre,
          descripcion,
          precioCompraBase: costo,
          margenGanancia: m / 100,
          unidadMedida: 'Unidad',
          bultoContenido: bContenido,
          blisterContenido: blContenido,
          fraccionMinimaVenta,
          ventaMinimaUnidades: fraccionMinimaVenta === 'Pack' ? parseFloat(ventaMinimaUnidades) : 1,
          ubicacionDeposito: ubicacion || undefined,
          stockInicial: parseInt(stockInicial, 10),
          stockMinimo: parseInt(stockMinimo, 10),
          imageUrl: imageUrl || undefined,
        })
        setModalConfig({
          visible: true,
          title: '¡Éxito!',
          message: `Producto ${nombre} creado con stock inicial de ${stockInicial}.`,
          variant: 'success',
          confirmLabel: 'Ir a Inventario',
          onConfirm: () => {
            setModalConfig(prev => ({ ...prev, visible: false }))
            router.replace('/(tabs)/inventario')
          },
          onCancel: () => {
            setModalConfig(prev => ({ ...prev, visible: false }))
            router.replace('/(tabs)/inventario')
          },
        })
      }
    } catch (e: unknown) {
      setModalConfig({
        visible: true,
        title: 'Error',
        message: (e as Error)?.message ?? `No se pudo ${id ? 'actualizar' : 'crear'} el producto.`,
        variant: 'danger',
        confirmLabel: 'Entendido',
        onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false })),
        onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
      })
    }
  }, [id, nombre, descripcion, precioCompra, margen, bultoContenido, blisterContenido, fraccionMinimaVenta, ventaMinimaUnidades, ubicacion, stockMinimo, imageUrl, createProducto, updateProducto, stockInicial, router])

  return {
    // UI Loading State
    loadingData: !!id && loadingData,
    isPending,
    isUploading,
    // State Values
    nombre, setNombre,
    descripcion, setDescripcion,
    bultoContenido, setBultoContenido,
    blisterContenido, setBlisterContenido,
    fraccionMinimaVenta, setFraccionMinimaVenta,
    ventaMinimaUnidades, setVentaMinimaUnidades,
    precioCompra, setPrecioCompra,
    margen, setMargen,
    ubicacion, setUbicacion,
    stockInicial, setStockInicial,
    stockMinimo, setStockMinimo,
    imageUri, setImageUri,
    setImageUrl, // To clear image
    // Derived
    precioVentaSugerido,
    ventaMinimaPreview,
    grossProfit,
    roiPercentage,
    // Actions
    pickImage,
    handleSubmit,
    // State lifecycle management
    resetFormState, bumpFocusKey, queryClient, productosKeys,
    // Modal
    modalConfig, setModalConfig,
  }
}
