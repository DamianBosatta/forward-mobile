import { useState, useMemo, useCallback } from 'react'
import { View, Text, Pressable, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter, useNavigation } from 'expo-router'
import { DrawerActions } from '@react-navigation/native';
import * as Haptics from 'expo-haptics'
import { safeHaptics } from '@/core/utils/haptics'
import { Search as SearchIcon, Package, Plus, MapPin, ChevronDown } from 'lucide-react-native'
import { useColors, useIsDark } from '@/libs/theme'
import { StockCard } from '@/features/inventario/components/StockCard'
import { StockListRow } from '@/features/inventario/components/StockListRow'
import {
  ForwardLogo,
  TopHeaderActions,
  RequirePermission,
  GlassCard,
  ConfirmModal,
  AuroraGlow,
  SegmentedControl,
  PremiumInput
} from '@/core/ui'
import { InventoryKpiCards } from '@/features/inventario/components/InventoryKpiCards'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { MotiView } from 'moti'
import { StockItem } from '@/libs/api-client/types'
import { StockActionModal } from '@/features/inventario/components/StockActionModal'
import { StockDetailSheet } from '@/features/inventario/components/StockDetailSheet'
import { useInventarioList } from '@/features/inventario/hooks/useInventarioList'
import { useCatalogoStock, CatalogoStockItem } from '@/libs/api-client/productos'
import { DataList } from '@/core/ui/DataList'
import { useAuthStore } from '@/libs/store/auth.store'
import { canViewCost } from '@/features/ventas/lib/descuentos'
import { storage } from '@/core/utils/storage'

type StockActionMode = 'adjust' | 'status'

// Persisted grid/list view-mode preference (Slice 6 — mirrors the web toggle).
const VIEW_MODE_STORAGE_KEY = 'inventario:viewMode'
type InventarioViewMode = 'grid' | 'list'

