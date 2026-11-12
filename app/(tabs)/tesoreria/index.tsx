import React from 'react'
import { ScrollView, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ArrowLeftRight, HandCoins, Landmark, Zap } from 'lucide-react-native'
import { usePuedePagarServicio } from '@/features/gastos/lib/permiso'
import { radii, space, useColors } from '@/libs/theme'
import { FormContainer, Notice, TopBar, useMenuLeading, useInsetInferior } from '@/core/ui/fw'
import { usePuedeCobrar, usePuedeTransferir } from '@/features/cuentas/lib/permiso'
import { MOTIVO_SIN_PERMISO_DE_SERVICIO, MOTIVO_SIN_PERMISO_DE_TRANSFERENCIA } from '@/core/ui/fw/MotivoDeshabilitado'
import { FilaDeTesoreria } from '@/features/tesoreria/components/FilaDeTesoreria'
import { usePuedeVerPagos } from '@/features/pagos/lib/permiso'

/** Aviso de la lámina tesoreria-inicio: el cobro de un cliente no se carga desde Tesorería. */
const AVISO_COBROS_DE_CLIENTES = 'Los cobros de clientes se cargan desde la ficha del cliente, con "Cobrar".'

/** El cheque no tiene alta propia: se carga como cobro de un cliente. */
const AYUDA_CHEQUE_COMO_COBRO = 'El cheque se carga como cobro de un cliente.'

/**
 * Tesorería en mobile (plan §3, recortada a acciones): transferencias entre cuentas propias. Los
 * cobros se registran desde la cuenta corriente del cliente; los cheques, en la web (bloque 12, D10).
 * Lámina tesoreria-inicio: "Pagar un servicio" va (L22, gastos). "Cargar un cheque" no tiene endpoint propio (no hay
 * `POST /cheques`): lleva al cobro de un cliente con el medio Cheque (regla A-1114: el cheque va en un cobro de un solo medio).
 */
export default function TesoreriaScreen() {
  const insetInferior = useInsetInferior()
  const c = useColors()
  const router = useRouter()
  const menu = useMenuLeading()
  const transferir = usePuedeTransferir()
  // POST /gastos (MOD_PAGOS:Create) y la lista de conceptos (MOD_PAGOS:Read + CAP_VER_TESORERIA).
  const pagarServicio = usePuedePagarServicio()
  // Misma regla que el botón "Cobrar" de la cuenta del cliente (CuentaCorrienteCliente): sin ella no se ofrece.
  const cargarCheque = usePuedeCobrar()
  // Como la ruta /finanzas/pagos de la web (MOD_PAGOS:Read + CAP_VER_TESORERIA): sin ella no se ofrece.
  const verPagos = usePuedeVerPagos()

  const separador = <View style={{ height: 1, backgroundColor: c.surface2, marginLeft: space[4] }} />
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Tesorería" leading={menu} />
      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: space[4] + insetInferior }}>
        <FormContainer style={{ gap: space[3] }}>
          {/* Propuesta "Finanzas como venta", frames 8 y 9: una tarjeta sin borde con las acciones separadas por una línea. */}
          <View testID="tarjeta-tesoreria" style={{ borderRadius: radii.tarjeta, backgroundColor: c.surface, overflow: 'hidden' }}>
            {/* Como la web (L13): sin permiso la fila no se oculta; lleva candado y el motivo adentro. */}
            <FilaDeTesoreria
              icon={ArrowLeftRight}
              title="Transferencia entre cuentas"
              subtitle="Mové plata entre tus cuentas"
              motivo={transferir ? undefined : MOTIVO_SIN_PERMISO_DE_TRANSFERENCIA}
              onPress={() => router.push('/(tabs)/tesoreria/transferencia')}
            />
            {separador}
            <FilaDeTesoreria
              icon={Zap}
              title="Pagar un servicio"
              subtitle="Luz, gas, alquiler, flete y otros gastos"
              motivo={pagarServicio ? undefined : MOTIVO_SIN_PERMISO_DE_SERVICIO}
              onPress={() => router.push('/(tabs)/tesoreria/pagar-servicio')}
            />
            {verPagos ? (
              <>
                {separador}
                <FilaDeTesoreria
                  icon={HandCoins}
                  title="Pagos"
                  subtitle="Pagos a proveedores y cobros de clientes"
                  onPress={() => router.push('/(tabs)/tesoreria/pagos')}
                />
              </>
            ) : null}
            {cargarCheque ? (
              <>
                {separador}
                <FilaDeTesoreria
                  icon={Landmark}
                  title="Cargar un cheque"
                  subtitle={AYUDA_CHEQUE_COMO_COBRO}
                  onPress={() => router.push({ pathname: '/(tabs)/cuentas', params: { cobrar: 'cheque' } })}
                />
              </>
            ) : null}
          </View>
          <Notice tone="info">{AVISO_COBROS_DE_CLIENTES}</Notice>
        </FormContainer>
      </ScrollView>
    </View>
  )
}
