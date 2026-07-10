import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { MotiView } from 'moti'
import { ArrowUpRight, ArrowDownLeft, Repeat, AlertCircle } from 'lucide-react-native'
import { useColors } from '@/libs/theme'
import type { TesoreriaListDto } from '@/libs/api-client/types'

interface TesoreriaCardProps {
  item: TesoreriaListDto
  index: number
  onAnular: (id: string) => void
}

export const TesoreriaCard: React.FC<TesoreriaCardProps> = ({ item, index, onAnular }) => {
  const colors = useColors()
  
  const tipoNombre = item.tipoNombre ?? ''
  const isIngreso =
    tipoNombre.toLowerCase().includes('cobro') ||
    tipoNombre.toLowerCase().includes('ingreso') ||
    tipoNombre.toLowerCase().includes('recibo')
  const isEgreso =
    tipoNombre.toLowerCase().includes('pago') ||
    tipoNombre.toLowerCase().includes('egreso') ||
    tipoNombre.toLowerCase().includes('gasto')
  const isTransferencia = tipoNombre.toLowerCase().includes('transferencia')
  const isAnulada = item.estaAnulado
  const esAnulacion = item.esAnulacion

  const getMontoColor = () => {
    if (isAnulada || esAnulacion) return colors.danger
    if (isTransferencia) return colors.secondary
    if (isIngreso) return colors.success
    if (isEgreso) return colors.danger
    return colors.text
  }

  const getMontoPrefix = () => {
    if (isAnulada || esAnulacion) return ''
    if (isTransferencia) return '⇄'
    if (isIngreso) return '+'
    if (isEgreso) return '-'
    return ''
  }

  const getIconBgColor = () => {
    if (isAnulada || esAnulacion) return `${colors.danger}18`
    if (isTransferencia) return `${colors.secondary}18`
    if (isIngreso) return `${colors.success}18`
    return `${colors.danger}18`
  }

  const getIcon = () => {
    if (isAnulada || esAnulacion) return <AlertCircle size={16} color={colors.danger} />
    if (isTransferencia) return <Repeat size={16} color={colors.secondary} />
    return isIngreso 
      ? <ArrowDownLeft size={16} color={colors.success} /> 
      : <ArrowUpRight size={16} color={colors.danger} />
  }

  return (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ delay: index * 50, type: 'spring' }}
      style={[
        styles.container, 
        { 
          backgroundColor: colors.surface, 
          borderColor: isAnulada ? colors.danger + '40' : colors.border,
          opacity: isAnulada ? 0.6 : 1
        }
      ]}
    >
      <View style={styles.header}>
        <View style={styles.typeBadge}>
          <View style={[styles.iconBg, { backgroundColor: getIconBgColor() }]}>
            {getIcon()}
          </View>
          <View>
            <Text style={[styles.tipoText, { color: colors.text }]}>{tipoNombre.toUpperCase()}</Text>
            <Text style={[styles.fechaText, { color: colors.textMuted }]}>
              {new Date(item.fecha ?? 0).toLocaleString('es-AR', {
                day: '2-digit', 
                month: 'short', 
                hour: '2-digit', 
                minute: '2-digit' 
              }).toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={styles.amountContainer}>
          <Text style={[
            styles.amountText, 
            { color: getMontoColor() },
            isAnulada && styles.strikethrough
          ]}>
            {getMontoPrefix()} {Math.abs(item.monto ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </Text>
          <Text style={[styles.currencyText, { color: colors.textMuted }]}>{item.moneda}</Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textDisabled }]}>ORIGEN</Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>{item.cuentaOrigenNombre}</Text>
        </View>
        {item.cuentaDestinoNombre && (
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textDisabled }]}>DESTINO</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{item.cuentaDestinoNombre}</Text>
          </View>
        )}
        {item.socioRazonSocial && (
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textDisabled }]}>ENTIDAD</Text>
            <Text style={[styles.detailValue, { color: colors.primary }]}>{item.socioRazonSocial.toUpperCase()}</Text>
          </View>
        )}
      </View>

      {item.observaciones && (
        <View style={[styles.obsContainer, { backgroundColor: colors.bg + '50' }]}>
          <Text style={[styles.obsText, { color: colors.textMuted }]}>{item.observaciones}</Text>
        </View>
      )}

      {isAnulada && (
        <View style={[styles.anuladaBadge, { backgroundColor: colors.danger }]}>
          <Text style={styles.anuladaText}>OPERACIÓN ANULADA</Text>
        </View>
      )}

      {!isAnulada && !esAnulacion && (
        <Pressable
          onPress={() => onAnular(item.id ?? '')}
          style={({ pressed }) => [styles.anularBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.anularBtnText, { color: colors.danger }]}>ANULAR TRANSACCIÓN</Text>
        </Pressable>
      )}
    </MotiView>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipoText: {
    fontSize: 14,
    fontFamily: 'Outfit_900Black',
    letterSpacing: 0.5,
  },
  fechaText: {
    fontSize: 9,
    fontFamily: 'Outfit_500Medium',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 18,
    fontFamily: 'Outfit_900Black',
    letterSpacing: -0.5,
  },
  currencyText: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    marginTop: 2,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
  divider: {
    height: 1,
    marginVertical: 16,
    opacity: 0.3,
  },
  details: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 8,
    fontFamily: 'Outfit_900Black',
    letterSpacing: 1.5,
  },
  detailValue: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.3,
  },
  obsContainer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
  },
  obsText: {
    fontSize: 11,
    fontFamily: 'Outfit_400Regular',
    fontStyle: 'italic',
    lineHeight: 16,
  },
  anuladaBadge: {
    position: 'absolute',
    top: 20,
    right: -30,
    paddingHorizontal: 40,
    paddingVertical: 4,
    transform: [{ rotate: '45deg' }],
  },
  anuladaText: {
    color: '#FFF',
    fontSize: 8,
    fontFamily: 'Outfit_900Black',
    letterSpacing: 1,
  },
  anularBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  anularBtnText: {
    fontSize: 9,
    fontFamily: 'Outfit_900Black',
    letterSpacing: 1.5,
  }
})