export default function InventarioScreen() {
  const navigation = useNavigation();
  const colors = useColors()
  const isDark = useIsDark()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user } = useAuthStore()
  const userRoles = user?.roles ?? []
  const showCost = canViewCost(userRoles as string[])

  const {
    searchTerm, setSearchTerm,
    depositoId, setDepositoId,
    showDepoSelector, setShowDepoSelector,
    filterIndex, setFilterIndex,
    depositos, selectedDepo,
    productos, isLoading, isRefetching, refetch,
    totalValue, lowStockCount, totalVirtual,
    fetchNextPage, hasNextPage, isFetchingNextPage
  } = useInventarioList()

  // Catalogo-stock for cost data (only fetched if user can view cost)
  const { data: catalogoItems } = useCatalogoStock(showCost ? depositoId : undefined)

  const catalogoByProductoId = useMemo(() => {
    if (!catalogoItems) return new Map<string, CatalogoStockItem>()
    return new Map(catalogoItems.map((c) => [c.id ?? '', c]))
  }, [catalogoItems])

  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)
  const [modalMode, setModalMode] = useState<StockActionMode | null>(null)
  const [detailItem, setDetailItem] = useState<StockItem | null>(null)
  const [isSearchFocused, setIsSearchFocused] = useState(false)

  // Grid/list view-mode toggle (Slice 6) — persisted via MMKV, same key style as
  // the rest of the app's simple UI preferences.
  const [viewMode, setViewMode] = useState<InventarioViewMode>(() =>
    storage.getString(VIEW_MODE_STORAGE_KEY) === 'list' ? 'list' : 'grid'
  )
  const handleViewModeChange = useCallback((index: number) => {
    const next: InventarioViewMode = index === 1 ? 'list' : 'grid'
    setViewMode(next)
    storage.set(VIEW_MODE_STORAGE_KEY, next)
  }, [])

  const [feedback, setFeedback] = useState<{
    visible: boolean
    variant: 'success' | 'danger'
    title: string
    message: string
  }>({ visible: false, variant: 'success', title: '', message: '' })

  const handleOpenAction = useCallback((item: StockItem, mode: StockActionMode) => {
    safeHaptics.impact('medium')
    setSelectedItem(item)
    setModalMode(mode)
  }, [])

  const handleCloseModal = () => {
    setModalMode(null)
    setSelectedItem(null)
  }

  const handleActionSuccess = (title: string, message: string) => {
    setFeedback({ visible: true, variant: 'success', title, message })
  }

  const handleActionError = (message: string) => {
    setFeedback({ visible: true, variant: 'danger', title: 'Error', message })
  }

  const handleOpenDetail = useCallback((item: StockItem) => {
    safeHaptics.impact('light')
    setDetailItem(item)
  }, [])

  const renderItem = useCallback(({ item, index }: { item: any; index: number }) => (
    viewMode === 'list' ? (
      <StockListRow item={item} onOpenDetail={() => handleOpenDetail(item)} />
    ) : (
      <StockCard
        item={item}
        index={index}
        onOpenAjuste={() => handleOpenAction(item, 'adjust')}
        onOpenToggle={() => handleOpenAction(item, 'status')}
        onOpenDetail={() => handleOpenDetail(item)}
      />
    )
  ), [handleOpenAction, handleOpenDetail, viewMode])

  const headerComponent = useMemo(() => (
    <>
      <InventoryKpiCards
        totalValue={totalValue}
        totalItems={productos.length}
        lowStockCount={lowStockCount}
        totalVirtual={totalVirtual}
      />

      <View style={styles.listHeaderTitle}>
        <View style={[styles.titleIndicator, { backgroundColor: colors.primary }]} />
        <Text style={styles.titleText}>CATÁLOGO DE PRODUCTOS ({productos.length})</Text>
      </View>
    </>
  ), [totalValue, productos.length, lowStockCount, totalVirtual, colors.primary])

  const catalogoForDetail = detailItem
    ? catalogoByProductoId.get(detailItem.productoId ?? '') ?? null
    : null

  return (
    <RequirePermission module="MOD_STOCK" action="read" mode="screen">
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <AuroraGlow color={isDark ? colors.primary : '#00b4a2'} opacity={0.12} />

        <View style={{ zIndex: 100 }}>
          <BlurView
            intensity={isDark ? 20 : 60}
            tint={isDark ? 'dark' : 'light'}
            style={{ paddingTop: insets.top + 8, paddingBottom: 14 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 }}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => { safeHaptics.impact('light'); navigation.dispatch(DrawerActions.openDrawer()); }}
                style={[styles.premiumBrandCircle, { backgroundColor: isDark ? '#111' : colors.surface }]}
              >
                <ForwardLogo size={28} showText={false} />
              </TouchableOpacity>

              <View style={{ flex: 1, marginHorizontal: 12 }}>
                <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text, fontFamily: 'Outfit_900Black', letterSpacing: -0.8 }}>
                  INVENTARIO
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 }}>
                  <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
                  <Text style={[styles.statusText, { color: colors.success }]}>SINCRO CLOUD</Text>
                </View>
              </View>

              <TopHeaderActions />
            </View>

            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              <Pressable
                onPress={() => {
                  safeHaptics.impact('light')
                  setShowDepoSelector(!showDepoSelector)
                }}
                style={({ pressed }) => ([{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.surface,
                  borderWidth: 1,
                  borderColor: depositoId ? colors.primary + '60' : (isDark ? 'rgba(255,255,255,0.08)' : colors.border),
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  opacity: pressed ? 0.8 : 1,
                }])}
              >
                <MapPin size={14} color={depositoId ? colors.primary : colors.textMuted} />
                <Text style={{
                  flex: 1,
                  fontSize: 12,
                  fontFamily: 'Outfit_800ExtraBold',
                  color: depositoId ? colors.primary : colors.textMuted,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}>
                  {selectedDepo ? selectedDepo.nombre : 'Todos los Depósitos'}
                </Text>
                {depositoId && (
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync()
                      setDepositoId(undefined)
                    }}
                    style={{ padding: 2 }}
                    hitSlop={8}
                  >
                    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary + '25', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 10, color: colors.primary, fontFamily: 'Outfit_900Black', lineHeight: 14 }}>✕</Text>
                    </View>
                  </Pressable>
                )}
                <ChevronDown
                  size={14}
                  color={depositoId ? colors.primary : colors.textMuted}
                  strokeWidth={2.5}
                  style={{ transform: [{ rotate: showDepoSelector ? '180deg' : '0deg' }] }}
                />
              </Pressable>

              {showDepoSelector && (
                <MotiView
                  from={{ opacity: 0, translateY: -8, scale: 0.97 }}
                  animate={{ opacity: 1, translateY: 0, scale: 1 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                  style={[styles.dropdownContainer, {
                    backgroundColor: isDark ? '#0a0a0a' : colors.surface,
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border,
                  }]}
                >
                  <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync()
                        setDepositoId(undefined)
                        setShowDepoSelector(false)
                      }}
                      style={styles.dropdownItem}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: !depositoId ? colors.primary : 'transparent', borderWidth: 1.5, borderColor: colors.primary }} />
                        <Text style={[styles.dropdownItemText, { color: !depositoId ? colors.primary : colors.textMuted }, !depositoId && { fontFamily: 'Outfit_800ExtraBold' }]}>
                          Todos los Depósitos
                        </Text>
                      </View>
                    </Pressable>
                    {depositos.map(d => (
                      <Pressable
                        key={d.id}
                        onPress={() => {
                          Haptics.selectionAsync()
                          setDepositoId(d.id)
                          setShowDepoSelector(false)
                        }}
                        style={styles.dropdownItem}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: depositoId === d.id ? colors.primary : 'transparent', borderWidth: 1.5, borderColor: colors.primary }} />
                          <Text style={[styles.dropdownItemText, { color: depositoId === d.id ? colors.primary : colors.textMuted }, depositoId === d.id && { fontFamily: 'Outfit_800ExtraBold' }]}>
                            {d.nombre}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </MotiView>
              )}
            </View>

            <View style={{ paddingHorizontal: 16, gap: 10 }}>
              <PremiumInput
                label="Buscador"
                placeholder="Buscar artículos o SKU..."
                value={searchTerm}
                onChangeText={setSearchTerm}
                hideLabel
                variant="search"
                icon={<SearchIcon size={18} color={isSearchFocused ? colors.primary : '#525252'} />}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
              />

              <SegmentedControl
                options={['ACTIVOS', 'INACTIVOS', 'TODOS']}
                selectedIndex={filterIndex}
                onChange={setFilterIndex}
              />

              <SegmentedControl
                options={['TARJETAS', 'LISTA']}
                selectedIndex={viewMode === 'list' ? 1 : 0}
                onChange={handleViewModeChange}
              />
            </View>
          </BlurView>
        </View>

        <DataList
          data={productos}
          renderItem={renderItem}
          estimatedItemSize={viewMode === 'list' ? 64 : 140}
          ListHeaderComponent={headerComponent}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 130 }}
          isLoading={isLoading}
          isRefetching={isRefetching}
          onRefresh={refetch}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage()
            }
          }}
          isFetchingNextPage={isFetchingNextPage}
          emptyMessage="No se encontraron productos en el inventario."
        />

        <RequirePermission module="MOD_STOCK" action="create">
          <MotiView
            from={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 15 }}
            style={{ position: 'absolute', bottom: insets.bottom + 20, right: 20 }}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                safeHaptics.impact('medium')
                router.push('/(tabs)/inventario/nuevo')
              }}
              style={styles.fab}
            >
              <Plus size={32} color="#000" strokeWidth={3} />
            </TouchableOpacity>
          </MotiView>
        </RequirePermission>

        <StockActionModal
          visible={modalMode !== null}
          mode={modalMode}
          item={selectedItem}
          onClose={handleCloseModal}
          onSuccess={handleActionSuccess}
          onError={handleActionError}
        />

        <StockDetailSheet
          item={detailItem}
          catalogoItem={catalogoForDetail}
          userRoles={userRoles as string[]}
          visible={detailItem !== null}
          onClose={() => setDetailItem(null)}
        />

        <ConfirmModal
          visible={feedback.visible}
          title={feedback.title}
          message={feedback.message}
          variant={feedback.variant}
          confirmLabel="Aceptar"
          onConfirm={() => setFeedback(f => ({ ...f, visible: false }))}
          onCancel={() => setFeedback(f => ({ ...f, visible: false }))}
        />
      </View>
    </RequirePermission>
  )
}

const styles = StyleSheet.create({
  premiumBrandCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.15)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 1,
  },
  dropdownContainer: {
    marginTop: 6,
    borderRadius: 18,
    padding: 6,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  dropdownItem: {
    padding: 14,
    borderRadius: 12,
  },
  dropdownItemText: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
  },
  listHeaderTitle: {
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleIndicator: {
    width: 4,
    height: 12,
    borderRadius: 2,
  },
  titleText: {
    fontSize: 10,
    color: '#525252',
    fontFamily: 'Outfit_900Black',
    letterSpacing: 1.5,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: '#00d1c1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00d1c1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
  }
})
