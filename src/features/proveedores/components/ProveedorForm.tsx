import React from 'react'
import { ScrollView, View } from 'react-native'
import { useRouter } from 'expo-router'
import { radii, space, useColors } from '@/libs/theme'
import { Button, FormContainer, Notice, TopBar } from '@/core/ui/fw'
import { CampoDeSocio } from '@/features/socios/components/CampoDeSocio'
import { FilaBloqueada } from '@/features/socios/components/FilaBloqueada'
import { OpcionesRadio } from '@/features/socios/components/OpcionesRadio'
import { PieDeFormulario } from '@/features/socios/components/PieDeFormulario'
import { Seccion } from '@/features/socios/components/PiezasDeFicha'
import { Esqueletos, FORMULARIO_CARGANDO } from '@/features/clientes/components/Esqueletos'
import { CONDICIONES_IVA, TIPOS_PAGO } from '@/features/clientes/lib/cliente'
import { useProveedorForm } from '../hooks/useProveedorForm'
import { AVISO_CAMPOS_SENSIBLES_PROVEEDOR, AVISO_EDICION_PROVEEDOR } from '../lib/proveedor'

/** Un grupo de campos en una tarjeta sin borde con su título, como los del formulario de cliente (frames 15-17). */
function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <Seccion testID={`grupo-${titulo}`} titulo={titulo} holgada>{children}</Seccion>
}

/**
 * Alta (`id` ausente) y edición de un proveedor (láminas Nuevo proveedor y Editar proveedor), con el estilo del
 * formulario de cliente: una tarjeta por grupo, opciones con radio en tarjeta y lo que no se puede cambiar como
 * filas bloqueadas en una tarjeta propia. Lo que se guarda lo arma `useProveedorForm`, igual que antes.
 */
export function ProveedorForm({ id }: { id?: string }) {
  const c = useColors()
  const router = useRouter()
  const alGuardar = (nuevoId: string) => router.replace({ pathname: '/(tabs)/proveedores/[id]', params: { id: nuevoId } })
  const { datos, cambiar, guardar, error, editando, bloqueo, cargando, guardando, errorDeCarga, reintentar, guardado } = useProveedorForm(id, alGuardar)
  const hayBloqueo = bloqueo.razonSocial || bloqueo.cuit

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar
        title={editando ? 'Editar proveedor' : 'Nuevo proveedor'}
        subtitle={editando ? guardado?.razonSocial?.trim() || undefined : undefined}
        leading={{ kind: 'atras', onPress: () => router.back() }}
      />
      {errorDeCarga ? (
        <FormContainer style={{ padding: space[4], gap: space[4] }}>
          <Notice tone="peligro">{errorDeCarga}</Notice>
          <Button label="Reintentar" onPress={reintentar} />
        </FormContainer>
      ) : cargando ? (
        // Mientras carga no se muestra el formulario: esqueletos con la forma de las tarjetas (frame 20).
        <FormContainer style={{ padding: space[4] }}>
          <Esqueletos bloques={FORMULARIO_CARGANDO} />
        </FormContainer>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ paddingVertical: space[4] }} keyboardShouldPersistTaps="handled">
            <FormContainer style={{ paddingHorizontal: space[4], gap: space[4] }}>
              {hayBloqueo ? (
                // Lo que este usuario no cambia: filas bloqueadas en una tarjeta propia con el aviso (frame 19).
                <View testID="campos-bloqueados" style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[4], gap: space[3] }}>
                  <Notice tone="info">{AVISO_CAMPOS_SENSIBLES_PROVEEDOR}</Notice>
                  {bloqueo.razonSocial ? <FilaBloqueada etiqueta="Razón social" valor={datos.razonSocial.trim() || '—'} /> : null}
                  {bloqueo.cuit ? <FilaBloqueada etiqueta="CUIT" valor={datos.cuit.trim() || '—'} /> : null}
                </View>
              ) : null}

              <Grupo titulo="Datos fiscales">
                {!bloqueo.razonSocial ? (
                  <CampoDeSocio label="Razón social" value={datos.razonSocial} onChangeText={v => cambiar('razonSocial', v)} placeholder="Como figura en ARCA" />
                ) : null}
                {!bloqueo.cuit ? (
                  <CampoDeSocio label="CUIT" value={datos.cuit} onChangeText={v => cambiar('cuit', v)} keyboardType="number-pad" placeholder="30-12345678-9" />
                ) : null}
                <OpcionesRadio
                  enTarjeta
                  titulo="Condición frente al IVA"
                  opciones={CONDICIONES_IVA.map(v => ({ value: v, label: v }))}
                  valor={datos.condicionIva}
                  onChange={v => cambiar('condicionIva', v)}
                />
              </Grupo>

              <Grupo titulo="Contacto">
                <CampoDeSocio label="Teléfono" value={datos.telefono} onChangeText={v => cambiar('telefono', v)} keyboardType="phone-pad" placeholder="11 4555-0000" />
              </Grupo>

              <Grupo titulo="Condiciones de compra">
                <OpcionesRadio enTarjeta titulo="Condición de pago (obligatoria para comprarle)" opciones={TIPOS_PAGO} valor={datos.tipoPago} onChange={v => cambiar('tipoPago', v)} />
                {datos.tipoPago !== 'Contado' ? (
                  <CampoDeSocio
                    label={datos.tipoPago === 'DiaFijoDelMes' ? 'Día del mes' : 'Días'}
                    value={datos.plazo}
                    onChangeText={v => cambiar('plazo', v.replace(/\D/g, ''))}
                    keyboardType="number-pad"
                  />
                ) : null}
              </Grupo>

              {editando ? <Notice tone="info">{AVISO_EDICION_PROVEEDOR}</Notice> : null}
              {error ? <Notice tone="peligro">{error}</Notice> : null}
            </FormContainer>
          </ScrollView>
          <PieDeFormulario>
            <FormContainer>
              <Button label={editando ? 'Guardar cambios' : 'Guardar proveedor'} onPress={guardar} loading={guardando} />
            </FormContainer>
          </PieDeFormulario>
        </View>
      )}
    </View>
  )
}
