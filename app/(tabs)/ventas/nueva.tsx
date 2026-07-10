import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Modal,
  FlatList,
  Alert,
  Image,
  Linking,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { sharePdf } from '@/features/pedidos/lib/sharePdf'
import { getNotaEntregaUrl } from '@/libs/api-client'
import DateTimePicker from '@react-native-community/datetimepicker'
import { MessageSquare, ArrowLeft, X, Plus, Check, ChevronDown, Search, Minus, Tag, Percent, Calendar, Truck, AlertCircle, Info } from 'lucide-react-native'
import { BlurView } from 'expo-blur'
import { MotiView } from 'moti'
import { useState, useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useColors, BRAND, useIsDark, tokens } from '@/libs/theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useNavigation } from 'expo-router'
import { DrawerActions } from '@react-navigation/native'
import { safeHaptics } from '@/core/utils/haptics'
import { ForwardLogo, GlassCard } from '@/core/ui'
import { ConfirmModal } from '@/core/ui/ConfirmModal'
import { useCreateVenta, useCatalogoStock, useClientesActivos, useConfiguracionSistema } from '@/libs/api-client'
import { Image as ExpoImage } from 'expo-image'
import { getFullImageUrl } from '@/libs/api-client'
import type { ClienteLightDto, CreateVentaRequest } from '@/libs/api-client'
import type { CreateVentaFormData } from '@/libs/validations'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { esPrecioValido, pctFromPrecio, precioFromPct, canViewCost, calcularSubtotalConDescuento, derivarFloorBroken, computeModalFloor } from '@/features/ventas/lib/descuentos'
import { BandChip } from '@/features/ventas/components/BandChip'
import { CarritoSemaforo } from '@/features/ventas/components/CarritoSemaforo'
import { METODO_ENTREGA, isProductAddable, requiereFechaEntrega, esFechaEntregaValida, buildVentaPayload } from '@/features/ventas/lib/venta-form-retiro'
import type { VentaFormData } from '@/features/ventas/lib/venta-form-retiro'

