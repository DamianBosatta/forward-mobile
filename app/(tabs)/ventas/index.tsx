import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator
} from 'react-native'
import { useRouter, useNavigation } from 'expo-router'
import { DrawerActions } from '@react-navigation/native';
import * as Haptics from 'expo-haptics'
import { safeHaptics } from '@/core/utils/haptics'
import React from 'react'

import type { Venta } from '@/libs/api-client'
import {
  Calendar, Package,
  ChevronRight, ChevronLeft,
  X, Clock, ShieldCheck,
  Plus,
  Search as SearchIcon,
  FileText
} from 'lucide-react-native'
import { ForwardLogo, TopHeaderActions, RequirePermission, GlassCard, AuroraGlow, SegmentedControl } from '@/core/ui'
import { useColors, useIsDark, BRAND } from '@/libs/theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useState, useMemo, useCallback } from 'react'
import { BlurView } from 'expo-blur'
import { MotiView } from 'moti'
import { useVentasList, SelectedMonth } from '@/features/ventas/hooks/useVentasList'
import { getVentaStatusConfig } from '@/core/constants/status'
import { getNotaEntregaUrl } from '@/libs/api-client'
import { sharePdf } from '@/features/pedidos/lib/sharePdf'
import { PremiumInput } from '@/core/ui/PremiumInput'
import { VentasKpiGrid } from '@/features/ventas/components/VentasKpiGrid'
import { DataList } from '@/core/ui/DataList'
import { VentaCardSkeleton } from '@/features/ventas/components/VentaCardSkeleton'
import { useResponsive } from '@/libs/useResponsive'

