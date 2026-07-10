import {
  View, Text, RefreshControl, Pressable, TextInput,
  ActivityIndicator, TouchableOpacity, StyleSheet, Platform
} from 'react-native'
import { useState, useCallback, useMemo } from 'react'
import { useRouter, useNavigation } from 'expo-router'
import { DrawerActions } from '@react-navigation/native';
import { safeHaptics } from '@/core/utils/haptics'
import { useToggleSocioStatus } from '@/libs/api-client/socios'
import { Search, Users, Plus, Building2, Filter, Activity, BarChart3, Check } from 'lucide-react-native'
import { useColors, useIsDark } from '@/libs/theme'
import { SocioCard } from '@/features/socios/components/SocioCard'
import { ConfirmModal, GlassCard, ForwardLogo, TopHeaderActions, RequirePermission } from '@/core/ui'
import { usePermissions } from '@/core/auth/RequirePermission'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { MotiView } from 'moti'
import type { SocioComercial } from '@/libs/api-client/types'
import { useSociosList } from '@/features/socios/hooks/useSociosList'
import { LinearGradient } from 'expo-linear-gradient'
import { DataList } from '@/core/ui/DataList'
import { SocioCardSkeleton } from '@/features/socios/components/SocioCardSkeleton'

// ── KpiCard Premium ──────────────────────────────────────────────────────────
function KpiCard({ label, value, color, Icon, delay = 0 }: { label: string; value: string; color: string; Icon: any; delay?: number }) {
  const colors = useColors()
  const isDark = useIsDark()
  return (
    <MotiView 
      from={{ opacity: 0, translateY: 10 }} 
      animate={{ opacity: 1, translateY: 0 }} 
      transition={{ type: 'spring', delay, damping: 15 }} 
      style={{ flex: 1 }}
    >
      <View style={{
        backgroundColor: isDark ? '#0D0D0D' : colors.surface,
        borderRadius: 20,
        padding: 16,
        alignItems: 'center',
        overflow: 'hidden'
      }}>
        <LinearGradient
          colors={[color + '10', 'transparent']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <View style={{ 
          width: 36, height: 36, borderRadius: 10, 
          backgroundColor: color + '15', 
          alignItems: 'center', justifyContent: 'center', 
          marginBottom: 8,
          borderWidth: 1,
          borderColor: color + '20'
        }}>
          <Icon size={18} color={color} />
        </View>
        <Text style={{ 
          fontSize: 24, color: colors.text, letterSpacing: -1, fontFamily: 'Outfit_900Black'
        }}>
          {value}
        </Text>
        <Text style={{ 
          fontSize: 8, color: colors.textMuted, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2, fontFamily: 'Outfit_800ExtraBold'
        }}>
          {label}
        </Text>
      </View>
    </MotiView>
  )
}

// ─── SegmentedFilter Premium ──────────────────────────────────────────────────
function SegmentedFilter({ options, active, onChange }: { options: string[], active: string, onChange: (val: any) => void }) {
  const colors = useColors()
  const isDark = useIsDark()
  
  return (
    <View style={[styles.segmentedContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', borderColor: colors.border }]}>
      {options.map((opt) => {
        const isActive = active === opt
        return (
          <Pressable
            key={opt}
            onPress={() => { safeHaptics.impact('light'); onChange(opt); }}
            style={{ flex: 1, height: 40, alignItems: 'center', justifyContent: 'center' }}
          >
            {isActive && (
              <MotiView
                transition={{ type: 'spring', damping: 20, stiffness: 150 }}
                style={[StyleSheet.absoluteFill, { backgroundColor: colors.primary + '20', borderRadius: 10, borderWidth: 1, borderColor: colors.primary + '40' }]}
              />
            )}
            <Text style={{
              fontSize: 10,
              fontFamily: 'Outfit_900Black',
              color: isActive ? colors.primary : colors.textDisabled,
              letterSpacing: 1,
              textTransform: 'uppercase'
            }}>
              {opt}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export default function SociosScreen() {
  const navigation = useNavigation();
  const colors = useColors()
  const isDark = useIsDark()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const {
    socios, isLoading, isRefetching, refetch, kpis, filters, actions,
    fetchNextPage, hasNextPage, isFetchingNextPage
  } = useSociosList()
  const { canCreate, canUpdate } = usePermissions()
  const hasCreateAny = canCreate('MOD_CLIENTES') || canCreate('MOD_PROVEEDORES')
  const hasUpdateAny = canUpdate('MOD_CLIENTES') || canUpdate('MOD_PROVEEDORES')

  const [modalVisible, setModalVisible] = useState(false)
  const [pendingToggle, setPendingToggle] = useState<SocioComercial | null>(null)

  const { mutate: toggleStatus } = useToggleSocioStatus()

  const requestToggle = useCallback((socio: SocioComercial) => {
    safeHaptics.impact('medium')
    setPendingToggle(socio)
    setModalVisible(true)
  }, [])

  const confirmToggle = () => {
    if (!pendingToggle) return
    safeHaptics.notification('warning')
    toggleStatus(
      { id: pendingToggle.id! },
      { onSettled: () => {
        setTimeout(() => {
          setModalVisible(false)
          setPendingToggle(null)
        }, 200)
      }}
    )
  }

  const renderItem = useCallback(({ item, index }: { item: any; index: number }) => (
    <SocioCard
      item={item}
      delay={index * 30}
      onEdit={hasUpdateAny ? () => router.push({ pathname: '/(tabs)/socios/nuevo', params: { id: item.id } }) : undefined}
      onToggleStatus={() => requestToggle(item)}
    />
  ), [router, requestToggle])

  const headerComponent = useMemo(() => (
    <MotiView from={{ opacity: 0, translateY: -20 }} animate={{ opacity: 1, translateY: 0 }}>
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
        <KpiCard label="Total" value={String(kpis.todos)} color={colors.text} Icon={BarChart3} />
        <KpiCard label="Clientes" value={String(kpis.clientes)} color={colors.primary} Icon={Check} delay={100} />
        <KpiCard label="Proveedores" value={String(kpis.proveedores)} color={colors.secondary} Icon={Building2} delay={200} />
      </View>

      <View style={{ marginBottom: 24, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Filter size={12} color={colors.textDisabled} />
          <Text style={styles.filterLabel}>TIPO DE ENTIDAD</Text>
        </View>
        <SegmentedFilter
          options={['Todos', 'Clientes', 'Proveedores']}
          active={filters.typeFilter}
          onChange={actions.setTypeFilter}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 8 }}>
          <Activity size={12} color={colors.textDisabled} />
          <Text style={styles.filterLabel}>ESTADO OPERATIVO</Text>
        </View>
        <SegmentedFilter
          options={['Todos', 'Activos', 'Inactivos']}
          active={filters.statusFilter}
          onChange={actions.setStatusFilter}
        />
      </View>
    </MotiView>
  ), [kpis, filters, actions, colors])

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient
        colors={[colors.primary + '10', 'transparent']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 300 }}
      />

      <BlurView intensity={isDark ? 40 : 80} tint={isDark ? 'dark' : 'light'} style={{
        paddingTop: insets.top + 20, paddingBottom: 20, paddingHorizontal: 20, zIndex: 100
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <MotiView from={{ scale: 0.5, opacity: 0, rotate: '-20deg' }} animate={{ scale: 1, opacity: 1, rotate: '0deg' }} transition={{ type: 'spring', damping: 12, delay: 100 }}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => { safeHaptics.impact('light'); navigation.dispatch(DrawerActions.openDrawer()); }}
                style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: isDark ? '#111' : colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}
              >
                <ForwardLogo size={32} showText={false} />
              </TouchableOpacity>
            </MotiView>
            <View>
              <Text style={{ fontSize: 22, color: colors.text, fontFamily: 'Outfit_900Black', letterSpacing: -1 }}>SOCIOS</Text>
            </View>
          </View>
          <TopHeaderActions />
        </View>

        <View style={[styles.searchContainer, { backgroundColor: isDark ? '#111' : colors.surface, borderWidth: 1, borderColor: colors.border }]}>
          <Search size={18} color={colors.primary} />
          <TextInput
            placeholder="BUSCAR EN EL DIRECTORIO..."
            placeholderTextColor={colors.textDisabled}
            style={[styles.searchInput, { color: colors.text, fontFamily: 'Outfit_700Bold' }]}
            value={filters.searchTerm}
            onChangeText={actions.setSearchTerm}
          />
        </View>
      </BlurView>

      <View style={{ flex: 1 }}>
        <DataList
          data={socios}
          renderItem={renderItem}
          estimatedItemSize={200}
          ListHeaderComponent={headerComponent}
          contentContainerStyle={{ padding: 20, paddingBottom: 150 }}
          isLoading={isLoading}
          isRefetching={isRefetching}
          onRefresh={refetch}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage()
            }
          }}
          isFetchingNextPage={isFetchingNextPage}
          SkeletonComponent={SocioCardSkeleton}
          skeletonCount={5}
          emptyMessage="Sin coincidencias en el directorio."
        />
      </View>

      {hasCreateAny && (
        <MotiView from={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 400 }} style={[styles.fabContainer, { bottom: insets.bottom + 20 }]}>
          <TouchableOpacity onPress={() => { safeHaptics.impact('heavy'); router.push('/(tabs)/socios/nuevo'); }}>
            <LinearGradient colors={[colors.primary, colors.primaryHover]} style={styles.fabGradient}>
              <Plus size={32} color={colors.bg} strokeWidth={3} />
            </LinearGradient>
          </TouchableOpacity>
        </MotiView>
      )}

      <ConfirmModal
        visible={modalVisible}
        title={pendingToggle?.activo ? 'DESACTIVAR SOCIO' : 'ACTIVAR SOCIO'}
        message={`¿CONFIRMA EL CAMBIO DE ESTADO PARA ${pendingToggle?.razonSocial?.toUpperCase()}?`}
        variant={pendingToggle?.activo ? 'danger' : 'success'}
        onConfirm={confirmToggle}
        onCancel={() => setModalVisible(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  searchContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, height: 56, paddingHorizontal: 20 },
  searchInput: { flex: 1, fontSize: 13, letterSpacing: 0.5 },
  filterLabel: { fontSize: 9, color: '#737373', letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'Outfit_900Black' },
  segmentedContainer: { flexDirection: 'row', padding: 4, borderRadius: 14, borderWidth: 1 },
  fabContainer: { position: 'absolute', right: 24, zIndex: 999 },
  fabGradient: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' }
})
