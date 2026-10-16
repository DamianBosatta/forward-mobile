import React, { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { Check } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, FormContainer, Notice, formatImporte } from '@/core/ui/fw'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { useCuentasPropias } from '@/features/cuentas/api/queries'
import { diaArgentina, formatToLocalTime } from '@/src/utils/date'
import { useChequesEnCartera, useDepositarCheques, type ChequeEnCartera, type ResultadoDeposito } from '../api/cheques'
import { ElegirCuenta } from './ElegirCuenta'

export const AVISO_ACREDITACION = 'El saldo del banco cambia cuando el cheque se acredita, no al depositarlo. Hasta entonces figura como «Depositado».'

const nombreCheque = (k: ChequeEnCartera) => `${k.banco} · N.º ${k.numero}`
const diferido = (k: ChequeEnCartera) => diaArgentina(Date.parse(k.fechaPago)) > diaArgentina(Date.now())

/**
 * Cliente que entregó el cheque (forward-system #897): el nombre ya viene resuelto por el servidor
 * (fantasía o, si no, razón social) y la dirección es lo que identifica al cliente en la app.
 * Cada uno se muestra solo si viene con texto; un servidor anterior no manda ninguno.
 */
const origenDelCheque = (k: ChequeEnCartera) => ({
  nombre: k.socioComercialOrigenNombre?.trim() || null,
  direccion: k.socioComercialOrigenDireccion?.trim() || null,
})

/** Qué pasó con cada cheque: nunca un éxito parcial callado. */
function Resultado({ resultados }: { resultados: ResultadoDeposito[] }) {
  const ok = resultados.filter(r => !r.error)
  const mal = resultados.filter(r => r.error)
  if (mal.length === 0) return <Notice tone="exito" title="Cheques depositados">{ok.map(r => nombreCheque(r.cheque)).join('\n')}</Notice>
  // El lote se rechazó entero (todo o nada): un solo motivo del servidor, que ya dice qué cheque falló.
  if (ok.length === 0 && mal.every(r => r.error === mal[0].error)) {
    return <Notice tone="peligro" title="No se depositó ningún cheque">{mensajeDelServidor(mal[0].error, 'no se pudo depositar.')}</Notice>
  }
  return (
    <View style={{ gap: space[2] }}>
      <Notice tone="peligro" title={`No se depositaron ${mal.length} de ${resultados.length}`}>
        {mal.map(r => `${nombreCheque(r.cheque)}: ${mensajeDelServidor(r.error, 'no se pudo depositar.')}`).join('\n')}
      </Notice>
      {ok.length > 0 ? <Notice tone="exito" title="Sí se depositaron">{ok.map(r => nombreCheque(r.cheque)).join('\n')}</Notice> : null}
    </View>
  )
}

/** Depositar cheques de terceros en cartera en una cuenta propia (lámina DepositoCheques). */
export function DepositoCheques() {
  const c = useColors()
  const cartera = useChequesEnCartera()
  const cuentas = useCuentasPropias()
  const depositar = useDepositarCheques()
  const [elegidos, setElegidos] = useState<string[]>([])
  const [cuenta, setCuenta] = useState<string | null>(null)
  const cheques = cartera.data?.pages.flatMap(p => p.items ?? []) ?? []
  const total = cartera.data?.pages[0]?.totalCount ?? cheques.length

  const alternar = (id: string) => setElegidos(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]))
  const enviar = () => {
    if (!cuenta || elegidos.length === 0 || depositar.isPending) return
    depositar.mutate(
      { cheques: cheques.filter(k => elegidos.includes(k.id)), cuentaDestinoId: cuenta },
      // Quedan elegidos solo los que fallaron: para reintentarlos sin volver a buscarlos.
      { onSuccess: resultados => setElegidos(p => p.filter(id => resultados.some(r => r.cheque.id === id && r.error))) },
    )
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space[4] }}>
      <FormContainer style={{ gap: space[4] }}>
        {depositar.data ? <Resultado resultados={depositar.data} /> : null}
        {cartera.isLoading ? <ActivityIndicator color={c.brandInk} /> : null}
        {cartera.error ? <Notice tone="peligro">{mensajeDelServidor(cartera.error, 'No se pudo cargar la cartera.')}</Notice> : null}
        {!cartera.isLoading && !cartera.error && cheques.length === 0 ? (
          <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>No hay cheques de terceros en cartera.</Text>
        ) : null}

        {cheques.map(k => {
          const elegido = elegidos.includes(k.id)
          const cuando = `${diferido(k) ? 'Pago diferido' : 'Al día'} · ${formatToLocalTime(k.fechaPago, 'd MMM')}`
          const origen = origenDelCheque(k)
          const etiqueta = [nombreCheque(k), formatImporte(k.montoAmount), cuando, origen.nombre && `de ${origen.nombre}`, origen.direccion].filter(Boolean).join(', ')
          return (
            <Pressable
              key={k.id}
              accessibilityRole="checkbox"
              accessibilityLabel={etiqueta}
              accessibilityState={{ checked: elegido }}
              onPress={() => alternar(k.id)}
              style={{
                minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3],
                borderRadius: radii.tarjeta, backgroundColor: elegido ? c.brandSoft : c.surface, borderWidth: elegido ? 2 : 0, borderColor: c.brand,
              }}
            >
              <View style={{ width: 24, height: 24, borderRadius: radii.campo, borderWidth: 2, borderColor: elegido ? c.brandInk : c.border, alignItems: 'center', justifyContent: 'center' }}>
                {elegido ? <Check size={16} color={c.brandInk} /> : null}
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: space[1] }}>
                <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{nombreCheque(k)}</Text>
                <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`${k.titular} · ${cuando}`}</Text>
                {origen.nombre ? <Text style={{ ...typeScale.secundario, color: c.text }}>{`De ${origen.nombre}`}</Text> : null}
                {origen.direccion ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{origen.direccion}</Text> : null}
              </View>
              <Text style={[typeScale.cuerpoDestacado, importe, { color: c.text }]}>{formatImporte(k.montoAmount)}</Text>
            </Pressable>
          )
        })}

        {cheques.length > 0 ? (
          <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`Mostrando ${cheques.length} de ${total}`}</Text>
        ) : null}
        {cartera.hasNextPage ? (
          <Button label="Cargar más cheques" variant="secundario" loading={cartera.isFetchingNextPage} disabled={cartera.isFetchingNextPage} onPress={() => cartera.fetchNextPage()} />
        ) : null}

        {cuentas.error ? <Notice tone="peligro">{mensajeDelServidor(cuentas.error, 'No se pudieron cargar las cuentas.')}</Notice> : null}
        <ElegirCuenta titulo="Depositar en" cuentas={(cuentas.data ?? []).filter(k => !k.esCuentaCarteraCheques)} valor={cuenta} onCambio={setCuenta} />
        <Notice tone="info">{AVISO_ACREDITACION}</Notice>
        <Button
          label={elegidos.length === 1 ? 'Depositar 1 cheque' : `Depositar ${elegidos.length} cheques`}
          disabled={!cuenta || elegidos.length === 0 || depositar.isPending}
          loading={depositar.isPending}
          onPress={enviar}
        />
      </FormContainer>
    </ScrollView>
  )
}
