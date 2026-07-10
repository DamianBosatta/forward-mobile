import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Platform,
  TextInput
} from 'react-native'
import { useRouter , useNavigation } from 'expo-router'
import { DrawerActions } from '@react-navigation/native';
import * as Haptics from 'expo-haptics'
import React, { useState, useMemo, useCallback } from 'react'

import type { CompraDtoList } from '@/libs/api-client'
import {
  ShoppingBag,
  Plus,
  Search,
  Calendar,
  Package,
  DollarSign,
  ChevronRight,
  TrendingUp,
  ChevronLeft,
  ChevronDown,
  X
} from 'lucide-react-native'
import { ForwardLogo, TopHeaderActions, RequirePermission, GlassCard, KpiStatRow } from '@/core/ui'
import { useColors, useIsDark, BRAND, tokens } from '@/libs/theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { MotiView } from 'moti'
import { useComprasList } from '@/features/compras/hooks/useComprasList'
import { getCompraStatusConfig } from '@/core/constants/status_compras'
import { formatToLocalDate } from '@/src/utils/date'
import { DataList } from '@/core/ui/DataList'
import { CompraCardSkeleton } from '@/features/compras/components/CompraCardSkeleton'

// ── Constants ──────────────────────────────────────────────────────────────────
const MONTHS_ES    = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatMoney(val: number) {
  return `$\u00a0${val.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
}

type SelectedMonth = { year: number; month: number }

// ── Inline Month Picker ───────────────────────────────────────────
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
  const now    = new Date()
  const [pickerYear, setPickerYear] = useState(selected.year)

  if (!visible) return null
  const canGoNext = pickerYear < now.getFullYear()

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center', alignItems: 'center',
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            width: '92%',
            maxWidth: 360,
            backgroundColor: colors.surface,
            borderRadius: 28,
            overflow: 'hidden',
            elevation: 24,
          }}
        >
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 18, paddingVertical: 16,
            backgroundColor: colors.surface2,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: `${colors.primary}18`, alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={17} color={colors.primary} />
              </View>
              <Text style={{ fontSize: tokens.typography.md.size, fontWeight: '900', color: colors.text }}>Seleccionar Mes</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={15} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 18 }}>
            <TouchableOpacity
              onPress={() => setPickerYear(y => y - 1)}
              style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronLeft size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={{ fontSize: 24, fontWeight: '900', color: colors.text, letterSpacing: -0.5 }}>{pickerYear}</Text>
            <TouchableOpacity
              onPress={() => canGoNext && setPickerYear(y => y + 1)}
              style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: canGoNext ? colors.surface2 : 'transparent', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronRight size={20} color={canGoNext ? colors.text : 'transparent'} />
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>
            {[0, 1, 2].map(row => (
              <View key={row} style={{ flexDirection: 'row', gap: 10 }}>
                {[0, 1, 2, 3].map(col => {
                  const mi = row * 4 + col
                  const isSelected = selected.month === mi && selected.year === pickerYear
                  const isToday = mi === now.getMonth() && pickerYear === now.getFullYear()
                  const isFuture = pickerYear === now.getFullYear() && mi > now.getMonth()

                  return (
                    <TouchableOpacity
                      key={mi}
                      disabled={isFuture}
                      onPress={() => { onSelect({ year: pickerYear, month: mi }); onClose(); }}
                      style={{
                        flex: 1, paddingVertical: 14, borderRadius: 16,
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: isSelected ? colors.primary : isToday ? `${colors.primary}1A` : colors.surface2,
                        borderWidth: isToday && !isSelected ? 1.5 : 0,
                        borderColor: colors.primary,
                        opacity: isFuture ? 0.22 : 1,
                      }}
                    >
                      <Text style={{ fontSize: tokens.typography.sm.size, fontWeight: '900', textTransform: 'uppercase', color: isSelected ? '#fff' : isToday ? colors.primary : colors.text }}>
                        {MONTHS_SHORT[mi]}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ── CompraCard ─────────────────────────────────────────────────────────────────
const CompraCard = React.memo(({ item }: { item: CompraDtoList }) => {
  const colors     = useColors()
  const router     = useRouter()
  const status     = getCompraStatusConfig(item.estado, colors)
  const StatusIcon = status.Icon
  const provName   = item.razonSocialProveedor || '—'
  const depoName   = item.nombreDeposito       || ''
  const itemCount  = item.itemsCount ?? 0

  return (
    <MotiView from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
      <Pressable
        onPress={() => { Haptics.selectionAsync(); router.push(`/(tabs)/compras/${item.id}`); }}
        style={({ pressed }) => ({
          marginHorizontal: 16, marginBottom: 12, backgroundColor: colors.surface,
          borderRadius: 24, elevation: pressed ? 8 : 3,
          shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 12,
          transform: [{ scale: pressed ? 0.96 : 1 }],
          borderBottomWidth: 4, borderBottomColor: status.color,
        })}
      >
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ fontSize: tokens.typography.md.size, fontWeight: '900', color: colors.text, letterSpacing: 0.5, textTransform: 'uppercase' }} numberOfLines={1}>{provName}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Package size={12} color={colors.textDisabled} />
                <Text style={{ fontSize: 9, color: colors.textDisabled, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>{depoName}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: status.bg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 }}>
                <StatusIcon size={12} color={status.color} strokeWidth={2.5} />
                <Text style={{ fontSize: tokens.typography.xs.size, fontWeight: '900', color: status.color, textTransform: 'uppercase', letterSpacing: 1 }}>{status.label}</Text>
              </View>
              <Text style={{ fontSize: 9, color: colors.textDisabled, fontWeight: '900', letterSpacing: 1.5 }}>📦 {itemCount} ÍTEMS</Text>
            </View>
          </View>

          <View style={{ backgroundColor: `${colors.primary}08`, borderRadius: 16, padding: 14, marginBottom: 16 }}>
            <Text style={{ fontSize: 8, fontWeight: '900', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>Inversión Total</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <Text style={{ fontSize: tokens.typography['2xl'].size, fontWeight: '900', color: colors.text, letterSpacing: -1, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{formatMoney(item.totalAmount ?? 0)}</Text>
              <Text style={{ fontSize: tokens.typography.xs.size, color: colors.textDisabled, fontWeight: '900', letterSpacing: 1 }}>ARS</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Calendar size={14} color={colors.textDisabled} />
              <Text style={{ fontSize: tokens.typography.xs.size, color: colors.textDisabled, fontWeight: '800', letterSpacing: 1 }}>{formatToLocalDate(item.fecha ?? '')}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: tokens.typography.xs.size, fontWeight: '900', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1 }}>Detalles</Text>
              <ChevronRight size={14} color={colors.primary} strokeWidth={3} />
            </View>
          </View>
        </View>
      </Pressable>
    </MotiView>
  )
})


export default function ComprasListScreen() {
  const navigation = useNavigation();
  const colors = useColors()
  const isDark = useIsDark()
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const {
    searchTerm, setSearchTerm,
    filter, setFilter,
    pickerOpen, setPickerOpen,
    selected, setSelected,
    isCurrentMonth, now,
    isLoading, isRefetching, refetch,
    filteredCompras,
    totalMonto, pendCount,
    fetchNextPage, hasNextPage, isFetchingNextPage, comprasByMonth
  } = useComprasList()

  const renderItem = useCallback(({ item }: { item: any }) => <CompraCard item={item} />, [])

  const headerComponent = useMemo(() => (
    <View style={{ paddingBottom: 10 }}>
       <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setPickerOpen(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: `${colors.primary}12`, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 }}
          >
            <Calendar size={15} color={colors.primary} />
            <Text style={{ fontSize: tokens.typography.base.size, fontWeight: '900', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1 }}>
              {MONTHS_ES[selected.month]} {selected.year}
            </Text>
            <ChevronDown size={14} color={colors.primary} strokeWidth={2.5} />
          </TouchableOpacity>

          {!isCurrentMonth && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setSelected({ year: now.getFullYear(), month: now.getMonth() })}
              style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: `${BRAND.blue}12` }}
            >
              <Text style={{ fontSize: tokens.typography.sm.size, fontWeight: '900', color: BRAND.blue }}>Hoy</Text>
            </TouchableOpacity>
          )}
        </View>

        <MotiView key={`kpi-${selected.year}-${selected.month}`} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }}>
          <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            <KpiStatRow
              stats={[
                { key: 'ordenes', label: 'Órdenes', value: String(comprasByMonth.length), icon: ShoppingBag, color: colors.text },
                { key: 'pendientes', label: 'Pendientes', value: String(pendCount), icon: TrendingUp, color: BRAND.blue },
                { key: 'inversion', label: 'Inversión', value: `$${(totalMonto / 1000).toFixed(0)}K`, icon: DollarSign, color: BRAND.lime },
              ]}
            />
          </View>
        </MotiView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, marginBottom: 16, gap: 8 }}>
          {(['Todas', 'Pendiente', 'Confirmado', 'Entregado'] as const).map(f => (
            <TouchableOpacity
              key={f} activeOpacity={0.7} 
              onPress={() => setFilter(f)}
              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: filter === f ? colors.primary : colors.surface }}
            >
              <Text style={{ color: filter === f ? '#fff' : colors.textMuted, fontWeight: '900', fontSize: tokens.typography.xs.size, letterSpacing: 1, textTransform: 'uppercase' }}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
    </View>
  ), [selected, isCurrentMonth, colors, filter, totalMonto, pendCount, comprasByMonth.length])

  return (
    <RequirePermission module="MOD_COMPRAS" action="read" mode="screen">
      <View style={{ flex: 1, backgroundColor: colors.bg }}>

      <BlurView intensity={isDark ? 40 : 80} tint={isDark ? 'dark' : 'light'} style={{ paddingTop: insets.top + 20, paddingBottom: 20, paddingHorizontal: 20, zIndex: 100 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
              style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: isDark ? '#111' : colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}
            >
              <ForwardLogo size={34} showText={false} />
            </TouchableOpacity>
            <View>
              <Text style={{ fontSize: tokens.typography.xl.size, fontWeight: '900', color: colors.text, letterSpacing: -0.5 }}>COMPRAS</Text>
              <Text style={{ fontSize: 8, color: colors.success, fontWeight: '800', letterSpacing: 1.5 }}>ESTADO: ONLINE</Text>
            </View>
          </View>
          <TopHeaderActions />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, height: 48, paddingHorizontal: 16, backgroundColor: colors.surface2 }}>
          <Search size={16} color={`${colors.primary}60`} />
          <TextInput
            placeholder="BUSCAR PROVEEDOR..."
            placeholderTextColor={colors.textDisabled}
            style={{ flex: 1, fontSize: tokens.typography.sm.size, fontWeight: '700', color: colors.text }}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>
      </BlurView>

      <View style={{ flex: 1 }}>
        <DataList
          data={filteredCompras}
          renderItem={renderItem}
          estimatedItemSize={180}
          ListHeaderComponent={headerComponent}
          contentContainerStyle={{ paddingBottom: 120 }}
          isLoading={isLoading}
          isRefetching={isRefetching}
          onRefresh={refetch}
          onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
          isFetchingNextPage={isFetchingNextPage}
          SkeletonComponent={CompraCardSkeleton}
          skeletonCount={4}
          emptyMessage="No se encontraron órdenes de compra."
        />
      </View>

      <RequirePermission module="MOD_COMPRAS" action="create">
        <MotiView from={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ position: 'absolute', bottom: insets.bottom + 20, right: 20, zIndex: 10 }}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)/compras/nueva')}
            style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 10 }}
          >
            <Plus size={32} color="#fff" strokeWidth={3} />
          </TouchableOpacity>
        </MotiView>
      </RequirePermission>

      <MonthPicker visible={pickerOpen} selected={selected} onSelect={setSelected} onClose={() => setPickerOpen(false)} />
    </View>
    </RequirePermission>
  )
}
