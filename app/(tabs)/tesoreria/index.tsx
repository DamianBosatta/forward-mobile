import React from 'react'
import { ScrollView, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ArrowLeftRight } from 'lucide-react-native'
import { space, useColors } from '@/libs/theme'
import { FilaDeAccion, FormContainer, Notice, TopBar, useMenuLeading } from '@/core/ui/fw'
import { usePermissions } from '@/core/auth/RequirePermission'
import { MOTIVO_SIN_PERMISO_DE_TRANSFERENCIA, MotivoDeshabilitado } from '@/core/ui/fw/MotivoDeshabilitado'

/** Aviso de la lámina tesoreria-inicio: el cobro de un cliente no se carga desde Tesorería. */
const AVISO_COBROS_DE_CLIENTES = 'Los cobros de clientes se cargan desde la ficha del cliente, con "Cobrar".'

/**
 * Tesorería en mobile (plan §3, recortada a acciones): transferencias entre cuentas propias. Los
 * cobros se registran desde la cuenta corriente del cliente; los cheques, en la web (bloque 12, D10).
 * Lámina tesoreria-inicio: las filas "Pagar un servicio" y "Cargar un cheque" no se muestran todavía.
 * TODO API: "Pagar un servicio" espera confirmar el permiso del módulo y el catálogo `tipoGastoId`;
 * "Cargar un cheque" espera `POST /cheques` (hoy solo GET en el schema) y la regla D10.
 */
export default function TesoreriaScreen() {
  const c = useColors()
  const router = useRouter()
  const menu = useMenuLeading()
  const { canCreate, canRead } = usePermissions()
  // Lista las cuentas propias (MOD_CC:Read) y los tipos de movimiento (GET /movimientos-internos/tipos, MOD_PAGOS:Read).
  const transferir = canCreate('MOD_PAGOS') && canRead('MOD_PAGOS') && canRead('MOD_CC')

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Tesorería" leading={menu} />
      <ScrollView contentContainerStyle={{ padding: space[4] }}>
        <FormContainer style={{ gap: space[3] }}>
          {/* Como la web (L13): sin permiso la fila se ve deshabilitada con el motivo, no se oculta. */}
          <FilaDeAccion
            icon={ArrowLeftRight}
            title="Transferencia entre cuentas"
            subtitle="Mové plata entre tus cuentas"
            disabled={!transferir}
            onPress={() => router.push('/(tabs)/tesoreria/transferencia')}
          />
          {!transferir ? <MotivoDeshabilitado>{MOTIVO_SIN_PERMISO_DE_TRANSFERENCIA}</MotivoDeshabilitado> : null}
          <Notice tone="info">{AVISO_COBROS_DE_CLIENTES}</Notice>
        </FormContainer>
      </ScrollView>
    </View>
  )
}