// ── Constants ──────────────────────────────────────────────────────────────────
const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatMoney(val: number) {
  return `$ ${val.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// ── MonthPicker ──────────────────────────────────────────────────────────
function MonthPicker({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean
  selected: SelectedMonth
  onSelect: (m: SelectedMonth) => void
  onClose: () => void
}) {
  const colors = useColors()
  const isDark = useIsDark()
  const { width } = useResponsive()
  const now    = new Date()
  const [pickerYear, setPickerYear] = useState(selected.year)

  const canGoNext = pickerYear < now.getFullYear()

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(15, 23, 42, 0.4)',
          justifyContent: 'center', alignItems: 'center',
        }}
      >
        <Pressable onPress={(e) => e.stopPropagation()}>
          <MotiView
            from={{ opacity: 0, scale: 0.9, translateY: 20 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            style={{ width: width * 0.9, maxWidth: 360 }}
          >
            <GlassCard 
              intensity={isDark ? 40 : 80}
              style={{
                borderRadius: 32,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.8)',
              }}
            >
              <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                padding: 24, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${colors.primary}20`, alignItems: 'center', justifyContent: 'center' }}>
                    <Calendar size={20} color={colors.primary} />
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text, fontFamily: 'Outfit_900Black' }}>Periodo</Text>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={{ padding: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <TouchableOpacity
                    onPress={() => setPickerYear(y => y - 1)}
                    style={[styles.yearArrow, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}
                  >
                    <ChevronLeft size={20} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={{ fontSize: 28, fontWeight: '900', color: colors.text, fontFamily: 'Outfit_900Black' }}>{pickerYear}</Text>
                  <TouchableOpacity
                    onPress={() => canGoNext && setPickerYear(y => y + 1)}
                    disabled={!canGoNext}
                    style={[
                      styles.yearArrow, 
                      { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' },
                      !canGoNext && { opacity: 0.2 }
                    ]}
                  >
                    <ChevronRight size={20} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                  {MONTHS_SHORT.map((m, mi) => {
                    const isSelected = selected.month === mi && selected.year === pickerYear
                    const isToday    = mi === now.getMonth() && pickerYear === now.getFullYear()
                    const isFuture   = pickerYear === now.getFullYear() && mi > now.getMonth()

                    return (
                      <TouchableOpacity
                        key={mi}
                        disabled={isFuture}
                        onPress={() => { onSelect({ year: pickerYear, month: mi }); onClose(); }}
                        style={{
                          width: '22%', height: 50, borderRadius: 14,
                          alignItems: 'center', justifyContent: 'center',
                          backgroundColor: isSelected ? colors.primary : isToday ? `${colors.primary}15` : isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                          borderWidth: isToday && !isSelected ? 1 : 0,
                          borderColor: colors.primary,
                          opacity: isFuture ? 0.2 : 1
                        }}
                      >
                        <Text style={{
                          fontSize: 12, fontWeight: '900', 
                          color: isSelected ? (isDark ? '#000' : '#fff') : isToday ? colors.primary : colors.text,
                          fontFamily: 'Outfit_900Black'
                        }}>
                          {m}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            </GlassCard>
          </MotiView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ── VentaCard Premium ──────────────────────────────────────────────────────────
const VentaCard = React.memo(({ item, index }: { item: Venta, index: number }) => {
  const colors     = useColors()
  const isDark     = useIsDark()
  const router     = useRouter()
  const status     = getVentaStatusConfig(item.estado, colors)
  const StatusIcon = status.Icon
  const clientName = (item as any).razonSocialCliente || (item as any).cliente || 'CLIENTE FINAL'
  const ticketId   = (item.id ?? '').slice(0,8).toUpperCase()
  const itemCount  = item.itemsCount ?? (item as any).ItemsCount ?? 0
  const deliveryDate = (item as any).fechaEntrega || item.fecha

  // Share the order note (nota de pedido) PDF so the vendedor can send it to the client.
  const [notaLoading, setNotaLoading] = useState(false)
  const handleSharePedido = useCallback(async () => {
    if (notaLoading || !item.id || item.estado === 'Anulada') return
    safeHaptics.impact('light')
    setNotaLoading(true)
    const res = await sharePdf(getNotaEntregaUrl(item.id), `nota-pedido-${(item.id).slice(0, 8)}.pdf`)
    setNotaLoading(false)
    // sharePdf never throws; it surfaces its own errors via the share sheet / no-op.
    void res
  }, [notaLoading, item.id, item.estado])

  return (
    <MotiView 
      from={{ opacity: 0, scale: 0.95, translateY: 20 }} 
      animate={{ opacity: 1, scale: 1, translateY: 0 }} 
      transition={{ type: 'spring', delay: Math.min(index * 30, 300) }}
    >
      <Pressable
        onPress={() => {
          Haptics.selectionAsync()
          router.push(`/(tabs)/ventas/${item.id}`)
        }}
        style={({ pressed }) => ({
          marginHorizontal: 16, 
          marginBottom: 12,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        })}
      >
        <GlassCard 
          intensity={8} 
          style={{ 
            borderRadius: 32,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
            overflow: 'hidden',
          }}
        >
          <View style={{ padding: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={[styles.cardClientName, { color: colors.text, fontFamily: 'Outfit_800ExtraBold', lineHeight: 22 }]} numberOfLines={2}>
                  {clientName}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  <View style={[styles.cardIdBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                    <Text style={[styles.cardIdText, { color: colors.textMuted }]}>#{ticketId}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Package size={12} color={colors.textMuted} />
                    <Text style={[styles.cardItemsText, { color: colors.textMuted }]}>{itemCount} bultos</Text>
                  </View>
                </View>
              </View>
              <View style={[styles.cardStatusBadge, { backgroundColor: status.bg, borderColor: `${status.color}30` }]}>
                <StatusIcon size={12} color={status.color} strokeWidth={3} />
                <Text style={[styles.cardStatusText, { color: status.color }]}>
                  {status.label}
                </Text>
              </View>
            </View>

            <View style={[styles.cardAmountBox, {
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
              borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
            }]}>
              <View>
                <Text style={[styles.cardAmountLabel, { color: colors.textMuted }]}>Importe Total</Text>
                <Text style={[styles.cardAmountValue, { color: colors.text }]}>
                  {formatMoney(item.totalAmount ?? 0)}
                </Text>
              </View>
              <View style={[styles.cardArrowCircle, { backgroundColor: `${colors.primary}10` }]}>
                <ChevronRight size={20} color={colors.primary} strokeWidth={3} />
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', marginVertical: 14 }} />

            <View style={[styles.cardFooter, { marginTop: 0 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Clock size={14} color={colors.textMuted} />
                <Text style={[styles.cardFooterDate, { color: colors.textMuted }]}>
                  Entrega: {new Date(deliveryDate).toLocaleDateString('es-AR')}
                </Text>
              </View>
              {item.estado !== 'Anulada' && (
                <Pressable
                  onPress={handleSharePedido}
                  disabled={notaLoading}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 10,
                    backgroundColor: `${colors.primary}12`,
                    borderWidth: 1,
                    borderColor: `${colors.primary}25`,
                  }}
                >
                  {notaLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <FileText size={13} color={colors.primary} />
                      <Text style={{ fontSize: 11, color: colors.primary, fontFamily: 'Outfit_800ExtraBold', letterSpacing: 0.3 }}>Nota PDF</Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          </View>
        </GlassCard>
      </Pressable>
    </MotiView>
  )
})

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function VentasListScreen() {
  const navigation = useNavigation();
  const colors = useColors()
  const isDark = useIsDark()
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const [isSearchFocused, setIsSearchFocused] = useState(false)

  const {
    searchTerm, setSearchTerm,
    filter, setFilter,
    pickerOpen, setPickerOpen,
    selected, setSelected,
    tipoOperacion, setTipoOperacion,
    isLoading, isRefetching, refetch,
    filteredVentas,
    totalMonto, pendCount, ordersCount,
    fetchNextPage, hasNextPage, isFetchingNextPage
  } = useVentasList()

  const activeFilters: ('Todas' | 'Pendiente' | 'Confirmada' | 'Preparando' | 'En Ruta' | 'Entregada' | 'Anulada' | 'Por Autorizar')[] = ['Todas', 'Pendiente', 'Confirmada', 'Preparando', 'En Ruta', 'Entregada', 'Anulada', 'Por Autorizar']

  const renderItem = useCallback(({ item, index }: { item: Venta, index: number }) => (
    <VentaCard item={item} index={index} />
  ), [])

  const headerComponent = useMemo(() => (
    <View style={{ paddingBottom: 10 }}>
      <VentasKpiGrid
        ordersCount={ordersCount}
        pendCount={pendCount}
        totalMonto={totalMonto}
        currentMonth={MONTHS_SHORT[selected.month]}
      />

      <View style={{ marginTop: 20 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 10 }}
        >
          {activeFilters.map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => { Haptics.selectionAsync(); setFilter(f); }}
              style={[
                styles.filterChip,
                { 
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', 
                  borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)' 
                },
                filter === f && { backgroundColor: colors.primary, borderColor: colors.primary }
              ]}
            >
              <Text style={[
                styles.filterChipText, 
                { color: isDark ? '#a3a3a3' : '#475569' },
                filter === f && { color: isDark ? '#000' : '#fff' }
              ]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  ), [ordersCount, pendCount, totalMonto, selected, filter, colors.primary, isDark])

  return (
    <RequirePermission module={["MOD_VENTAS", "MOD_PEDIDOS"]} action="read" mode="screen">
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <AuroraGlow color={isDark ? colors.primary : '#00b4a2'} opacity={0.15} />

        <View style={{ zIndex: 1000 }}>
          <BlurView intensity={25} tint={isDark ? "dark" : "light"} style={{ paddingTop: insets.top + 10, paddingBottom: 15 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => { safeHaptics.impact('light'); navigation.dispatch(DrawerActions.openDrawer()); }}
                  style={[styles.premiumBrandCircle, {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
                  }]}
                >
                  <ForwardLogo size={32} showText={false} />
                </TouchableOpacity>
                <View>
                  <Text style={[styles.headerTitle, { color: colors.text }]}>VENTAS</Text>
                </View>
              </View>
              <TopHeaderActions />
            </View>

            <View style={{ paddingHorizontal: 20, gap: 12 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <PremiumInput
                  label="Buscador"
                  placeholder="Buscar cliente, nro..."
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  hideLabel
                  variant="search"
                  icon={<SearchIcon size={18} color={isSearchFocused ? colors.primary : colors.textMuted} />}
                  containerStyle={{ flex: 1 }}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                />
                
                <TouchableOpacity
                  onPress={() => setPickerOpen(true)}
                  style={[styles.periodButton, {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
                  }]}
                >
                  <Calendar size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <View style={{ marginTop: 8 }}>
                <SegmentedControl
                  options={[
                    { label: 'PEDIDOS', value: 2 },
                    { label: 'PRESUPUESTOS', value: 1 }
                  ]}
                  value={tipoOperacion}
                  onChange={(val) => {
                    Haptics.selectionAsync();
                    setTipoOperacion(val);
                  }}
                />
              </View>
            </View>
          </BlurView>
        </View>

        <View style={{ flex: 1 }}>
          <DataList
            data={filteredVentas}
            renderItem={renderItem}
            estimatedItemSize={200}
            ListHeaderComponent={headerComponent}
            contentContainerStyle={{ paddingTop: 10, paddingBottom: 150, maxWidth: 1100, width: '100%', alignSelf: 'center' }}
            isLoading={isLoading}
            isRefetching={isRefetching}
            onRefresh={refetch}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) {
                fetchNextPage()
              }
            }}
            isFetchingNextPage={isFetchingNextPage}
            SkeletonComponent={VentaCardSkeleton}
            skeletonCount={5}
            emptyMessage="No hay operaciones registradas para este periodo o filtro."
          />
        </View>

        <RequirePermission module="MOD_VENTAS" action="create">
          <MotiView
            from={{ scale: 0, opacity: 0, translateY: 50 }} 
            animate={{ scale: 1, opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 15, delay: 500 }}
            style={{ position: 'absolute', bottom: insets.bottom + 20, right: 24 }}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => { safeHaptics.impact('medium'); router.push('/(tabs)/ventas/nueva'); }}
              style={[styles.fab, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
            >
              <Plus size={32} color={isDark ? '#000' : '#fff'} strokeWidth={3} />
            </TouchableOpacity>
          </MotiView>
        </RequirePermission>

        <MonthPicker
          visible={pickerOpen}
          selected={selected}
          onSelect={setSelected}
          onClose={() => setPickerOpen(false)}
        />
      </View>
    </RequirePermission>
  )
}

const styles = StyleSheet.create({
  headerTitle: { 
    fontSize: 24, fontWeight: '900', color: '#fff', 
    fontFamily: 'Outfit_900Black', letterSpacing: -1 
  },
  premiumBrandCircle: { 
    width: 52, height: 52, borderRadius: 18, 
    alignItems: 'center', justifyContent: 'center', 
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: { width: 5, height: 5, borderRadius: 2.5 },
  statusText: { fontSize: 8, fontWeight: '900', letterSpacing: 1.2, fontFamily: 'Outfit_900Black' },
  
  periodButton: {
    width: 54, height: 54, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)'
  },

  filterChip: {
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    marginRight: 8
  },
  filterChipText: { color: '#a3a3a3', fontWeight: '900', fontSize: 11, fontFamily: 'Outfit_900Black' },
  
  cardClientName: { fontSize: 18, fontWeight: '900', color: '#fff', fontFamily: 'Outfit_900Black' },
  cardIdBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.06)' },
  cardIdText: { fontSize: 10, color: '#a3a3a3', fontWeight: '800', letterSpacing: 0.5 },
  cardItemsText: { fontSize: 10, color: '#737373', fontWeight: '700' },
  cardStatusBadge: { 
    flexDirection: 'row', alignItems: 'center', gap: 6, 
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1
  },
  cardStatusText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', fontFamily: 'Outfit_900Black' },
  cardAmountBox: { 
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 24, 
    padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)'
  },
  cardAmountLabel: { fontSize: 10, fontWeight: '800', color: '#737373', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  cardAmountValue: { fontSize: 24, fontWeight: '900', color: '#fff', fontFamily: 'Outfit_900Black', letterSpacing: -0.5 },
  cardArrowCircle: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  cardFooterDate: { fontSize: 11, color: '#a3a3a3', fontWeight: '700', fontFamily: 'Outfit_700Bold' },

  fab: {
    width: 68, height: 68, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 16,
    elevation: 8
  },
  yearArrow: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center'
  }
})
