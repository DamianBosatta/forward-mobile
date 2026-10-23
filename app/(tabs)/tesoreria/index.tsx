import React from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { space, typeScale, useColors } from '@/libs/theme'
import { Button, FormContainer, TopBar, useMenuLeading } from '@/core/ui/fw'
import { usePermissions } from '@/core/auth/RequirePermission'

/**
 * Tesorería en mobile (plan §3, recortada a acciones): transferencias entre cuentas propias. Los
 * cobros se registran desde la cuenta corriente del cliente; los cheques, en la web (bloque 12, D10).
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
      <TopBar title="Tesorería" subtitle="Transferencias" leading={menu} />
      <ScrollView contentContainerStyle={{ padding: space[4] }}>
        <FormContainer style={{ gap: space[4] }}>
          {transferir ? (
            <Button label="Transferencia entre cuentas" onPress={() => router.push('/(tabs)/tesoreria/transferencia')} />
          ) : null}
          {!transferir ? (
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