// ─── Types ────────────────────────────────────────────────────────────────────
interface DetalleItem {
  productoId: string
  nombre: string
  imageUrl?: string
  precioUnitario: number
  /** Null for non-cost roles (server redacts it). Displayed for information only — NOT used for floor math. */
  precioCompraBase: number | null
  /** Server-computed profitability floor (PrecioMinimoRentable). Single floor for all roles. */
  precioMinimo: number | null
  /** "Adequate" band price — cost roles only. */
  precioAdecuado?: number | null
  /** "Premium" band price — cost roles only. */
  precioPremium?: number | null
  cantidad: number
  /** Units per minimum sale package (e.g. bulto of 800). Quantities move in multiples of this. */
  ventaMinima: number
  /** Minimum sale fraction label: "Unidad" | "Blister" | "Bulto". For display only. */
  fraccion: string
  descuentoPorcentaje: number
  stockDeposito: number
  stockReservado: number
  stockVirtual: number
  stockReal: number
  originalQuantity: number // Cantidad que tenía antes de editar
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcLineTotal(item: DetalleItem) {
  return calcularSubtotalConDescuento(item.precioUnitario, item.cantidad, item.descuentoPorcentaje)
}

// Palabra visible de la fracción de venta. Convención del dueño: "bulto" = caja cerrada;
// la fracción que se vende suelta se muestra como "pack" (valor de modelo "Blister").
function fraccionWord(fraccion: string): string {
  return fraccion === 'Unidad' ? 'unidad' : 'pack'
}

function StockPill({ label, value, color, bgColor }: { label: string; value: number; color: string; bgColor: string }) {
  return (
    <View style={{
      backgroundColor: bgColor,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    }}>
      <Text style={{ color: color, fontSize: tokens.typography.xs.size, fontWeight: '800', fontFamily: Platform.OS === 'ios' ? 'Outfit' : 'sans-serif' }}>{label}:</Text>
      <Text style={{ color: color, fontSize: tokens.typography.xs.size, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Outfit' : 'sans-serif' }}>{value}</Text>
    </View>
  )
}

/**
 * Builds a fresh cart line (DetalleItem) from a catalog product.
 * Shared by the +/- stepper and the inline catalog discount so a discount
 * typed before adding can auto-create the line at minimum quantity.
 */
function makeDetalleFromProducto(prod: any, cantidad: number, descuentoPorcentaje = 0): DetalleItem {
  const ventaMinima = (prod?.ventaMinimaUnidades && prod.ventaMinimaUnidades > 1) ? prod.ventaMinimaUnidades : 1
  return {
    productoId: prod.id ?? '',
    nombre: prod.nombre ?? '',
    imageUrl: prod.imageUrl ?? undefined,
    precioUnitario: prod.precioVenta ?? 0,
    precioCompraBase: prod.precioCompraBase ?? null,
    precioMinimo: prod.precioMinimoRentable ?? null,
    precioAdecuado: prod.precioAdecuado ?? null,
    precioPremium: prod.precioPremium ?? null,
    cantidad,
    ventaMinima,
    fraccion: prod.fraccionMinimaVenta ?? 'Unidad',
    descuentoPorcentaje,
    originalQuantity: 0,
    stockDeposito: prod.deposito ?? 0,
    stockReservado: prod.reservado ?? 0,
    stockVirtual: prod.virtual ?? 0,
    stockReal: prod.real ?? 0,
  }
}

function ProductCatalogItem({
  item, cartQuantity, originalQuantity, onUpdate, onDiscountChange, cartDiscount, userRoles, maxDescuento,
}: {
  item: any
  cartQuantity: number
  originalQuantity: number
  onUpdate: (prod: any, qty: number) => void
  /** Called when the user types an inline discount % for this product (ALL roles). Receives the full product so it can auto-add the line to the cart if not present yet. */
  onDiscountChange: (prod: any, pct: number) => void
  /** Current discount % for this item in the cart (reflects existing cart state) */
  cartDiscount: number
  userRoles: string[]
  /** Seller's max discount % cap (0 = no cap). The inline discount input is clamped to this. */
  maxDescuento: number
}) {
  const colors = useColors()
  const imgUrl = getFullImageUrl(item.imageUrl)
  // Fracción de venta: el +/- rápido del catálogo sube de a este valor (ej. 60, 120…).
  const vm = (item.ventaMinimaUnidades && item.ventaMinimaUnidades > 1) ? item.ventaMinimaUnidades : 1
  // Viñeta de info de venta mínima (el vendedor la ve al explorar el catálogo).
  const [infoOpen, setInfoOpen] = useState(false)
  // Inline discount input draft (keeps text while user types, syncs on blur)
  const [discDraft, setDiscDraft] = useState<string | null>(null)
  const isVendedor = !canViewCost(userRoles)

  // Shown value in the inline discount field
  const discDisplayValue = discDraft !== null ? discDraft : (cartDiscount > 0 ? String(cartDiscount) : '')

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{
        backgroundColor: cartQuantity > 0 ? `${colors.primary}05` : colors.surface,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: cartQuantity > 0 ? 1 : 0,
        borderColor: cartQuantity > 0 ? `${colors.primary}20` : 'transparent',
      }}>
        {/* Lateral layout: image LEFT, content RIGHT */}
        <View style={{ flexDirection: 'row', padding: 12, gap: 12 }}>
          {/* Left: large lateral image */}
          <View style={{
            width: 100,
            height: 100,
            borderRadius: 14,
            backgroundColor: colors.surface2,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
          }}>
            {imgUrl
              ? <ExpoImage source={imgUrl} style={{ width: 100, height: 100 }} contentFit="contain" />
              : <Tag size={36} color={colors.textDisabled} />
            }
          </View>

          {/* Right: name, price, stepper, chips */}
          <View style={{ flex: 1 }}>
            {/* Name + qty stepper row */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ flex: 1, fontSize: 13, fontWeight: '800', color: colors.text, fontFamily: Platform.OS === 'ios' ? 'Outfit' : 'sans-serif', lineHeight: 17 }} numberOfLines={2}>
                {item.nombre}
              </Text>

              {/* Qty stepper */}
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface2, borderRadius: 12 }}>
                <Pressable onPress={() => onUpdate(item, Math.max(0, cartQuantity - vm))} style={{ padding: 8 }}>
                  <Minus size={14} color={cartQuantity > 0 ? colors.text : colors.textDisabled} strokeWidth={3} />
                </Pressable>
                <TextInput
                  style={{ color: cartQuantity > 0 ? colors.text : colors.textDisabled, fontWeight: '900', fontSize: tokens.typography.base.size, minWidth: 20, textAlign: 'center', padding: 0 }}
                  keyboardType="number-pad"
                  value={cartQuantity > 0 ? String(cartQuantity) : ''}
                  placeholder="0"
                  placeholderTextColor={colors.textDisabled}
                  onChangeText={v => {
                    const num = parseInt(v, 10)
                    if (!isNaN(num)) onUpdate(item, vm > 1 ? Math.max(vm, Math.round(num / vm) * vm) : num)
                    else if (v === '') onUpdate(item, 0)
                  }}
                />
                <Pressable onPress={() => onUpdate(item, cartQuantity + vm)} style={{ padding: 8 }}>
                  <Plus size={14} color={colors.primary} strokeWidth={3} />
                </Pressable>
              </View>
            </View>

            {/* Price */}
            <Text style={{ fontSize: tokens.typography.md.size, fontWeight: '900', color: colors.primary, marginTop: 4, fontFamily: Platform.OS === 'ios' ? 'Outfit' : 'sans-serif' }}>
              ${(item.precioVenta || 0).toLocaleString('es-AR')}
            </Text>

            {/* Stock chips */}
            <View style={{ flexDirection: 'row', gap: 4, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {isVendedor ? (
                <>
                  <StockPill
                    label="Disp"
                    value={item.real + originalQuantity - cartQuantity}
                    color={(item.real + originalQuantity - cartQuantity) < 0 ? colors.danger : colors.primary}
                    bgColor={(item.real + originalQuantity - cartQuantity) < 0 ? `${colors.danger}1f` : `${colors.primary}1f`}
                  />
                  <StockPill
                    label="Virt"
                    value={item.virtual}
                    color={colors.textMuted}
                    bgColor={`${colors.textMuted}1f`}
                  />
                </>
              ) : (
                <>
                  <StockPill
                    label="🏢"
                    value={item.deposito}
                    color={item.deposito <= 0 ? colors.danger : colors.success}
                    bgColor={item.deposito <= 0 ? `${colors.danger}1f` : `${colors.success}1f`}
                  />
                  <StockPill
                    label="🔒"
                    value={item.reservado}
                    color={BRAND.blue}
                    bgColor={`${BRAND.blue}1f`}
                  />
                  <StockPill
                    label="✅"
                    value={item.real + originalQuantity - cartQuantity}
                    color={(item.real + originalQuantity - cartQuantity) < 0 ? colors.danger : colors.primary}
                    bgColor={(item.real + originalQuantity - cartQuantity) < 0 ? `${colors.danger}1f` : `${colors.primary}1f`}
                  />
                </>
              )}
            </View>

            {/* BandChip — only for cost roles */}
            {!isVendedor && (
              <View style={{ marginTop: 4 }}>
                <BandChip
                  precioMinimoRentable={item.precioMinimoRentable ?? null}
                  precioAdecuado={item.precioAdecuado ?? null}
                  precioPremium={item.precioPremium ?? null}
                  userRoles={userRoles}
                />
              </View>
            )}

            {/* Venta mínima por pack */}
            {vm > 1 && (
              <View style={{ marginTop: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ backgroundColor: `${colors.warning}1f`, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 }}>
                    <Text style={{ color: colors.warning, fontSize: 9, fontWeight: '700' }}>mín: pack de {vm} u</Text>
                  </View>
                  <Pressable onPress={() => setInfoOpen(o => !o)} hitSlop={8}>
                    <Info size={12} color={colors.warning} />
                  </Pressable>
                </View>
                {infoOpen && (
                  <View style={{ marginTop: 4, backgroundColor: colors.text, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, maxWidth: 220 }}>
                    <Text style={{ color: colors.bg, fontSize: tokens.typography.xs.size, fontWeight: '600' }}>
                      Mínimo de venta: pack de {vm} unidades. El precio y el stock se manejan por unidad.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Inline per-product discount (ALL roles, always visible — parity with the web card). Typing a discount on a product not yet in the cart auto-adds it at minimum quantity. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <Percent size={11} color={cartDiscount > 0 ? colors.warning : colors.textMuted} />
                <Text style={{ color: colors.textMuted, fontSize: tokens.typography.xs.size, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Outfit' : 'sans-serif' }}>desc:</Text>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.surface2,
                  borderRadius: 8,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderWidth: 1,
                  borderColor: cartDiscount > 0 ? `${colors.warning}60` : colors.border,
                  minWidth: 52,
                }}>
                  <TextInput
                    style={{
                      color: cartDiscount > 0 ? colors.warning : colors.text,
                      fontWeight: '800',
                      fontSize: tokens.typography.sm.size,
                      minWidth: 28,
                      textAlign: 'right',
                      padding: 0,
                      fontFamily: Platform.OS === 'ios' ? 'Outfit' : 'sans-serif',
                    }}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textDisabled}
                    value={discDisplayValue}
                    onChangeText={v => setDiscDraft(v)}
                    onBlur={() => {
                      const parsed = parseFloat((discDraft ?? '').replace(',', '.'))
                      // Clamp to the seller's cap (not just 0-100) so the inline discount can't exceed the limit.
                      const cap = maxDescuento > 0 ? maxDescuento : 100
                      const safe = Number.isFinite(parsed) ? Math.min(Math.max(0, parsed), cap) : 0
                      setDiscDraft(null)
                      onDiscountChange(item, safe)
                    }}
                    maxLength={5}
                  />
                  <Text style={{ color: colors.textMuted, fontSize: 11, marginLeft: 1, fontWeight: '700' }}>%</Text>
                </View>
              </View>
          </View>
        </View>
      </View>
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DescuentoItemModalRN — Per-item discount modal (React Native, mobile style)
// ─────────────────────────────────────────────────────────────────────────────

interface DescuentoItemModalRNProps {
  visible: boolean
  productoNombre: string
  currentDescuento: number
  precioVenta: number
  /**
   * Null for non-cost roles (server redacts it).
   * Displayed for information only — NOT used for floor math (PR-2e-a).
   */
  precioCompraBase: number | null
  margenGlobal: number
  /**
   * Server-computed profitability floor (PrecioMinimoRentable).
   * The SINGLE floor for all roles. Null when unknown (fail-open).
   */
  precioMinimo?: number | null
  /**
   * Current sale-level general discount percentage (0–100).
   * Required for the compound floor gate (C1 lesson): the modal validates
   * item × general combined, so ignoring this would allow discounts the
   * cart and server would reject.
   */
  descuentoGeneral?: number
  maxDescuentoVendedor: number
  /** Roles of the authenticated user — gates cost field visibility */
  userRoles?: string[]
  /**
   * Real stock quantity — used for post-sale stock projection.
   * When null, the projection section is hidden.
   */
  stockReal?: number | null
  /**
   * Reserved stock quantity — disponible = stockReal - stockReservado
   */
  stockReservado?: number | null
  /** Current quantity in the cart line — used for projection */
  cantidad?: number
  onApply: (pct: number) => void
  onClose: () => void
}

function DescuentoItemModalRN({
  visible,
  productoNombre,
  currentDescuento,
  precioVenta,
  precioCompraBase,
  margenGlobal: _margenGlobal,
  precioMinimo,
  descuentoGeneral = 0,
  maxDescuentoVendedor,
  userRoles = [],
  stockReal,
  stockReservado,
  cantidad = 0,
  onApply,
  onClose,
}: DescuentoItemModalRNProps) {
  const colors = useColors()

  // % is the source of truth per ADR-5
  const [pctInput, setPctInput] = useState(String(currentDescuento))
  // Secondary input: discounted price (derived from %, also editable)
  const [precioInput, setPrecioInput] = useState(
    String(precioFromPct(precioVenta, currentDescuento))
  )

  const pct = parseFloat(pctInput.replace(',', '.')) || 0
  const precioFinal = precioVenta * (1 - pct / 100)

  // Typed price: what the user sees in the price input.
  // Used for FIX #1 (rounding over-block parity): pctFromPrecio rounds to 2 dec
  // → precioFinal drifts sub-cent below the typed value → esPrecioValido would
  // falsely block a price equal to a non-integer floor. Validating the typed
  // value avoids the drift.
  const typedPrecio = parseFloat(precioInput.replace(',', '.'))

  // PR-2e-a — unified single server floor for all roles.
  // Floor source: precioMinimo (server-computed PrecioMinimoRentable).
  // The old cost-path (precioCompraBase * (1 + margenGlobal)) has been RETIRED.
  //
  // computeModalFloor mirrors web modal-discount-helpers.ts#computeModalFloor:
  //   effectiveFloor = precioMinimo / generalFactor  (rounded to 2 decimals, W2 parity)
  // Clamp prevents div/0 at g=100. floorUnknown → fail-open (no warning).
  const { piso, floorUnknown } = computeModalFloor({ precioMinimo, descuentoGeneral })

  // Stock projection (S3b)
  const stockDisponible = (stockReal ?? 0) - (stockReservado ?? 0)
  const postSaleStock = stockDisponible - cantidad
  const projectionNegative = postSaleStock < 0
  const showProjection = stockReal != null

  // Cost row visibility (ADR-5 / S3b): only cost roles see precioCompraBase
  const userCanViewCost = canViewCost(userRoles)

  // block→route (PR-2e-a): piercesFloor is now ADVISORY — it shows a warning
  // and routes the venta to PendienteAutorizacion server-side, but does NOT
  // disable the Apply button. The HARD seller cap (maxDescuentoVendedor) is the
  // only hard block. Null floor → fail-open (no warning either).
  //
  // W1 parity: pct > 0 guard mirrors web DescuentoItemModal.tsx:143 — at 0%
  //   item discount the modal must NOT show "Requiere autorización".
  // W2 parity: piso from computeModalFloor is rounded to 2 decimals.
  // FIX #1 preserved: validate typedPrecio to avoid sub-cent rounding drift.
  const piercesFloor =
    !floorUnknown &&
    pct > 0 &&
    precioVenta > 0 &&
    !esPrecioValido(Number.isFinite(typedPrecio) ? typedPrecio : precioFinal, piso)

  const exceedsVendorCap = maxDescuentoVendedor > 0 && pct > maxDescuentoVendedor
  // isInvalid: only vendor cap and out-of-range pct are hard blocks (PR-2e-a).
  // Floor pierce is advisory — routes to PendienteAutorizacion, not blocked here.
  const isInvalid = exceedsVendorCap || pct < 0 || pct > 100

  // ── Bidirectional handlers ────────────────────────────────────────────────

  const handlePctChange = (value: string) => {
    setPctInput(value)
    const parsed = parseFloat(value.replace(',', '.'))
    if (Number.isFinite(parsed) && precioVenta > 0) {
      setPrecioInput(String(precioFromPct(precioVenta, parsed)))
    }
  }

  const handlePrecioChange = (value: string) => {
    setPrecioInput(value)
    const parsed = parseFloat(value.replace(',', '.'))
    if (Number.isFinite(parsed) && precioVenta > 0) {
      setPctInput(String(pctFromPrecio(precioVenta, parsed)))
    }
  }

  const handleApply = () => {
    if (isInvalid) return
    onApply(pct)
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)' }}
      >
        <Pressable style={{ ...StyleSheet.absoluteFillObject }} onPress={onClose} />
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
        <View style={{
          margin: 24,
          backgroundColor: colors.surface,
          borderRadius: 24,
          padding: 24,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 16,
          elevation: 10,
        }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ color: colors.text, fontSize: tokens.typography.lg.size, fontWeight: '900', fontFamily: 'Outfit_900Black' }}>
                Descuento por ítem
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4, fontFamily: 'Outfit_500Medium' }} numberOfLines={2}>
                {productoNombre}
              </Text>
            </View>
            <Pressable onPress={onClose} style={{ padding: 4 }}>
              <X size={20} color={colors.textDisabled} />
            </Pressable>
          </View>

          {/* Bidirectional inputs (S3b — ADR-5) */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
            {/* Discount % input */}
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', fontFamily: 'Outfit_600SemiBold', marginBottom: 8 }}>
                DESCUENTO (%)
              </Text>
              <View style={{
                backgroundColor: colors.surface2,
                borderRadius: 14,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderWidth: 1.5,
                borderColor: isInvalid ? colors.danger : colors.border,
              }}>
                <TextInput
                  style={{
                    flex: 1,
                    color: colors.text,
                    fontWeight: '800',
                    fontSize: 20,
                    fontFamily: 'Outfit_900Black',
                    textAlign: 'right',
                    paddingVertical: 10,
                  }}
                  keyboardType="decimal-pad"
                  value={pctInput}
                  onChangeText={handlePctChange}
                  autoFocus
                  selectTextOnFocus
                  maxLength={6}
                />
                <Text style={{ color: colors.textMuted, fontSize: tokens.typography.lg.size, fontWeight: '800', marginLeft: 4, fontFamily: 'Outfit_700Bold' }}>%</Text>
              </View>
            </View>

            {/* Discounted price input */}
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', fontFamily: 'Outfit_600SemiBold', marginBottom: 8 }}>
                PRECIO FINAL ($)
              </Text>
              <View style={{
                backgroundColor: colors.surface2,
                borderRadius: 14,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderWidth: 1.5,
                borderColor: piercesFloor ? colors.warning : colors.border,
              }}>
                <Text style={{ color: colors.textMuted, fontSize: tokens.typography.md.size, fontWeight: '800', marginRight: 2, fontFamily: 'Outfit_700Bold' }}>$</Text>
                <TextInput
                  style={{
                    flex: 1,
                    color: colors.text,
                    fontWeight: '800',
                    fontSize: 20,
                    fontFamily: 'Outfit_900Black',
                    textAlign: 'right',
                    paddingVertical: 10,
                  }}
                  keyboardType="decimal-pad"
                  value={precioInput}
                  onChangeText={handlePrecioChange}
                  selectTextOnFocus
                  maxLength={10}
                />
              </View>
            </View>
          </View>

          {/* Price preview + floor */}
          <View style={{
            backgroundColor: colors.surface2,
            borderRadius: 16,
            padding: 14,
            marginBottom: 12,
            gap: 8,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: colors.textMuted, fontSize: 13, fontFamily: 'Outfit_500Medium' }}>Precio base</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13, fontFamily: 'Outfit_600SemiBold' }}>
                ${precioVenta.toLocaleString('es-AR')}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', fontFamily: 'Outfit_700Bold' }}>Precio final</Text>
              <Text style={{
                fontSize: 15,
                fontWeight: '800',
                fontFamily: 'Outfit_700Bold',
                color: piercesFloor ? colors.warning : colors.primary,
              }}>
                ${precioFinal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
            {userCanViewCost && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colors.textDisabled, fontSize: 11, fontFamily: 'Outfit_500Medium' }}>
                  Precio mínimo
                </Text>
                <Text style={{ color: colors.textDisabled, fontSize: 11, fontFamily: 'Outfit_600SemiBold' }}>
                  ${piso.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            )}

            {/* Cost row — only for cost-authorized roles (S3b) */}
            {userCanViewCost && precioCompraBase != null && (
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTopWidth: 1,
                borderTopColor: colors.border,
                paddingTop: 6,
                marginTop: 2,
              }}>
                <Text style={{ color: colors.textDisabled, fontSize: 11, fontFamily: 'Outfit_500Medium' }}>Precio de compra</Text>
                <Text style={{ color: colors.textDisabled, fontSize: 11, fontFamily: 'Outfit_600SemiBold' }}>
                  ${precioCompraBase.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            )}
          </View>

          {/* Post-sale stock projection (S3b) */}
          {showProjection && (
            <View style={{
              backgroundColor: colors.surface2,
              borderRadius: 16,
              padding: 14,
              marginBottom: 12,
              gap: 6,
            }}>
              <Text style={{ color: colors.textMuted, fontSize: tokens.typography.xs.size, fontWeight: '800', fontFamily: 'Outfit_700Bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>
                Proyección de stock
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colors.textDisabled, fontSize: tokens.typography.sm.size, fontFamily: 'Outfit_500Medium' }}>Stock disponible</Text>
                <Text style={{ color: colors.textDisabled, fontSize: tokens.typography.sm.size, fontFamily: 'Outfit_600SemiBold' }}>
                  {stockDisponible.toLocaleString('es-AR')}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colors.textDisabled, fontSize: tokens.typography.sm.size, fontFamily: 'Outfit_500Medium' }}>Cant. en pedido</Text>
                <Text style={{ color: colors.textDisabled, fontSize: tokens.typography.sm.size, fontFamily: 'Outfit_600SemiBold' }}>
                  -{cantidad.toLocaleString('es-AR')}
                </Text>
              </View>
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTopWidth: 1,
                borderTopColor: colors.border,
                paddingTop: 6,
                marginTop: 2,
              }}>
                <Text style={{ color: projectionNegative ? colors.danger : colors.text, fontSize: 13, fontWeight: '700', fontFamily: 'Outfit_700Bold' }}>
                  Post-venta
                </Text>
                <Text style={{ color: projectionNegative ? colors.danger : colors.text, fontSize: 13, fontWeight: '800', fontFamily: 'Outfit_700Bold' }}>
                  {postSaleStock.toLocaleString('es-AR')}
                  {projectionNegative ? ' ⚠' : ''}
                </Text>
              </View>
            </View>
          )}

          {/* Validation warnings */}
          {piercesFloor && (
            <View style={{
              backgroundColor: `${colors.warning}12`,
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 8,
              borderWidth: 1,
              borderColor: `${colors.warning}30`,
            }}>
              <AlertCircle size={14} color={colors.warning} style={{ marginTop: 1 }} />
              <Text style={{ color: colors.warning, fontSize: tokens.typography.sm.size, fontFamily: 'Outfit_600SemiBold', flex: 1 }}>
                {userCanViewCost
                  ? `El precio final está por debajo del mínimo rentable ($${piso.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}). La venta quedará pendiente de autorización.`
                  : 'El precio está por debajo del mínimo; la venta quedará pendiente de autorización.'}
              </Text>
            </View>
          )}
          {exceedsVendorCap && (
            <View style={{
              backgroundColor: `${colors.danger}12`,
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 8,
              borderWidth: 1,
              borderColor: `${colors.danger}30`,
            }}>
              <AlertCircle size={14} color={colors.danger} style={{ marginTop: 1 }} />
              <Text style={{ color: colors.danger, fontSize: tokens.typography.sm.size, fontFamily: 'Outfit_600SemiBold', flex: 1 }}>
                Tu tope de descuento es {maxDescuentoVendedor}%. No podés superar ese límite.
              </Text>
            </View>
          )}
          {isInvalid && !piercesFloor && !exceedsVendorCap && (
            <View style={{
              backgroundColor: `${colors.danger}12`,
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: `${colors.danger}30`,
            }}>
              <Text style={{ color: colors.danger, fontSize: tokens.typography.sm.size, fontFamily: 'Outfit_600SemiBold' }}>
                El descuento debe estar entre 0% y 100%.
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
            <Pressable
              onPress={onClose}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 16,
                backgroundColor: colors.surface2,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.textMuted, fontWeight: '800', fontSize: 15, fontFamily: 'Outfit_700Bold' }}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={handleApply}
              disabled={isInvalid}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 16,
                backgroundColor: isInvalid ? colors.surface2 : colors.primary,
                alignItems: 'center',
                opacity: isInvalid ? 0.5 : 1,
              }}
            >
              <Text style={{
                color: isInvalid ? colors.textDisabled : '#fff',
                fontWeight: '900',
                fontSize: 15,
                fontFamily: 'Outfit_900Black',
              }}>
                Aplicar
              </Text>
            </Pressable>
          </View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────
