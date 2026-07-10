import React, { useCallback } from 'react'
import {
  View,
  Text,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  ScrollView,
  TouchableOpacity
} from 'react-native'
import { FlashList, FlashListProps } from '@shopify/flash-list'
import { useColors } from '@/libs/theme'
import { SearchX, AlertCircle, RefreshCw } from 'lucide-react-native'

interface DataListProps<T> extends Omit<FlashListProps<T>, 'RefreshControl'> {
  isLoading?: boolean
  isRefetching?: boolean
  onRefresh?: () => void
  onEndReached?: () => void
  isFetchingNextPage?: boolean
  emptyMessage?: string
  error?: any
  /** Si está presente, se muestra como botón "Reintentar" en el estado de error */
  onRetry?: () => void
  /** Componente a mostrar como skeleton durante la carga inicial */
  SkeletonComponent?: React.ComponentType
  /** Cantidad de skeletons a mostrar (default: 6) */
  skeletonCount?: number
  /** Tamaño estimado de los items para FlashList */
  estimatedItemSize: number
}

/**
 * DataList Genérico de Alto Rendimiento
 * Centraliza: Scroll infinito, Pull-to-refresh, Empty states, Error+Retry y Skeletons.
 */
export function DataList<T>({
  data,
  isLoading,
  isRefetching,
  onRefresh,
  onEndReached,
  isFetchingNextPage,
  emptyMessage = 'No se encontraron resultados',
  error,
  onRetry,
  SkeletonComponent,
  skeletonCount = 6,
  ...props
}: DataListProps<T>) {
  const colors = useColors()

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return <View style={styles.footer} />
    return (
      <View style={styles.footer}>
        <ActivityIndicator color={colors.primary} size="small" />
      </View>
    )
  }, [isFetchingNextPage, colors.primary])

  const renderEmpty = useCallback(() => {
    if (isLoading) return null
    return (
      <View style={styles.emptyContainer}>
        <SearchX size={48} color={colors.textMuted} strokeWidth={1.5} />
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          {emptyMessage}
        </Text>
      </View>
    )
  }, [isLoading, emptyMessage, colors.textMuted])

  // Carga inicial con Skeletons para mejorar el CLS (Cumulative Layout Shift)
  if (isLoading && !isRefetching && SkeletonComponent) {
    return (
      <ScrollView
        contentContainerStyle={props.contentContainerStyle}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
      >
        {props.ListHeaderComponent && (
          <View>
            {React.isValidElement(props.ListHeaderComponent)
              ? props.ListHeaderComponent
              : React.createElement(props.ListHeaderComponent as any)}
          </View>
        )}
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <SkeletonComponent key={i} />
        ))}
      </ScrollView>
    )
  }

  // Fallback si no hay skeleton definido
  if (isLoading && !isRefetching) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    )
  }

  // Error sin datos cacheados: pantalla completa con retry.
  // Si ya tenemos data, dejamos que la lista se renderice (el error se puede
  // manejar arriba con un banner/toast en el caller).
  if (error && (!data || data.length === 0)) {
    const message =
      (error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : '') || 'No se pudieron cargar los datos.'
    return (
      <View style={styles.errorContainer}>
        <AlertCircle size={48} color={colors.danger ?? '#EF4444'} strokeWidth={1.5} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>Algo salió mal</Text>
        <Text style={[styles.errorMessage, { color: colors.textMuted }]} numberOfLines={3}>
          {message}
        </Text>
        {onRetry && (
          <TouchableOpacity
            onPress={onRetry}
            style={[styles.retryButton, { borderColor: colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Reintentar carga"
          >
            <RefreshCw size={16} color={colors.primary} />
            <Text style={[styles.retryText, { color: colors.primary }]}>Reintentar</Text>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  return (
    <FlashList
      data={data}
      keyExtractor={props.keyExtractor ?? ((item: any) => item.id)}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListFooterComponent={renderFooter}
      ListEmptyComponent={renderEmpty}
      refreshControl={
        <RefreshControl
          refreshing={!!isRefetching}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
      {...props}
    />
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  footer: {
    paddingVertical: 20,
    height: 60,
  },
  errorContainer: {
    flex: 1,
    paddingHorizontal: 32,
    paddingVertical: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    marginTop: 20,
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  errorMessage: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
})
