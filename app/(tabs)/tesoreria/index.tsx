import {
  View, Text, RefreshControl, Pressable, TextInput,
  ActivityIndicator, StyleSheet, Platform, TouchableOpacity
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useState } from 'react'

const AnyFlashList = FlashList as any;
import { useRouter, useNavigation } from 'expo-router'
import { DrawerActions } from '@react-navigation/native'
import { safeHaptics } from '@/core/utils/haptics'
import {
  Wallet, Plus, Filter, Activity,
  TrendingUp, TrendingDown, RefreshCcw,
  History, ArrowRightLeft, Receipt, Search
} from 'lucide-react-native'
import { useColors, useIsDark } from '@/libs/theme'
import {
  ConfirmModal, ForwardLogo, TopHeaderActions,
  GlassCard, RequirePermission, SegmentedControl, KpiStatRow
} from '@/core/ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { MotiView } from 'moti'
import { LinearGradient } from 'expo-linear-gradient'
import { useHistorialTesoreria, useAnularTransaccion } from '@/libs/api-client'
import { TesoreriaCard } from '@/features/tesoreria/components/TesoreriaCard'
import { useAuthStore } from '@/features/auth/store/auth.store'


export default function TesoreriaScreen() {
  const colors = useColors()
  const isDark = useIsDark()
  const router = useRouter()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { user } = useAuthStore()

  const [page, setPage] = useState(1)
  const [categoria, setCategoria] = useState<'' | 'cliente' | 'proveedor' | 'propia' | 'gasto'>('')
  const [search, setSearch] = useState('')
  const { data, isLoading, isRefetching, refetch } = useHistorialTesoreria({
    pageNumber: page,
    pageSize: 20,
    categoria: categoria || undefined,
    searchTerm: search || undefined,
  })

  const { mutate: anular } = useAnularTransaccion()
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('ERROR DE CARGA')

  const handleAnular = (id: string) => {
    safeHaptics.impact('medium')
    setSelectedId(id)
    setModalVisible(true)
  }

  const confirmAnular = () => {
    if (!selectedId || !user?.id) return
    anular({ transaccionId: selectedId, motivo }, {
      onSuccess: () => {
        setModalVisible(false)
        setSelectedId(null)
        safeHaptics.notification('success')
      }
    })
  }

  const transacciones = data?.items ?? []

  const CATEGORIAS = [
    { value: '' as const, label: 'Todo' },
    { value: 'cliente' as const, label: 'Clientes' },
    { value: 'proveedor' as const, label: 'Proveedores' },
    { value: 'propia' as const, label: 'Propias' },
    { value: 'gasto' as const, label: 'Gastos' },
  ]

  // ── KPI Totals ───────────────────────────────────────────────────────────
  const { totalIngresos, totalEgresos, totalAjustes } = transacciones.reduce(
    (acc, t) => {
      if (t.esAnulacion || t.estaAnulado) return acc
      const monto = Math.abs(t.monto ?? 0)
      const tipo = t.tipoNombre?.toLowerCase() ?? ''
      if (tipo.includes('ingreso') || tipo.includes('cobro') || tipo.includes('recibo')) {
        acc.totalIngresos += monto
      } else if (tipo.includes('egreso') || tipo.includes('pago') || tipo.includes('gasto')) {
        acc.totalEgresos += monto
      } else {
        acc.totalAjustes += monto
      }
      return acc
    },
    { totalIngresos: 0, totalEgresos: 0, totalAjustes: 0 }
  )

  const fmt = (n: number) =>
    n === 0 ? '$0'
    : n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K`
    : `$${n.toFixed(0)}`

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* ── Header Observatorio ── */}
      <BlurView
        intensity={isDark ? 40 : 80}
        tint={isDark ? 'dark' : 'light'}
        style={{
          paddingTop: insets.top + 20,
          paddingBottom: 20, paddingHorizontal: 20,
          zIndex: 100,
        }}
      >
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[styles.brandCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
              <ForwardLogo size={24} showText={false} onPress={() => { safeHaptics.impact('light'); navigation.dispatch(DrawerActions.openDrawer()); }} />
            </View>
            <View>
              <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text, letterSpacing: -0.5 }}>
                Tesorería
              </Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600', marginTop: 1 }}>
                Historial económico
              </Text>
            </View>
          </View>
          <TopHeaderActions />
        </View>
      </BlurView>

      <AnyFlashList
        data={transacciones}
        keyExtractor={(item: any) => item.id}
        estimatedItemSize={200}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ 
          paddingBottom: 150, 
          paddingTop: 20, 
          paddingHorizontal: 20 
        }}
        ListHeaderComponent={
          <MotiView
            from={{ opacity: 0, translateY: -10 }}
            animate={{ opacity: 1, translateY: 0 }}
            style={{ marginBottom: 24 }}
          >
            {/* Tarjetas de acción */}
            <RequirePermission module="MOD_PAGOS" action="create">
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                {[
                  { preset: 'transferencia', label: 'Transferencia', Icon: ArrowRightLeft, color: colors.primary },
                  { preset: 'gasto', label: 'Cargar Gasto', Icon: Receipt, color: colors.warning },
                ].map(a => (
                  <TouchableOpacity
                    key={a.preset}
                    activeOpacity={0.8}
                    onPress={() => { safeHaptics.impact('medium'); router.push(`/(tabs)/tesoreria/nueva?preset=${a.preset}`) }}
                    style={{
                      flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
                      backgroundColor: colors.surface, borderRadius: 20, padding: 16,
                      borderWidth: 1.5, borderColor: `${a.color}40`,
                    }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: `${a.color}18`, alignItems: 'center', justifyContent: 'center' }}>
                      <a.Icon size={20} color={a.color} />
                    </View>
                    <Text style={{ flex: 1, fontSize: 13, fontWeight: '800', color: colors.text }}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </RequirePermission>

            {/* KPIs Row */}
            <View style={{ marginBottom: 24 }}>
              <KpiStatRow
                stats={[
                  { key: 'ingresos', label: 'INGRESOS', value: fmt(totalIngresos), icon: TrendingUp, color: colors.success },
                  { key: 'egresos', label: 'EGRESOS', value: fmt(totalEgresos), icon: TrendingDown, color: colors.danger },
                  { key: 'ajustes', label: 'AJUSTES', value: fmt(totalAjustes), icon: RefreshCcw, color: colors.secondary },
                ]}
              />
            </View>

            {/* Búsqueda */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 14, height: 48, marginBottom: 12,
            }}>
              <Search size={18} color={colors.textMuted} />
              <TextInput
                placeholder="Buscar por socio o concepto..."
                placeholderTextColor={colors.textDisabled}
                value={search}
                onChangeText={(v) => { setPage(1); setSearch(v) }}
                style={{ flex: 1, color: colors.text, fontSize: 14, fontWeight: '500' }}
              />
            </View>

            {/* Chips de categoría */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
              {CATEGORIAS.map(c => {
                const active = categoria === c.value
                return (
                  <TouchableOpacity
                    key={c.value || 'todo'}
                    onPress={() => { safeHaptics.selection(); setPage(1); setCategoria(c.value) }}
                    style={{
                      paddingHorizontal: 16, paddingVertical: 9, borderRadius: 14,
                      backgroundColor: active ? colors.primary : colors.surface2,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '800', color: active ? '#fff' : colors.textMuted }}>{c.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <History size={12} color={colors.textDisabled} />
              <Text style={{ fontSize: 9, fontWeight: '900', color: colors.textDisabled, letterSpacing: 1.5 }}>
                HISTORIAL DE MOVIMIENTOS
              </Text>
            </View>
          </MotiView>
        }
        renderItem={({ item, index }: { item: any; index: number }) => (
          <TesoreriaCard 
            item={item} 
            index={index} 
            onAnular={handleAnular}
          />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <GlassCard intensity={10} style={styles.emptyCard}>
                <History size={48} color={`${colors.primary}60`} strokeWidth={1.5} />
                <Text style={[styles.emptyText, { color: colors.text }]}>SIN MOVIMIENTOS</Text>
                <Text style={{ fontSize: 11, color: colors.textMuted, fontFamily: 'Outfit_400Regular', textAlign: 'center', paddingHorizontal: 16 }}>
                  {search || categoria ? 'No hay movimientos con estos filtros' : 'Las transacciones registradas aparecerán acá'}
                </Text>
              </GlassCard>
            </View>
          ) : (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} size="large" />
          )
        }
      />

      {/* FAB — Nueva Transacción */}
      <RequirePermission module="MOD_PAGOS" action="create">
        <MotiView
          from={{ scale: 0, rotate: '-45deg' }}
          animate={{ scale: 1, rotate: '0deg' }}
          transition={{ type: 'spring', delay: 400 }}
          style={styles.fabContainer}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              safeHaptics.impact('heavy')
              router.push('/(tabs)/tesoreria/nueva')
            }}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryHover]}
              style={styles.fabGradient}
            >
              <Plus size={32} color={colors.bg} strokeWidth={3} />
            </LinearGradient>
          </TouchableOpacity>
        </MotiView>
      </RequirePermission>

      <ConfirmModal
        visible={modalVisible}
        title="ANULAR TRANSACCIÓN"
        message="¿CONFIRMA LA ANULACIÓN? SE GENERARÁ UN CONTRA-ASIENTO DE COMPENSACIÓN INMEDIATAMENTE."
        variant="danger"
        onConfirm={confirmAnular}
        onCancel={() => setModalVisible(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  brandCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  liveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  liveText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 40,
    width: '100%',
  },
  emptyCard: {
    width: '100%',
    paddingVertical: 36,
    paddingHorizontal: 24,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  emptyText: {
    fontSize: 12,
    fontFamily: 'Outfit_900Black',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 100,
    right: 24,
    zIndex: 999,
    shadowColor: '#4278ff',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  fabGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  }
})