import { useLocalSearchParams } from 'expo-router'
import { useVenta, useUpdateVenta, ventasKeys } from '@/libs/api-client'
import { useEffect } from 'react'
import { useFocusEffect } from '@react-navigation/native'

export default function NuevaVentaMobileScreen() {
  const router = useRouter()
  const navigation = useNavigation()
  const colors = useColors()
  const isDark = useIsDark()
  const insets = useSafeAreaInsets()
  const { editId } = useLocalSearchParams<{ editId: string }>()
  const isEditing = !!editId

  // #region ═══════════════════════════════════════════════════════════════════
  // STATE LIFECYCLE MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────
  // Problema resuelto:
  //   Expo Router reutiliza la instancia del componente cuando la ruta base
  //   es la misma (ej: /nueva?editId=A → salir → /nueva?editId=A). Esto causa
  //   que los hooks useState conserven los valores modificados por el usuario
  //   de la sesión anterior ("stale local state"), a pesar de que la DB tiene
  //   los datos originales.
  //
  // Solución:
  //   Se utiliza `useFocusEffect` de React Navigation para garantizar que:
  //   1. Al ganar foco: se invalida el caché de React Query y se resetea el
  //      estado local del formulario antes de re-hidratar desde la API.
  //   2. Al perder foco (cleanup): se ejecuta un flush preventivo del estado
  //      local para que, si el componente sobrevive al desmontaje, no arrastre
  //      datos sucios a la siguiente activación.
  //
  // Referencia técnica:
  //   - React Navigation: useFocusEffect > useEffect para lifecycle de pantalla
  //   - React Query: invalidateQueries fuerza un refetch desde el servidor
  //   - El flag `_isHydrated` previene que el efecto de hidratación corra
  //     con datos stale del caché antes de que el refetch se complete.
  // ═══════════════════════════════════════════════════════════════════════════

  const { data: ventaRaw, isLoading: loadingVenta } = useVenta(editId ?? '')
  const { mutateAsync: createVenta, isPending: isCreating } = useCreateVenta()
  const { mutateAsync: updateVenta, isPending: isUpdating } = useUpdateVenta()
  const isPending = isCreating || isUpdating

  const { data: productosResponse } = useCatalogoStock(undefined)
  const { data: clientesResponse } = useClientesActivos()
  const { user } = useAuthStore()
  // FIX #2 (S3b): margen-minimo is now role-gated on the backend (S3a).
  // Non-cost roles receive 403 — disable the query for them to avoid retry spam.
  // PR-2e-a: floor computation no longer uses margenGlobal client-side (server floor).
  // The query is kept for cost roles who may display cost info in the modal.
  const userRoles = (user?.roles ?? []) as string[]
  const isVendedor = !canViewCost(userRoles)
  const { data: configuracion } = useConfiguracionSistema({ enabled: canViewCost(userRoles) })
  const queryClient = useQueryClient()

  const margenGlobal = configuracion?.margenMinimoGlobal ?? 0
  const maxDescuentoVendedor = user?.maxDescuentoPorcentaje ?? 0
  
  // El API client desempaqueta el envelope ApiResponse<T>, así que aquí ya
  // recibimos el array directo de ClienteLightDto / StockItem.
  const clientes = Array.isArray(clientesResponse) ? clientesResponse : []
  const productos = Array.isArray(productosResponse) ? productosResponse : []

  // ── Form state ──
  const [clienteSelected, setClienteSelected] = useState<ClienteLightDto | null>(null)
  const [depositoId] = useState('DEP-001')
  const [tipoOperacion, setTipoOperacion] = useState<1 | 2>(2) // 1=Presupuesto 2=Pedido
  const [detalles, setDetalles] = useState<DetalleItem[]>([])
  const [descuentoGeneral, setDescuentoGeneral] = useState('')
  const [cargoFleteInput, setCargoFleteInput] = useState<string>('')
  const [isFleteManual, setIsFleteManual] = useState(false)
  const [isFleteFocused, setIsFleteFocused] = useState(false)
  const [fechaEntrega, setFechaEntrega] = useState<Date | null>(null)
  const [metodoEntrega, setMetodoEntrega] = useState<1 | 2 | 3>(1) // 1=Logística 2=Retiro 3=Expreso
  const [entregaInmediata, setEntregaInmediata] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [tempFecha, setTempFecha] = useState<Date>(new Date())
  const [ventaVersion, setVentaVersion] = useState<number>(0)
  const [isDiscountFocused, setIsDiscountFocused] = useState(false)
  // Borrador de texto del input de cantidad por producto (permite escribir libre antes del snap en blur).
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({})
  // Qué producto tiene abierta la viñeta de info de fracción.
  const [infoFraccionId, setInfoFraccionId] = useState<string | null>(null)

  const openDatePicker = () => {
    setTempFecha(fechaEntrega || new Date())
    setShowDatePicker(true)
  }

  // Reset flete manual when delivery method changes
  useEffect(() => {
    setIsFleteManual(false)
  }, [metodoEntrega])

  // #region ── State Lifecycle: Focus Key ──────────────────────────────────────
  /// <summary>
  /// Contador de foco que se incrementa cada vez que la pantalla gana visibilidad.
  /// Se usa como dependencia del efecto de hidratación para FORZAR su re-ejecución,
  /// incluso cuando React Query devuelve la misma referencia por structural sharing.
  /// Sin este mecanismo, si la data del server no cambia entre visitas, el useEffect
  /// de hidratación nunca se re-dispara porque ventaRaw es el mismo objeto.
  /// </summary>
  const [focusKey, setFocusKey] = useState(0)
  // #endregion

  /// <summary>
  /// Resetea todo el estado local del formulario a valores iniciales limpios.
  /// Se invoca tanto al ganar foco (antes de hidratar) como al perder foco
  /// (cleanup preventivo por si el componente sobrevive al desmontaje).
  /// </summary>
  const resetFormState = useCallback(() => {
    setClienteSelected(null)
    setDetalles([])
    setDescuentoGeneral('')
    setCargoFleteInput('')
    setIsFleteManual(false)
    setMotivo('')
    setTipoOperacion(2)
    setFechaEntrega(null)
    setMetodoEntrega(1)
    setEntregaInmediata(false)
  }, [])

  /// <summary>
  /// useFocusEffect — Core de la solución de state lifecycle.
  /// Se ejecuta cada vez que esta pantalla gana el foco del navigator.
  ///
  /// Estrategia de 3 pasos:
  ///   1. Flush: limpia todo el estado local del formulario.
  ///   2. Destroy cache: usa removeQueries (NO invalidateQueries) para DESTRUIR
  ///      la entrada de caché de React Query. Esto fuerza ventaRaw a pasar de
  ///      data → undefined → freshData, generando un cambio de referencia real.
  ///   3. Bump focusKey: incrementa el contador para forzar el useEffect de
  ///      hidratación a re-ejecutarse (belt-and-suspenders contra structural sharing).
  ///
  /// ¿Por qué removeQueries y no invalidateQueries?
  ///   invalidateQueries marca la query como stale y hace un refetch en background,
  ///   pero si el server devuelve los mismos datos, React Query aplica "structural
  ///   sharing" y retorna la MISMA referencia de objeto. El useEffect que observa
  ///   ventaRaw no detecta cambio → no re-hidrata → form queda vacío.
  ///   removeQueries destruye la entrada completa del caché, forzando ventaRaw
  ///   a ser undefined momentáneamente, lo que genera un cambio de referencia real.
  /// </summary>
  useFocusEffect(
    useCallback(() => {
      // ── ON FOCUS (pantalla visible) ──────────────────────────────────────
      // Paso 1: Limpiar el estado local antes de hidratar
      resetFormState()

      // Paso 2: DESTRUIR caché (no solo invalidar) para forzar cambio de referencia
      if (editId) {
        queryClient.removeQueries({ queryKey: ventasKeys.detail(editId) })
      }
      // Refrescar catálogo de stock (puede haber cambiado entre visitas)
      queryClient.invalidateQueries({ queryKey: ['productos', 'catalogoStock'] })

      // Paso 3: Incrementar focusKey para forzar re-hidratación
      setFocusKey(k => k + 1)

      // ── ON BLUR (cleanup — pantalla pierde foco) ────────────────────────
      // Flush preventivo: si el usuario sale sin guardar, destruimos el
      // estado local inmediatamente para que no arrastre datos sucios.
      return () => {
        resetFormState()
      }
    }, [editId, queryClient, resetFormState])
  )

  /// <summary>
  /// Efecto de hidratación del formulario para modo edición.
  /// Se ejecuta cuando llegan datos frescos del servidor (ventaRaw) y
  /// mapea la respuesta de la API a los campos del formulario local.
  ///
  /// Dependencias clave:
  ///   - ventaRaw: cambia cuando removeQueries fuerza un refetch (undefined → data)
  ///   - focusKey: garantiza re-ejecución incluso si ventaRaw tiene misma referencia
  ///   - productos: necesario para mapear stock del catálogo a cada detalle
  ///
  /// Nota: Este efecto corre DESPUÉS del useFocusEffect. En el momento de ejecución:
  ///   1. El formulario ya fue limpiado por resetFormState()
  ///   2. ventaRaw contiene data fresca del servidor (post-removeQueries + refetch)
  /// </summary>
  useEffect(() => {
    if (isEditing && ventaRaw) {
      const venta = ventaRaw.venta
      const items = ventaRaw.detalles ?? []
      
      if (venta) {
        setClienteSelected({ id: venta.clienteId ?? '', razonSocial: venta.clienteNombre ?? '', cuit: '' })
        setTipoOperacion(venta.tipoOperacion as 1 | 2)
        setDescuentoGeneral(venta.porcentajeDescuento ? String(venta.porcentajeDescuento) : '')
        setMetodoEntrega((venta.metodoEntrega ?? 1) as 1 | 2 | 3)
        if (venta.fechaEntrega) setFechaEntrega(new Date(venta.fechaEntrega))
        setVentaVersion(venta.version ?? 0)
        if (venta.cargoFleteAmount !== undefined && venta.cargoFleteAmount !== null) {
          setCargoFleteInput(String(venta.cargoFleteAmount))
          setIsFleteManual(true)
        } else {
          setCargoFleteInput('')
          setIsFleteManual(false)
        }
        setDetalles(items.map((i: any) => {
          const prodCatalog = productos.find((p: any) => p.id === i.productoId)
          const originalQty = i.cantidad || 0
          const realBaseInCatalog = prodCatalog?.real ?? 0

          return {
            productoId: i.productoId,
            nombre: i.productoNombre ?? i.producto ?? '',
            precioUnitario: i.precioUnitario ?? i.costoUnitarioBaseAmount ?? 0,
            precioCompraBase: prodCatalog?.precioCompraBase ?? null,
            precioMinimo: prodCatalog?.precioMinimoRentable ?? null,
            precioAdecuado: prodCatalog?.precioAdecuado ?? null,
            precioPremium: prodCatalog?.precioPremium ?? null,
            cantidad: originalQty,
            ventaMinima: (prodCatalog?.ventaMinimaUnidades && prodCatalog.ventaMinimaUnidades > 1) ? prodCatalog.ventaMinimaUnidades : 1,
            fraccion: prodCatalog?.fraccionMinimaVenta ?? 'Unidad',
            descuentoPorcentaje: i.descuentoPorcentaje ?? 0,
            originalQuantity: originalQty,
            stockDeposito: prodCatalog?.deposito ?? 0,
            stockReservado: prodCatalog?.reservado ?? 0,
            stockVirtual: prodCatalog?.virtual ?? 0,
            stockReal: realBaseInCatalog + originalQty,
          }
        }))
      }
    }
  }, [isEditing, ventaRaw, productos, focusKey])
  // #endregion

  // ── Modal state ──
  const [showClientModal, setShowClientModal] = useState(false)
  const [showProductModal, setShowProductModal] = useState(false)
  const [showMotivoModal, setShowMotivoModal] = useState(false)
  const [discountModalItem, setDiscountModalItem] = useState<{ productoId: string; nombre: string } | null>(null)
  const [motivo, setMotivo] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [modalState, setModalState] = useState<{ visible: boolean; title: string; message: string; variant: 'success' | 'danger' | 'warning'; onConfirm: () => void } | null>(null)
  const [cartExpanded, setCartExpanded] = useState(false)
  // Change 5 — vendedor success overlay state
  const [vendedorSuccessVentaId, setVendedorSuccessVentaId] = useState<string | null>(null)
  const [isSharingPdf, setIsSharingPdf] = useState(false)

  // ─── Computed ───────────────────────────────────────────────────────────────
  const descGeneral = Math.min(Math.max(parseFloat(descuentoGeneral) || 0, 0), 100)

  // subtotalSinDesc already incorporates per-item discounts (calcLineTotal uses calcularSubtotalConDescuento)
  const subtotalSinDesc = detalles.reduce((acc, d) => acc + calcLineTotal(d), 0)
  // descGeneralMonto is applied on top of the already-discounted subtotal
  const descGeneralMonto = subtotalSinDesc * (descGeneral / 100)

  const fleteMonto = useMemo(() => {
    if (isFleteManual) {
      return parseFloat(cargoFleteInput) || 0
    }
    if (metodoEntrega === 1) { // Envío
      return Math.round((subtotalSinDesc - descGeneralMonto) * 0.05)
    }
    return 0
  }, [isFleteManual, cargoFleteInput, metodoEntrega, subtotalSinDesc, descGeneralMonto])

  useEffect(() => {
    if (!isFleteManual) {
      setCargoFleteInput(fleteMonto > 0 ? String(fleteMonto) : '')
    }
  }, [fleteMonto, isFleteManual])

  const total = subtotalSinDesc - descGeneralMonto + fleteMonto

  const clientesFiltrados = useMemo(
    () => clientes.filter((c: any) => c.razonSocial.toLowerCase().includes(clientSearch.toLowerCase())),
    [clientes, clientSearch]
  )
  const productosFiltrados = useMemo(
    () => productos.filter((p: any) => p.nombre.toLowerCase().includes(productSearch.toLowerCase())),
    [productos, productSearch]
  )

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const addProducto = (prod: typeof productos[0]) => {
    // When entregaInmediata is ON, block products with no available stock (spec S3, D4, D8)
    const stockDisponible = (prod.real ?? 0) - (prod.reservado ?? 0)
    if (!isProductAddable(entregaInmediata, stockDisponible)) {
      return // silently blocked — product row is already visually disabled
    }

    // Venta mínima: el carrito arranca y se mueve en múltiplos de este valor (ej. blister de 12).
    const vm = ((prod as any).ventaMinimaUnidades && (prod as any).ventaMinimaUnidades > 1) ? (prod as any).ventaMinimaUnidades : 1

    setDetalles(prev => {
      const idx = prev.findIndex(d => d.productoId === prod.id)
      const maxAvailable = 999999

      if (idx >= 0) {
        const copy = [...prev]
        const step = copy[idx].ventaMinima > 1 ? copy[idx].ventaMinima : 1
        copy[idx] = { ...copy[idx], cantidad: Math.min(copy[idx].cantidad + step, maxAvailable) }
        return copy
      }
      return [
        ...prev,
        {
          productoId: prod.id ?? '',
          nombre: prod.nombre ?? '',
          imageUrl: prod.imageUrl ?? undefined,
          precioUnitario: prod.precioVenta ?? 0,
          precioCompraBase: prod.precioCompraBase ?? null,
          precioMinimo: prod.precioMinimoRentable ?? null,
          precioAdecuado: prod.precioAdecuado ?? null,
          precioPremium: prod.precioPremium ?? null,
          cantidad: vm,
          ventaMinima: vm,
          fraccion: (prod as any).fraccionMinimaVenta ?? 'Unidad',
          descuentoPorcentaje: 0,
          originalQuantity: 0,
          stockDeposito: prod.deposito ?? 0,
          stockReservado: prod.reservado ?? 0,
          stockVirtual: prod.virtual ?? 0,
          stockReal: prod.real ?? 0,
        },
      ]
    })
    setShowProductModal(false)
  }

  const setProductoCantidad = (prod: any, qty: number) => {
    setDetalles(prev => {
      const idx = prev.findIndex(d => d.productoId === prod.id)
      const maxAvailable = 999999
      const safeQty = Math.min(Math.max(0, qty), maxAvailable)

      if (idx >= 0) {
        if (safeQty === 0) {
          return prev.filter(d => d.productoId !== prod.id)
        }
        const copy = [...prev]
        copy[idx] = { ...copy[idx], cantidad: safeQty }
        return copy
      }
      
      if (safeQty === 0) return prev

      return [...prev, makeDetalleFromProducto(prod, safeQty)]
    })
  }

  const updateCantidad = (id: string, delta: number) => {
    setDetalles(prev => {
      return prev.map(d => {
        if (d.productoId !== id) return d
        const maxAvailable = 999999
        // Step by venta mínima so the cart only holds whole packaging units.
        const step = d.ventaMinima > 1 ? d.ventaMinima : 1
        const dir = delta === 0 ? 0 : (delta > 0 ? 1 : -1)
        return { ...d, cantidad: Math.min(Math.max(step, d.cantidad + dir * step), maxAvailable) }
      })
    })
  }

  const setExactCantidad = (id: string, value: string) => {
    if (value === '') {
      setDetalles(prev => prev.map(d => d.productoId === id ? { ...d, cantidad: d.ventaMinima > 1 ? d.ventaMinima : 1 } : d))
      return
    }
    const num = parseInt(value, 10)
    if (isNaN(num)) return
    
    setDetalles(prev =>
      prev.map(d => {
        if (d.productoId !== id) return d
        const maxAvailable = 999999
        const step = d.ventaMinima > 1 ? d.ventaMinima : 1
        return { ...d, cantidad: Math.min(Math.max(step, num), maxAvailable) }
      })
    )
  }

  const shareToWhatsApp = async () => {
    if (!clienteSelected) return
    
    const header = `*${tipoOperacion === 1 ? 'PRESUPUESTO' : 'PEDIDO'} - FORWARD ERP*\n`
    const clientInfo = `Cliente: ${clienteSelected.razonSocial}\n`
    const dateInfo = `Fecha: ${new Date().toLocaleDateString('es-AR')}\n\n`
    
    const items = detalles.map(d => {
      const sub = calcLineTotal(d)
      return `- ${d.nombre} x${d.cantidad}: $${sub.toLocaleString('es-AR')}`
    }).join('\n')
    
    const footer = `\n\n*TOTAL: $${total.toLocaleString('es-AR')}*`
    
    const message = encodeURIComponent(header + clientInfo + dateInfo + items + footer)
    const url = `whatsapp://send?text=${message}`
    
    try {
      const canOpen = await Linking.canOpenURL(url)
      if (canOpen) {
        await Linking.openURL(url)
      } else {
        await Linking.openURL(`https://wa.me/?text=${message}`)
      }
    } catch (error) {
      // Fallback final en caso de error inesperado
      Linking.openURL(`https://wa.me/?text=${message}`)
    }
  }

  const removeDetalle = (id: string) =>
    setDetalles(prev => prev.filter(d => d.productoId !== id))

  const applyItemDescuento = useCallback((productoId: string, pct: number) => {
    setDetalles(prev => prev.map(d => d.productoId === productoId ? { ...d, descuentoPorcentaje: pct } : d))
    setDiscountModalItem(null)
    safeHaptics.notification('success')
  }, [])

  // Inline catalog discount setter (ALL roles). If the product isn't in the cart yet,
  // a positive discount auto-adds it at minimum quantity — parity with the web card.
  const applyInlineCatalogDiscount = useCallback((prod: any, pct: number) => {
    setDetalles(prev => {
      const idx = prev.findIndex(d => d.productoId === prod.id)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = { ...copy[idx], descuentoPorcentaje: pct }
        return copy
      }
      if (pct <= 0) return prev
      const ventaMinima = (prod?.ventaMinimaUnidades && prod.ventaMinimaUnidades > 1) ? prod.ventaMinimaUnidades : 1
      return [...prev, makeDetalleFromProducto(prod, ventaMinima, pct)]
    })
  }, [])

  const onSubmit = async () => {
    if (!clienteSelected) {
      setModalState({ visible: true, title: 'Atención', message: 'Seleccioná un cliente.', variant: 'warning', onConfirm: () => setModalState(null) })
      return
    }
    if (detalles.length === 0) {
      setModalState({ visible: true, title: 'Atención', message: 'Agregá al menos un producto.', variant: 'warning', onConfirm: () => setModalState(null) })
      return
    }

    const hasItemsSinStock = detalles.some(d => d.cantidad > d.stockReal)
    if (hasItemsSinStock && !motivo) {
      setShowMotivoModal(true)
      return
    }

    // Vendor cap enforcement for general discount
    if (maxDescuentoVendedor > 0 && descGeneral > maxDescuentoVendedor) {
      setModalState({ visible: true, title: 'Tope excedido', message: `Tu tope de descuento es ${maxDescuentoVendedor}%. No podés superar ese límite.`, variant: 'warning', onConfirm: () => setModalState(null) })
      return
    }

    // Vendor cap enforcement PER ITEM — authoritative backstop that covers every path that can
    // set a per-item discount (the cart modal AND the inline catalog input). Without this, the
    // inline catalog discount could exceed the seller's cap and be applied silently.
    if (maxDescuentoVendedor > 0) {
      const offender = detalles.find(d => (d.descuentoPorcentaje ?? 0) > maxDescuentoVendedor)
      if (offender) {
        setModalState({ visible: true, title: 'Tope excedido', message: `El descuento de "${offender.nombre}" (${offender.descuentoPorcentaje}%) supera tu tope de ${maxDescuentoVendedor}%.`, variant: 'warning', onConfirm: () => setModalState(null) })
        return
      }
    }

    const formData: VentaFormData = {
      clienteId: clienteSelected.id!,
      depositoId: 'fb15c487-acd2-41bb-8391-8353e61e8565', // Depósito Central
      tipoOperacion,
      descuentoGeneral: descGeneral,
      cargoFlete: fleteMonto,
      fechaEntrega,
      detalles: detalles.map(d => ({
        productoId: d.productoId,
        cantidad: d.cantidad,
        descuentoPorcentaje: d.descuentoPorcentaje,
      })),
    }

    const ventaPayload = buildVentaPayload(formData, entregaInmediata, metodoEntrega)

    const payload: CreateVentaRequest = {
      ...ventaPayload,
      vendedorId: user?.id,
      motivoVentaSinStock: motivo || undefined,
    }

    try {
      if (isEditing) {
        await updateVenta({ id: editId!, version: ventaVersion, data: payload })
      } else {
        const created = await createVenta(payload)
        // Change 5 — vendedor + Pedido (not presupuesto) + not editing → show success overlay with PDF share.
        // NOTE: the POST /Ventas endpoint actually returns VentaActionResponseDto { ventaId, version, message }
        // at runtime, even though the hook types it as Venta. So read `ventaId` (with `id` as a fallback).
        const newVentaId = (created as any)?.ventaId ?? (created as any)?.id ?? null
        if (isVendedor && tipoOperacion === 2 && newVentaId) {
          setVendedorSuccessVentaId(newVentaId)
          queryClient.invalidateQueries({ queryKey: ['productos', 'catalogoStock'] })
          return
        }
        // If the id couldn't be resolved, fall through to the normal success modal (still gives feedback).
      }

      setModalState({
        visible: true,
        title: 'Éxito',
        message: isEditing ? 'Venta actualizada con éxito' : (tipoOperacion === 1 ? 'Presupuesto guardado con éxito' : 'Pedido registrado con éxito'),
        variant: 'success',
        onConfirm: () => {
          setModalState(null)
          // Limpiar formulario para la próxima vez
          setClienteSelected(null)
          setDetalles([])
          setDescuentoGeneral('')
          setMotivo('')
          setTipoOperacion(2)

          // Refrescar el catálogo para ver los nuevos stocks (reservas)
          queryClient.invalidateQueries({ queryKey: ['productos', 'catalogoStock'] })

          router.replace('/(tabs)/ventas')
        }
      })
    } catch (e: any) {
      setModalState({
        visible: true,
        title: 'Error',
        message: e.message,
        variant: 'danger',
        onConfirm: () => setModalState(null)
      })
    }
  }

  // Change 5 — cleanup used by vendedor success overlay "Listo" button
  const handleVendedorSuccessClose = useCallback(() => {
    setVendedorSuccessVentaId(null)
    setClienteSelected(null)
    setDetalles([])
    setDescuentoGeneral('')
    setMotivo('')
    setTipoOperacion(2)
    router.replace('/(tabs)/ventas')
  }, [router])

  // Change 5 — PDF share from vendedor success overlay
  const handleShareNotaPdf = useCallback(async () => {
    if (!vendedorSuccessVentaId) return
    setIsSharingPdf(true)
    try {
      const url = getNotaEntregaUrl(vendedorSuccessVentaId)
      const shortId = vendedorSuccessVentaId.slice(0, 8)
      const result = await sharePdf(url, `nota-venta-${shortId}.pdf`)
      if (!result.ok) {
        const msg = 'message' in result ? result.message : 'No se pudo compartir el PDF.'
        setModalState({ visible: true, title: 'Aviso', message: msg, variant: 'warning', onConfirm: () => setModalState(null) })
      }
    } finally {
      setIsSharingPdf(false)
    }
  }, [vendedorSuccessVentaId])

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      {/* Header Observatorio Técnica */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 16,
        paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 20,
        paddingHorizontal: 24,
        backgroundColor: colors.bg,
        zIndex: 100,
      }}>
        <View style={{
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: colors.surface2,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <ForwardLogo size={24} showText={false} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 24, fontWeight: '900', color: colors.text, letterSpacing: -0.5 }}>
            {isEditing ? 'EDITAR VENTA' : 'NUEVA VENTA'}
          </Text>
          {isEditing && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: BRAND.blue }} />
              <Text style={{ fontSize: 9, fontWeight: '800', color: BRAND.blue, letterSpacing: 1.5 }}>
                {`REF: #${editId?.slice(0, 8)}`}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/ventas')} style={{ padding: 8, backgroundColor: colors.surface2, borderRadius: 20 }}>
          <X size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 px-4 py-4"
        contentContainerStyle={{ paddingBottom: 240, maxWidth: 600, width: '100%', alignSelf: 'center' }}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >

        {/* ── TIPO OPERACIÓN ───────────────────────────────────────── */}
        <Text style={{ color: colors.textDisabled, fontSize: 8, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12, marginLeft: 4 }}>
          TIPO DE OPERACIÓN
        </Text>
        <View style={{ backgroundColor: colors.surface2, flexDirection: 'row', borderRadius: 18, padding: 4, marginBottom: 24 }}>
          {([2, 1] as const).map(tipo => (
            <Pressable
              key={tipo}
              style={{ flex: 1, backgroundColor: tipoOperacion === tipo ? colors.primary : 'transparent', paddingVertical: 12, borderRadius: 14, alignItems: 'center', opacity: isEditing ? 0.5 : 1 }}
              onPress={() => !isEditing && setTipoOperacion(tipo)}
            >
              <Text style={{ fontWeight: '900', fontSize: tokens.typography.sm.size, textTransform: 'uppercase', letterSpacing: 1, color: tipoOperacion === tipo ? '#fff' : (isDark ? colors.textDisabled : colors.textMuted) }}>
                {tipo === 2 ? '📦 Pedido' : '📋 Presupuesto'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── CLIENTE ──────────────────────────────────────────────── */}
        <Text style={{ color: colors.textDisabled, fontSize: 8, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12, marginLeft: 4 }}>
          CLIENTE RECEPTOR
        </Text>
        <Pressable
          onPress={() => !isEditing && setShowClientModal(true)}
          style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 18, marginBottom: 28, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', opacity: isEditing ? 0.7 : 1 }}
        >
          {clienteSelected
            ? <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '900', fontSize: 15, textTransform: 'uppercase' }}>{clienteSelected.razonSocial}</Text>
                <Text style={{ color: colors.textDisabled, fontSize: 11, fontWeight: '700', marginTop: 4, fontFamily: 'Outfit_600SemiBold' }}>{isEditing ? 'No modificable durante edición' : `REF: ${clienteSelected.cuit}`}</Text>
              </View>
            : <Text style={{ color: colors.textDisabled, fontWeight: '700', fontSize: tokens.typography.base.size }}>SELECCIONAR CLIENTE...</Text>
          }
          {!isEditing && <ChevronDown size={18} color={colors.textDisabled} />}
        </Pressable>

        {/* ── MÉTODO DE ENTREGA ────────────────────────────────────── */}
        <Text style={{ color: colors.textDisabled, fontSize: 8, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12, marginLeft: 4 }}>
          MÉTODO DE ENTREGA
        </Text>
        {isVendedor ? (
          <View style={{
            backgroundColor: `${colors.primary}10`,
            borderRadius: 18,
            padding: 16,
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderWidth: 1,
            borderColor: `${colors.primary}30`,
          }}>
            <Text style={{ fontSize: 20 }}>🚚</Text>
            <View>
              <Text style={{ color: colors.primary, fontWeight: '800', fontSize: tokens.typography.base.size, fontFamily: Platform.OS === 'ios' ? 'Outfit' : 'sans-serif' }}>
                Envío a domicilio
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Outfit' : 'sans-serif' }}>
                Logística — método de entrega estándar
              </Text>
            </View>
          </View>
        ) : (
          <View style={{ backgroundColor: colors.surface2, flexDirection: 'row', borderRadius: 18, padding: 4, marginBottom: 12 }}>
            {([1, 2, 3] as const).map(m => (
              <Pressable
                key={m}
                style={{
                  flex: 1,
                  backgroundColor: metodoEntrega === m ? colors.primary : 'transparent',
                  paddingVertical: 12,
                  borderRadius: 14,
                  alignItems: 'center',
                  opacity: entregaInmediata ? 0.5 : 1,
                }}
                onPress={() => {
                  if (entregaInmediata) return // selector locked when venta directa is ON
                  setMetodoEntrega(m)
                  if (m === 2 && !fechaEntrega) {
                    setFechaEntrega(new Date())
                  }
                }}
              >
                <Text style={{ fontWeight: '900', fontSize: tokens.typography.xs.size, textTransform: 'uppercase', color: metodoEntrega === m ? '#fff' : (isDark ? colors.textDisabled : colors.textMuted) }}>
                  {m === 1 ? '🚚 Envío' : m === 2 ? '🏠 Retiro' : '📦 Expreso'}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* ── VENTA DIRECTA (entregaInmediata) toggle — cost roles only ── */}
        {!isVendedor && (
          <Pressable
            onPress={() => {
              const next = !entregaInmediata
              setEntregaInmediata(next)
              if (next) {
                // Force RetiroEnLocal when enabling counter-sale mode
                setMetodoEntrega(METODO_ENTREGA.RetiroEnLocal)
              } else {
                // Reset to Logística when disabling
                setMetodoEntrega(METODO_ENTREGA.Logistica)
              }
            }}
            style={{
              backgroundColor: entregaInmediata ? `${colors.success}15` : colors.surface,
              borderRadius: 18,
              padding: 16,
              marginBottom: 24,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderWidth: 1.5,
              borderColor: entregaInmediata ? colors.success : colors.border,
            }}
          >
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{
                color: entregaInmediata ? colors.success : colors.text,
                fontWeight: '800',
                fontSize: tokens.typography.base.size,
                fontFamily: Platform.OS === 'ios' ? 'Outfit' : 'sans-serif',
              }}>
                Venta directa (entrega en el acto)
              </Text>
              <Text style={{
                color: colors.textMuted,
                fontSize: 11,
                marginTop: 2,
                fontFamily: Platform.OS === 'ios' ? 'Outfit' : 'sans-serif',
              }}>
                {entregaInmediata
                  ? 'Forzado a Retiro · Sin productos sin stock'
                  : 'Mostrador — entrega inmediata al crear la venta'}
              </Text>
            </View>
            <View style={{
              width: 44,
              height: 26,
              borderRadius: 13,
              backgroundColor: entregaInmediata ? colors.success : colors.surface2,
              justifyContent: 'center',
              paddingHorizontal: 2,
            }}>
              <View style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: '#fff',
                alignSelf: entregaInmediata ? 'flex-end' : 'flex-start',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.2,
                shadowRadius: 2,
                elevation: 2,
              }} />
            </View>
          </Pressable>
        )}

        {/* ── FECHA DE ENTREGA ────────────────────────────────────── */}
        <Text style={{ color: colors.textDisabled, fontSize: 8, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12, marginLeft: 4 }}>
          FECHA DE ENTREGA (ESTIMADA)
        </Text>
        <Pressable
          onPress={openDatePicker}
          style={{ 
            backgroundColor: colors.surface, 
            borderRadius: 20, 
            padding: 18, 
            marginBottom: 28, 
            flexDirection: 'row', 
            alignItems: 'center', 
            borderWidth: 1, 
            borderColor: colors.border,
            gap: 12
          }}
        >
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '900', fontSize: 15, fontFamily: Platform.OS === 'ios' ? 'Outfit' : 'sans-serif' }}>
              {fechaEntrega ? fechaEntrega.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }) : 'SELECCIONAR FECHA...'}
            </Text>
            <Text style={{ color: colors.textDisabled, fontSize: 11, fontWeight: '700', marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Outfit' : 'sans-serif' }}>
              {fechaEntrega ? 'Toca para cambiar la fecha' : 'Opcional - Los domingos están bloqueados'}
            </Text>
          </View>
          <ChevronDown size={18} color={colors.textDisabled} />
        </Pressable>

        {showDatePicker && Platform.OS !== 'ios' && (
          <DateTimePicker
            value={fechaEntrega || new Date()}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={(event, selectedDate) => {
              setShowDatePicker(false)
              if (selectedDate) {
                if (!esFechaEntregaValida(selectedDate)) {
                  setModalState({
                    visible: true,
                    title: 'Día no laboral',
                    message: 'No se realizan entregas los domingos. Por favor seleccioná otro día.',
                    variant: 'warning',
                    onConfirm: () => setModalState(null)
                  })
                  return
                }
                setFechaEntrega(selectedDate)
              }
            }}
          />
        )}

        {Platform.OS === 'ios' && (
          <Modal
            visible={showDatePicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowDatePicker(false)}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
              <Pressable style={{ flex: 1 }} onPress={() => setShowDatePicker(false)} />
              <View style={{
                backgroundColor: colors.surface,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingBottom: insets.bottom > 0 ? insets.bottom : 24,
                ...tokens.shadows.lg,
              }}>
                {/* Header bar */}
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)} style={{ padding: 8 }}>
                    <Text style={{ color: colors.textMuted, fontSize: tokens.typography.md.size, fontWeight: '600', fontFamily: 'Outfit_600SemiBold' }}>Cancelar</Text>
                  </TouchableOpacity>
                  <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', fontFamily: 'Outfit_700Bold' }}>Fecha de Entrega</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowDatePicker(false)
                      if (!esFechaEntregaValida(tempFecha)) {
                        setModalState({
                          visible: true,
                          title: 'Día no laboral',
                          message: 'No se realizan entregas los domingos. Por favor seleccioná otro día.',
                          variant: 'warning',
                          onConfirm: () => setModalState(null)
                        })
                        return
                      }
                      setFechaEntrega(tempFecha)
                    }}
                    style={{ padding: 8 }}
                  >
                    <Text style={{ color: colors.primary, fontSize: tokens.typography.md.size, fontWeight: '700', fontFamily: 'Outfit_700Bold' }}>Aceptar</Text>
                  </TouchableOpacity>
                </View>

                {/* DatePicker Component */}
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <DateTimePicker
                    value={tempFecha}
                    mode="date"
                    display="spinner"
                    textColor={colors.text}
                    themeVariant={isDark ? 'dark' : 'light'}
                    minimumDate={new Date()}
                    onChange={(event, selectedDate) => {
                      if (selectedDate) {
                        setTempFecha(selectedDate)
                      }
                    }}
                    style={{ width: '100%', height: 216 }}
                  />
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* ── ARTÍCULOS ────────────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ color: colors.textDisabled, fontSize: 8, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2 }}>
            ARTÍCULOS ({detalles.length})
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowProductModal(true)}
            style={{ 
              backgroundColor: colors.primary, 
              flexDirection: 'row', 
              alignItems: 'center', 
              paddingHorizontal: 16, 
              paddingVertical: 10, 
              borderRadius: 14,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 4
            }}
          >
            <Plus size={16} color="#fff" strokeWidth={3} />
            <Text style={{ color: '#fff', fontWeight: '900', marginLeft: 6, fontSize: 11, letterSpacing: 0.5 }}>EXPLORAR CATÁLOGO</Text>
          </TouchableOpacity>
        </View>

        {detalles.length === 0 ? (
          <View style={{ backgroundColor: colors.surface2, borderStyle: 'dashed', borderWidth: 1, borderColor: colors.textDisabled + '40', borderRadius: 20, padding: 32, alignItems: 'center', marginBottom: 24 }}>
            <Tag size={36} color={colors.textDisabled} />
            <Text style={{ color: colors.textDisabled, textAlign: 'center', marginTop: 12, fontWeight: '500' }}>
              Tocá "Agregar" para seleccionar productos del catálogo
            </Text>
          </View>
        ) : (
          <View style={{ marginBottom: 16 }}>
            {detalles.map(d => {
              const imgUrl = getFullImageUrl(d.imageUrl)
              const lineTotal = calcLineTotal(d)
              // R5 — RED cart: per-line compound floor check, reactive to both discounts.
              // PR-2e-a: single server floor (precioMinimo) for all roles.
              const isFloorBroken = derivarFloorBroken({
                descItemPct: d.descuentoPorcentaje,
                descGeneralPct: descGeneral,
                precioVenta: d.precioUnitario,
                precioMinimo: d.precioMinimo,
              })
              // Effective per-unit price for CarritoSemaforo
              const precioEfectivo =
                d.precioUnitario *
                (1 - d.descuentoPorcentaje / 100) *
                (1 - descGeneral / 100)
              // Venta mínima: el carrito muestra la cantidad en UNIDADES; sube de a la fracción.
              const vm = d.ventaMinima > 1 ? d.ventaMinima : 1
              return (
                <View
                  key={d.productoId}
                  style={{
                    backgroundColor: isFloorBroken ? `${colors.danger}08` : colors.surface,
                    borderRadius: 20,
                    padding: 12,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: isFloorBroken ? `${colors.danger}40` : colors.border,
                    ...tokens.shadows.sm,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {imgUrl ? (
                      <ExpoImage
                        source={imgUrl}
                        style={{ width: 52, height: 52, borderRadius: 12, marginRight: 10 }}
                        contentFit="contain"
                      />
                    ) : (
                      <View style={{ width: 52, height: 52, borderRadius: 12, marginRight: 10, backgroundColor: colors.surface2, justifyContent: 'center', alignItems: 'center' }}>
                        <Tag size={22} color={colors.textDisabled} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15, fontFamily: Platform.OS === 'ios' ? 'Outfit' : 'sans-serif', lineHeight: 20 }} numberOfLines={2}>
                        {d.nombre}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 2, fontFamily: Platform.OS === 'ios' ? 'Outfit' : 'sans-serif' }}>
                        ${d.precioUnitario.toLocaleString('es-AR')} c/u
                      </Text>
                      {vm > 1 && (
                        <View style={{ alignSelf: 'flex-start', marginBottom: 2 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ backgroundColor: `${colors.warning}1f`, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                              <Text style={{ color: colors.warning, fontSize: tokens.typography.xs.size, fontWeight: '700' }}>{fraccionWord(d.fraccion)} · de a {vm}</Text>
                            </View>
                            <Pressable
                              onPress={() => { setInfoFraccionId(infoFraccionId === d.productoId ? null : d.productoId); safeHaptics.impact('light') }}
                              hitSlop={8}
                            >
                              <Info size={14} color={colors.warning} />
                            </Pressable>
                          </View>
                          {infoFraccionId === d.productoId && (
                            <View style={{ marginTop: 4, backgroundColor: colors.text, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, maxWidth: 230 }}>
                              <Text style={{ color: colors.bg, fontSize: 11, fontWeight: '600' }}>
                                Producto con fracción de {vm}. Se vende de a {vm} u. (1 {fraccionWord(d.fraccion)} = {vm} u).
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {isVendedor ? (
                          <>
                            <StockPill
                              label="Disponible"
                              value={d.stockReal - d.cantidad}
                              color={(d.stockReal - d.cantidad) < 0 ? colors.danger : colors.primary}
                              bgColor={(d.stockReal - d.cantidad) < 0 ? `${colors.danger}1f` : `${colors.primary}1f`}
                            />
                            <StockPill
                              label="Virtual"
                              value={d.stockVirtual}
                              color={colors.textMuted}
                              bgColor={`${colors.textMuted}1f`}
                            />
                          </>
                        ) : (
                          <>
                            <StockPill
                              label="🏢 Dep"
                              value={d.stockDeposito}
                              color={d.stockDeposito <= 0 ? colors.danger : colors.success}
                              bgColor={d.stockDeposito <= 0 ? `${colors.danger}1f` : `${colors.success}1f`}
                            />
                            <StockPill
                              label="🔒 Res"
                              value={d.stockReservado}
                              color={BRAND.blue}
                              bgColor={`${BRAND.blue}1f`}
                            />
                            <StockPill
                              label="🚚 Vir"
                              value={d.stockVirtual}
                              color={colors.textMuted}
                              bgColor={`${colors.textMuted}1f`}
                            />
                            <StockPill
                              label="✅ Real"
                              value={d.stockReal - d.cantidad}
                              color={(d.stockReal - d.cantidad) < 0 ? colors.danger : colors.success}
                              bgColor={(d.stockReal - d.cantidad) < 0 ? `${colors.danger}1f` : `${colors.success}1f`}
                            />
                          </>
                        )}
                      </View>
                    </View>
                    <Pressable onPress={() => removeDetalle(d.productoId)} style={{ backgroundColor: colors.danger + '1f', padding: 6, borderRadius: 8 }}>
                      <X size={16} color={colors.danger} />
                    </Pressable>
                  </View>

                  {/* CarritoSemaforo — profitability traffic-light (PR-2e-a); hidden for vendedor */}
                  {!isVendedor && (
                    <View style={{ marginTop: 8 }}>
                      <CarritoSemaforo
                        precioFinal={precioEfectivo}
                        precioMinimoRentable={d.precioMinimo}
                      />
                    </View>
                  )}

                  {/* Cantidad + per-item discount */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                    <View style={{ backgroundColor: colors.surface2, flexDirection: 'row', alignItems: 'center', borderRadius: 12 }}>
                      <Pressable
                        onPress={() => updateCantidad(d.productoId, -1)}
                        style={{ paddingHorizontal: 12, paddingVertical: 8 }}
                      >
                        <Minus size={16} color={colors.primary} />
                      </Pressable>
                      <TextInput
                        style={{ color: colors.text, fontWeight: '700', fontSize: tokens.typography.md.size, textAlign: 'center', minWidth: 40 }}
                        keyboardType="numeric"
                        // El input muestra UNIDADES (60, 120, 180…). Se escribe libre y al salir (blur)
                        // se ajusta al múltiplo de la fracción más cercano.
                        value={qtyDrafts[d.productoId] ?? String(d.cantidad)}
                        onChangeText={(v) => {
                          const clean = v.replace(/[^0-9]/g, '')
                          setQtyDrafts(prev => ({ ...prev, [d.productoId]: clean }))
                        }}
                        selectTextOnFocus
                        onBlur={() => {
                          const raw = parseInt(qtyDrafts[d.productoId] ?? '', 10)
                          const base = isNaN(raw) ? vm : Math.max(1, raw)
                          const snapped = vm > 1 ? Math.max(vm, Math.round(base / vm) * vm) : base
                          setExactCantidad(d.productoId, String(snapped))
                          setQtyDrafts(prev => {
                            const copy = { ...prev }
                            delete copy[d.productoId]
                            return copy
                          })
                        }}
                      />
                      <Pressable
                        onPress={() => updateCantidad(d.productoId, 1)}
                        style={{ paddingHorizontal: 12, paddingVertical: 8 }}
                      >
                        <Plus size={16} color={colors.primary} />
                      </Pressable>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {/* Per-item discount button */}
                      <Pressable
                        onPress={() => {
                          setDiscountModalItem({ productoId: d.productoId, nombre: d.nombre })
                          safeHaptics.impact('light')
                        }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 10,
                          backgroundColor: d.descuentoPorcentaje > 0
                            ? `${colors.warning}20`
                            : colors.surface2,
                          borderWidth: 1,
                          borderColor: d.descuentoPorcentaje > 0
                            ? `${colors.warning}60`
                            : colors.border,
                        }}
                      >
                        <Percent
                          size={12}
                          color={d.descuentoPorcentaje > 0 ? colors.warning : colors.textMuted}
                        />
                        <Text style={{
                          fontSize: 11,
                          fontWeight: '700',
                          fontFamily: 'Outfit_700Bold',
                          color: d.descuentoPorcentaje > 0 ? colors.warning : colors.textMuted,
                        }}>
                          {d.descuentoPorcentaje > 0 ? `${d.descuentoPorcentaje}%` : 'Desc.'}
                        </Text>
                      </Pressable>

                      <Text style={{ color: colors.primary, fontWeight: '700', fontSize: tokens.typography.md.size, fontFamily: 'Outfit_700Bold' }}>
                        ${lineTotal.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </Text>
                    </View>
                  </View>
                </View>
              )
            })}

            <GlassCard
              intensity={isDiscountFocused ? 25 : 15}
              style={{
                borderRadius: 24,
                padding: 18,
                marginTop: 12,
                marginBottom: 8,
                borderWidth: 1.5,
                borderColor: isDiscountFocused ? colors.primary : colors.border,
                shadowColor: isDiscountFocused ? colors.primary : '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isDiscountFocused ? 0.15 : 0.05,
                shadowRadius: 12,
                elevation: isDiscountFocused ? 4 : 2,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{
                    backgroundColor: descGeneral > 0 ? `${colors.warning}20` : colors.surface2,
                    padding: 8,
                    borderRadius: 12,
                  }}>
                    <Percent size={18} color={descGeneral > 0 ? colors.warning : colors.textMuted} />
                  </View>
                  <View style={{ flexShrink: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, fontFamily: 'Outfit_700Bold' }}>
                      Descuento General
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11, fontFamily: 'Outfit_500Medium', marginTop: 2 }}>
                      Aplicable a la orden entera
                    </Text>
                  </View>
                </View>

                <View style={{
                  backgroundColor: colors.surface2,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderRadius: 14,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderWidth: 1.5,
                  borderColor: isDiscountFocused ? colors.primary : colors.border,
                  minWidth: 80,
                  justifyContent: 'flex-end',
                }}>
                  <TextInput
                    style={{
                      color: colors.text,
                      fontWeight: '800',
                      fontSize: tokens.typography.md.size,
                      minWidth: 36,
                      paddingHorizontal: 2,
                      textAlign: 'right',
                      fontFamily: 'Outfit_700Bold',
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.textDisabled}
                    value={descuentoGeneral}
                    onChangeText={setDescuentoGeneral}
                    onFocus={() => setIsDiscountFocused(true)}
                    onBlur={() => setIsDiscountFocused(false)}
                    maxLength={3}
                  />
                  <Text style={{ color: colors.textMuted, marginLeft: 2, fontWeight: '800', fontFamily: 'Outfit_700Bold', fontSize: 15 }}>%</Text>
                </View>
              </View>

              {descGeneral > 0 && (
                <>
                  <View style={{
                    backgroundColor: `${colors.warning}12`,
                    borderRadius: 12,
                    padding: 10,
                    marginTop: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    borderWidth: 1,
                    borderColor: `${colors.warning}25`,
                  }}>
                    <Text style={{ color: colors.warning, fontSize: 13, fontWeight: '600', fontFamily: 'Outfit_600SemiBold', flex: 1 }}>
                      Ahorro de −${descGeneralMonto.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} aplicado
                    </Text>
                  </View>
                  {maxDescuentoVendedor > 0 && descGeneral > maxDescuentoVendedor && (
                    <View style={{
                      backgroundColor: `${colors.danger}12`,
                      borderRadius: 12,
                      padding: 10,
                      marginTop: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      borderWidth: 1,
                      borderColor: `${colors.danger}25`,
                    }}>
                      <AlertCircle size={14} color={colors.danger} />
                      <Text style={{ color: colors.danger, fontSize: tokens.typography.sm.size, fontWeight: '600', fontFamily: 'Outfit_600SemiBold', flex: 1 }}>
                        Tu tope es {maxDescuentoVendedor}%. No podés superar ese límite.
                      </Text>
                    </View>
                  )}
                </>
              )}
            </GlassCard>

              <GlassCard
                intensity={isFleteFocused ? 25 : 15}
                style={{
                  borderRadius: 24,
                  padding: 18,
                  marginTop: 12,
                  marginBottom: 8,
                  borderWidth: 1.5,
                  borderColor: isFleteFocused ? colors.primary : colors.border,
                  shadowColor: isFleteFocused ? colors.primary : '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: isFleteFocused ? 0.15 : 0.05,
                  shadowRadius: 12,
                  elevation: isFleteFocused ? 4 : 2,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <View style={{
                      backgroundColor: fleteMonto > 0 ? `${colors.primary}20` : colors.surface2,
                      padding: 8,
                      borderRadius: 12,
                    }}>
                      <Truck size={18} color={fleteMonto > 0 ? colors.primary : colors.textMuted} />
                    </View>
                    <View style={{ flexShrink: 1, flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, fontFamily: 'Outfit_700Bold' }}>
                          Cargo por Flete
                        </Text>
                        {metodoEntrega === 1 && !isFleteManual && (
                          <View style={{ backgroundColor: `${colors.primary}15`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ color: colors.primary, fontSize: 9, fontWeight: '800', fontFamily: 'Outfit_700Bold' }}>AUTO (5%)</Text>
                          </View>
                        )}
                        {isFleteManual && (
                          <TouchableOpacity 
                            onPress={() => {
                              setIsFleteManual(false)
                              safeHaptics.impact('light')
                            }}
                            style={{ backgroundColor: `${colors.warning}15`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}
                          >
                            <Text style={{ color: colors.warning, fontSize: 9, fontWeight: '800', fontFamily: 'Outfit_700Bold' }}>MANUAL ✕</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text style={{ color: colors.textMuted, fontSize: 11, fontFamily: 'Outfit_500Medium', marginTop: 2 }}>
                        {metodoEntrega === 1 ? 'Por defecto es el 5% de la orden' : 'Solo aplicable para envíos'}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={{
                    backgroundColor: colors.surface2,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderRadius: 14,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderWidth: 1.5,
                    borderColor: isFleteFocused ? colors.primary : colors.border,
                    minWidth: 100,
                    justifyContent: 'flex-end',
                  }}>
                    <Text style={{ color: colors.textMuted, marginRight: 2, fontWeight: '800', fontFamily: 'Outfit_700Bold', fontSize: 15 }}>$</Text>
                    <TextInput
                      style={{
                        color: colors.text,
                        fontWeight: '800',
                        fontSize: tokens.typography.md.size,
                        minWidth: 50,
                        paddingHorizontal: 2,
                        textAlign: 'right',
                        fontFamily: 'Outfit_700Bold',
                      }}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.textDisabled}
                      value={cargoFleteInput}
                      onChangeText={(val) => {
                        setCargoFleteInput(val)
                        setIsFleteManual(true)
                      }}
                      onFocus={() => setIsFleteFocused(true)}
                      onBlur={() => setIsFleteFocused(false)}
                      editable={metodoEntrega === 1}
                    />
                  </View>
                </View>
              </GlassCard>
            </View>
        )}
      </ScrollView>

      {/* ── FOOTER TOTAL + BOTÓN ──────────────────────────────────── */}
      <BlurView
        intensity={95}
        tint={isDark ? "dark" : "light"}
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          backgroundColor: isDark ? 'rgba(10,15,15,0.85)' : 'rgba(250,253,253,0.9)',
          paddingHorizontal: 24, paddingTop: 20, 
          paddingBottom: Math.max(insets.bottom, 16) + 12,
          borderTopWidth: 1.5, borderTopColor: colors.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        {/* Change 4 — vendedor: only total + confirm. Cost roles: full bar */}
        {isVendedor ? (
          <>
            {/* Vendedor: TOTAL only (large) */}
            <View style={{ alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ color: colors.textMuted, fontSize: tokens.typography.xs.size, fontWeight: '700', fontFamily: 'Outfit_600SemiBold', textTransform: 'uppercase', letterSpacing: 1.5 }}>TOTAL</Text>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.5}
                numberOfLines={1}
                style={{ color: colors.primary, fontSize: 36, fontWeight: '900', letterSpacing: -1, fontFamily: 'Outfit_900Black', marginTop: 2 }}
              >
                ${total.toLocaleString('es-AR')}
              </Text>
            </View>
            {/* Vendedor: CONFIRMAR VENTA only — no WhatsApp button */}
            <TouchableOpacity
              disabled={isPending || detalles.length === 0 || !clienteSelected}
              onPress={onSubmit}
              style={{
                height: 56, borderRadius: 16,
                backgroundColor: (detalles.length > 0 && clienteSelected) ? colors.primary : colors.surface2,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: (detalles.length > 0 && clienteSelected) ? 0.3 : 0,
                shadowRadius: 10,
                elevation: (detalles.length > 0 && clienteSelected) ? 5 : 0,
              }}
            >
              {isPending ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Check size={20} color="#fff" strokeWidth={3} />
                  <Text maxFontSizeMultiplier={1.3} style={{ color: (detalles.length > 0 && clienteSelected) ? '#fff' : colors.textDisabled, fontWeight: '900', fontSize: 15, fontFamily: 'Outfit_900Black', letterSpacing: 0.5 }}>
                    {isEditing ? 'GUARDAR CAMBIOS' : 'CONFIRMAR VENTA'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Cost roles: full expandable cart mini-list */}
            {detalles.length > 0 && cartExpanded && (
              <MotiView
                from={{ opacity: 0, translateY: 8 }}
                animate={{ opacity: 1, translateY: 0 }}
                exit={{ opacity: 0, translateY: 8 }}
                transition={{ type: 'timing', duration: 200 }}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  marginBottom: 12,
                  maxHeight: 200,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 12, gap: 8 }}>
                  {detalles.map(d => (
                    <View key={d.productoId} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: colors.text, fontSize: tokens.typography.sm.size, fontWeight: '700', flex: 1, marginRight: 8, fontFamily: 'Outfit_700Bold' }} numberOfLines={1}>{d.nombre}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 11, fontFamily: 'Outfit_500Medium' }}>×{d.cantidad}</Text>
                      <Text style={{ color: colors.primary, fontSize: tokens.typography.sm.size, fontWeight: '800', marginLeft: 8, fontFamily: 'Outfit_700Bold' }}>
                        ${calcLineTotal(d).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </MotiView>
            )}

            {/* Cost roles: items chip + BRUTO + FLETE + TOTAL row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 16 }}>
              <TouchableOpacity
                onPress={() => { setCartExpanded(e => !e); safeHaptics.impact('light') }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: detalles.length > 0 ? `${colors.primary}15` : colors.surface2,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: detalles.length > 0 ? `${colors.primary}30` : colors.border,
                }}
              >
                <Text style={{ color: detalles.length > 0 ? colors.primary : colors.textDisabled, fontSize: 11, fontWeight: '800', fontFamily: 'Outfit_700Bold' }}>
                  artículos ({detalles.length})
                </Text>
                <ChevronDown
                  size={12}
                  color={detalles.length > 0 ? colors.primary : colors.textDisabled}
                  style={{ transform: [{ rotate: cartExpanded ? '180deg' : '0deg' }] }}
                />
              </TouchableOpacity>

              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ color: colors.textMuted, fontSize: tokens.typography.xs.size, fontWeight: '700', fontFamily: 'Outfit_600SemiBold', textTransform: 'uppercase', letterSpacing: 1 }}>BRUTO</Text>
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  numberOfLines={1}
                  style={{ color: colors.text, fontSize: tokens.typography.md.size, fontWeight: '700', fontFamily: 'Outfit_700Bold', marginTop: 2 }}
                >
                  ${(subtotalSinDesc - descGeneralMonto).toLocaleString('es-AR')}
                </Text>
              </View>
              {fleteMonto > 0 && (
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: colors.textMuted, fontSize: tokens.typography.xs.size, fontWeight: '700', fontFamily: 'Outfit_600SemiBold', textTransform: 'uppercase', letterSpacing: 1 }}>FLETE</Text>
                  <Text
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    numberOfLines={1}
                    style={{ color: colors.text, fontSize: tokens.typography.md.size, fontWeight: '700', fontFamily: 'Outfit_700Bold', marginTop: 2 }}
                  >
                    +${fleteMonto.toLocaleString('es-AR')}
                  </Text>
                </View>
              )}
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.textMuted, fontSize: tokens.typography.xs.size, fontWeight: '700', fontFamily: 'Outfit_600SemiBold', textTransform: 'uppercase', letterSpacing: 1 }}>TOTAL</Text>
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.55}
                  numberOfLines={1}
                  style={{ color: colors.primary, fontSize: 28, fontWeight: '900', letterSpacing: -0.5, fontFamily: 'Outfit_900Black', marginTop: 2 }}
                >
                  ${total.toLocaleString('es-AR')}
                </Text>
              </View>
            </View>

            {/* Cost roles: confirm + WhatsApp */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                disabled={isPending || detalles.length === 0 || !clienteSelected}
                onPress={onSubmit}
                style={{
                  flex: 1, height: 56, borderRadius: 16,
                  backgroundColor: (detalles.length > 0 && clienteSelected) ? colors.primary : colors.surface2,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: (detalles.length > 0 && clienteSelected) ? 0.3 : 0,
                  shadowRadius: 10,
                  elevation: (detalles.length > 0 && clienteSelected) ? 5 : 0
                }}
              >
                {isPending ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Check size={20} color="#fff" strokeWidth={3} />
                    <Text maxFontSizeMultiplier={1.3} style={{ color: (detalles.length > 0 && clienteSelected) ? '#fff' : colors.textDisabled, fontWeight: '900', fontSize: 15, fontFamily: 'Outfit_900Black', letterSpacing: 0.5 }}>
                      {isEditing ? 'GUARDAR CAMBIOS' : entregaInmediata ? 'VENTA DIRECTA' : (tipoOperacion === 1 ? 'GUARDAR PRESUPUESTO' : 'CONFIRMAR VENTA')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {detalles.length > 0 && clienteSelected && (
                <TouchableOpacity
                  onPress={shareToWhatsApp}
                  style={{
                    width: 56, height: 56, borderRadius: 16, backgroundColor: '#25D366',
                    alignItems: 'center', justifyContent: 'center',
                    shadowColor: '#25D366', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5
                  }}
                >
                  <MessageSquare size={22} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </BlurView>

      {/* ═══════════════════════════════════════════════════════════
          MODAL: SELECTOR DE CLIENTES
      ═══════════════════════════════════════════════════════════ */}
      <Modal visible={showClientModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ backgroundColor: colors.bg, flex: 1 }}>
          <View style={{ backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 24, paddingBottom: 16, justifyContent: 'space-between' }}>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>Seleccionar Cliente</Text>
            <Pressable onPress={() => setShowClientModal(false)} style={{ padding: 8 }}>
              <X size={22} color={colors.textDisabled} />
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
            <View style={{ backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border }}>
              <Search size={16} color={colors.textDisabled} />
              <TextInput
                style={{ color: colors.text, flex: 1, paddingVertical: 12, marginLeft: 8 }}
                placeholder="Buscar cliente..."
                placeholderTextColor={colors.textDisabled}
                value={clientSearch}
                onChangeText={setClientSearch}
              />
            </View>
          </View>

          <FlatList
            data={clientesFiltrados}
            keyExtractor={item => item.id ?? ''}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
            ListEmptyComponent={() => (
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <Text style={{ color: colors.textDisabled, fontSize: tokens.typography.base.size, fontWeight: '700' }}>
                  {clientSearch ? 'No se encontraron clientes' : 'No hay clientes activos'}
                </Text>
              </View>
            )}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => { setClienteSelected(item); setShowClientModal(false) }}
                style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 16, marginBottom: 8, borderWidth: 2, borderColor: clienteSelected?.id === item.id ? colors.primary : 'transparent' }}
              >
                <Text style={{ color: colors.text, fontWeight: '900', fontSize: 15 }}>{item.razonSocial}</Text>
                <Text style={{ color: colors.textDisabled, fontSize: 11, marginTop: 4, fontFamily: 'Outfit_600SemiBold' }}>CUIT: {item.cuit}</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════
          MODAL: CATÁLOGO DE PRODUCTOS
      ═══════════════════════════════════════════════════════════ */}
      <Modal visible={showProductModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ backgroundColor: colors.bg, flex: 1 }}>
          <View style={{ backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 24, paddingBottom: 16, justifyContent: 'space-between' }}>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>Catálogo de Productos</Text>
            <Pressable onPress={() => setShowProductModal(false)} style={{ padding: 8 }}>
              <X size={22} color={colors.textDisabled} />
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
            <View style={{ backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border }}>
              <Search size={16} color={colors.textDisabled} />
              <TextInput
                style={{ color: colors.text, flex: 1, paddingVertical: 12, marginLeft: 8 }}
                placeholder="Buscar producto..."
                placeholderTextColor={colors.textDisabled}
                value={productSearch}
                onChangeText={setProductSearch}
              />
            </View>
          </View>

          <FlatList
            data={productosFiltrados}
            keyExtractor={item => item.id ?? ''}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }}
            renderItem={({ item }) => {
              const det = detalles.find(d => d.productoId === item.id)
              const stockDisponible = (item.real ?? 0) - (item.reservado ?? 0)
              const addable = isProductAddable(entregaInmediata, stockDisponible)
              return (
                <View style={{ opacity: addable ? 1 : 0.4 }} pointerEvents={addable ? 'auto' : 'none'}>
                  {entregaInmediata && !addable && (
                    <Text style={{
                      color: colors.danger,
                      fontSize: tokens.typography.xs.size,
                      fontWeight: '700',
                      marginBottom: 4,
                      marginLeft: 4,
                      fontFamily: Platform.OS === 'ios' ? 'Outfit' : 'sans-serif',
                    }}>
                      Sin stock — venta directa
                    </Text>
                  )}
                  <ProductCatalogItem
                    item={item}
                    cartQuantity={det?.cantidad || 0}
                    originalQuantity={det?.originalQuantity || 0}
                    onUpdate={addable ? setProductoCantidad : () => {}}
                    onDiscountChange={applyInlineCatalogDiscount}
                    cartDiscount={det?.descuentoPorcentaje || 0}
                    userRoles={userRoles}
                    maxDescuento={maxDescuentoVendedor}
                  />
                </View>
              )
            }}
          />
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════
          MODAL DE CONFIRMACIÓN / ALERTAS
      ═══════════════════════════════════════════════════════════ */}
      {modalState && (
        <ConfirmModal
          visible={modalState.visible}
          title={modalState.title}
          message={modalState.message}
          variant={modalState.variant}
          confirmLabel="Aceptar"
          onConfirm={modalState.onConfirm}
          onCancel={undefined as any}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════
          MODAL: DESCUENTO POR ÍTEM
      ═══════════════════════════════════════════════════════════ */}
      {discountModalItem && (() => {
        const item = detalles.find(d => d.productoId === discountModalItem.productoId)
        if (!item) return null
        return (
          <DescuentoItemModalRN
            key={discountModalItem.productoId}
            visible={true}
            productoNombre={discountModalItem.nombre}
            currentDescuento={item.descuentoPorcentaje}
            precioVenta={item.precioUnitario}
            precioCompraBase={item.precioCompraBase}
            margenGlobal={margenGlobal}
            precioMinimo={item.precioMinimo}
            descuentoGeneral={descGeneral}
            maxDescuentoVendedor={maxDescuentoVendedor}
            userRoles={userRoles}
            stockReal={item.stockReal}
            stockReservado={item.stockReservado}
            cantidad={item.cantidad}
            onApply={(pct) => applyItemDescuento(discountModalItem.productoId, pct)}
            onClose={() => setDiscountModalItem(null)}
          />
        )
      })()}

      {/* ═══════════════════════════════════════════════════════════
          MODAL: MOTIVO VENTA SIN STOCK
      ═══════════════════════════════════════════════════════════ */}
      <Modal visible={showMotivoModal} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <View style={{ margin: 24, backgroundColor: colors.surface, borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.warning + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <MessageSquare size={24} color={colors.warning} />
            </View>
            <Text style={{ color: colors.text, fontSize: tokens.typography.lg.size, fontWeight: '900', marginBottom: 8 }}>Venta sin Stock Suficiente</Text>
            <Text style={{ color: colors.textMuted, fontSize: tokens.typography.base.size, marginBottom: 20 }}>
              Estás registrando {tipoOperacion === 1 ? 'un presupuesto' : 'un pedido'} con artículos cuya cantidad supera el stock físico disponible. Ingresá un motivo para autorizar la operación.
            </Text>
            
            <TextInput
              style={{ backgroundColor: colors.surface2, color: colors.text, borderRadius: 16, padding: 16, fontSize: tokens.typography.md.size, minHeight: 100, textAlignVertical: 'top' }}
              placeholder="Ej: Autorizado por gerencia, stock entrando mañana..."
              placeholderTextColor={colors.textDisabled}
              value={motivo}
              onChangeText={setMotivo}
              multiline
            />

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <TouchableOpacity
                onPress={() => setShowMotivoModal(false)}
                style={{ flex: 1, padding: 16, borderRadius: 16, backgroundColor: colors.surface2, alignItems: 'center' }}
              >
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={!motivo.trim()}
                onPress={() => {
                  setShowMotivoModal(false)
                  onSubmit()
                }}
                style={{ flex: 1, padding: 16, borderRadius: 16, backgroundColor: motivo.trim() ? colors.warning : colors.surface2, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>Continuar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════
          Change 5 — VENDEDOR SUCCESS OVERLAY (Pedido confirmado + PDF)
      ═══════════════════════════════════════════════════════════ */}
      <Modal visible={vendedorSuccessVentaId !== null} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <MotiView
            from={{ opacity: 0, scale: 0.92, translateY: 24 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 18, stiffness: 200 }}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 28,
              padding: 28,
              width: '100%',
              maxWidth: 400,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.35,
              shadowRadius: 24,
              elevation: 16,
            }}
          >
            {/* Success icon */}
            <View style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: `${colors.success}20`,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
              borderWidth: 2,
              borderColor: `${colors.success}40`,
            }}>
              <Check size={36} color={colors.success} strokeWidth={2.5} />
            </View>

            <Text style={{ color: colors.text, fontSize: tokens.typography.xl.size, fontWeight: '900', fontFamily: 'Outfit_900Black', textAlign: 'center', marginBottom: 8 }}>
              Venta confirmada
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: tokens.typography.base.size, fontFamily: 'Outfit_500Medium', textAlign: 'center', marginBottom: 28, lineHeight: 20 }}>
              El pedido fue registrado exitosamente. Podés enviarle la nota al cliente ahora.
            </Text>

            {/* PDF share button */}
            <TouchableOpacity
              onPress={handleShareNotaPdf}
              disabled={isSharingPdf}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                width: '100%',
                paddingVertical: 16,
                borderRadius: 16,
                backgroundColor: colors.primary,
                marginBottom: 12,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3,
                shadowRadius: 10,
                elevation: 5,
                opacity: isSharingPdf ? 0.7 : 1,
              }}
            >
              {isSharingPdf
                ? <ActivityIndicator color="#fff" size="small" />
                : (
                  <>
                    <Text style={{ fontSize: tokens.typography.lg.size }}>📄</Text>
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15, fontFamily: 'Outfit_900Black', letterSpacing: 0.3 }}>
                      Enviar nota al cliente
                    </Text>
                  </>
                )
              }
            </TouchableOpacity>

            {/* Close / Listo button */}
            <TouchableOpacity
              onPress={handleVendedorSuccessClose}
              style={{
                width: '100%',
                paddingVertical: 14,
                borderRadius: 16,
                backgroundColor: colors.surface2,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.textMuted, fontWeight: '800', fontSize: 15, fontFamily: 'Outfit_700Bold' }}>
                Listo
              </Text>
            </TouchableOpacity>
          </MotiView>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  )
}
