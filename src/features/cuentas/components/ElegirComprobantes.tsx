import React from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { Check } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Field, Notice, formatImporte } from '@/core/ui/fw'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { mostrarNumero } from '@/src/utils/numero'
import { formatToLocalTime } from '@/src/utils/date'
import { useDocumentosPendientes, type DocumentoPendiente } from '../api/cobros'
import { NOMBRE_CUENTA } from '../lib/movimientos'

interface Props {
  socioId: string
  /** Id del comprobante → monto tipeado. */
  valor: Record<string, string>
  onCambio: (valor: Record<string, string>) => void
}

/** "A00409", la factura o el número de la venta: como lo muestra el servidor. */
export const nombreDocumento = (d: DocumentoPendiente) =>
  d.codigoPedido ?? d.numeroFactura ?? (d.numero != null ? `N.º ${d.numero}` : d.tipo)

/** Imputación manual: los comprobantes con saldo del cliente; al elegir uno se propone su saldo pendiente. */
export function ElegirComprobantes({ socioId, valor, onCambio }: Props) {
  const c = useColors()
  const pendientes = useDocumentosPendientes(socioId, true)

  if (pendientes.isLoading) return <ActivityIndicator color={c.brandInk} />
  if (pendientes.error) return <Notice tone="peligro">{mensajeDelServidor(pendientes.error, 'No se pudieron cargar los comprobantes pendientes.')}</Notice>
  const documentos = pendientes.data ?? []
  if (documentos.length === 0) return <Notice tone="info">El cliente no tiene comprobantes pendientes.</Notice>

  const alternar = (d: DocumentoPendiente) => {
    const { [d.documentoId]: elegido, ...resto } = valor
    onCambio(elegido === undefined ? { ...valor, [d.documentoId]: mostrarNumero(d.saldoPendiente) } : resto)
  }

  return (
    <View style={{ gap: space[2] }}>
      {documentos.map(d => {
        const nombre = nombreDocumento(d)
        const elegido = valor[d.documentoId] !== undefined
        return (
          <View key={d.documentoId} style={{ gap: space[2] }}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={`${nombre}, pendiente ${formatImporte(d.saldoPendiente)}`}
              accessibilityState={{ checked: elegido }}
              onPress={() => alternar(d)}
              style={{
                minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[3],
                borderRadius: radii.campo, borderWidth: elegido ? 2 : 1, borderColor: elegido ? c.brand : c.border,
                backgroundColor: elegido ? c.brandSoft : c.surface,
              }}
            >
              <View style={{ width: 20, alignItems: 'center' }}>{elegido ? <Check size={18} color={c.brandInk} /> : null}</View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{nombre}</Text>
                <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`${formatToLocalTime(d.fecha, 'd MMM')} · ${NOMBRE_CUENTA[d.tipoCuenta]}`}</Text>
              </View>
              <Text style={[typeScale.cuerpo, importe, { color: c.text }]}>{formatImporte(d.saldoPendiente)}</Text>
            </Pressable>
            {elegido ? (
              <Field
                label={`Monto a imputar a ${nombre}`}
                value={valor[d.documentoId]}
                onChangeText={v => onCambio({ ...valor, [d.documentoId]: v })}
                keyboardType="decimal-pad"
                alignRight
              />
            ) : null}
          </View>
        )
      })}
    </View>
  )
}
