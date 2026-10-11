import React from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { space, typeScale, useColors } from '@/libs/theme'
import { Button, FormContainer, TopBar, useMenuLeading } from '@/core/ui/fw'
import { usePermissions } from '@/core/auth/RequirePermission'
import { ROLES_CARTERA } from '@/features/tesoreria/api/cheques'

/**
 * Tesorería en mobile (plan §3, recortada a acciones): transferencias entre cuentas propias y, con
 * su permiso, depósito de cheques. Los cobros se registran desde la cuenta corriente del cliente.
 */
export default function TesoreriaScreen() {
  const c = useColors()
  const router = useRouter()
  const menu = useMenuLeading()
  const { canCreate, canRead, canUpdate, hasRole } = usePermissions()
  // Las dos pantallas listan las cuentas propias (MOD_CC:Read); la transferencia además pide los tipos
  // de movimiento (GET /movimientos-internos/tipos, MOD_PAGOS:Read) y la cartera también MOD_PAGOS:Read.
  const verCuentas = canRead('MOD_CC')
  const transferir = canCreate('MOD_PAGOS') && canRead('MOD_PAGOS') && verCuentas
  // El servidor deja operar la cartera de cheques solo a estos roles y con MOD_PAGOS:Update.
  const depositar = ROLES_CARTERA.some(r => hasRole(r)) && canUpdate('MOD_PAGOS') && canRead('MOD_PAGOS') && verCuentas

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Tesorería" subtitle="Transferencias y cheques" leading={menu} />
      <ScrollView contentContainerStyle={{ padding: space[4] }}>
        <FormContainer style={{ gap: space[4] }}>
          {transferir ? (
            <Button label="Transferencia entre cuentas" onPress={() => router.push('/(tabs)/tesoreria/transferencia')} />
          ) : null}
          {depositar ? (
            <Button label="Depositar cheques" variant="secundario" onPress={() => router.push('/(tabs)/tesoreria/cheques')} />
          ) : null}
          {!transferir && !depositar ? (
            <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>No tenés acciones de tesorería habilitadas.</Text>
          ) : null}
          <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
            Los cobros se registran desde la cuenta corriente de cada cliente.
          </Text>
        </FormContainer>
      </ScrollView>
    </View>
  )
}
