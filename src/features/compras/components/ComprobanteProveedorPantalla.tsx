import React, { useEffect, useState } from 'react'
import { Modal, ScrollView, Text, View } from 'react-native'
import { Camera } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, FormContainer, Notice, PieFijo, TopBar } from '@/core/ui/fw'
import { FotoDelCobro } from '@/features/cuentas/components/FotoDelCobro'
import { subirComprobanteCobro } from '@/features/cuentas/api/fotos'
import { armarComprobante, resumenComprobante, type ComprobanteCompraInput, type FormComprobante } from '../lib/comprobante'
import { ComprobanteCampos } from './ComprobanteCampos'

export interface ComprobanteCargado {
  form: FormComprobante
  comprobante: ComprobanteCompraInput
  fotoUrl: string | null
}

/** "Factura A 00004-00012345" del comprobante recién cargado (aún sin guardar en el servidor). */
export const resumenDeCargado = ({ comprobante: c }: ComprobanteCargado) =>
  resumenComprobante({ tipo: c.tipo ?? 'Factura', letra: c.letra ?? 'A', puntoVenta: c.puntoVenta ?? 0, numero: c.numero ?? 0 })

interface Props {
  visible: boolean
  /** Lo ya cargado (o el formulario nuevo con el proveedor precargado). */
  form: FormComprobante
  fotoUrl: string | null
  onVolver: () => void
  /** Recibe el comprobante armado; si lo guarda el servidor, el error vuelve por `error`. */
  onGuardar: (c: ComprobanteCargado) => void
  guardando?: boolean
  error?: string | null
}

/**
 * "Comprobante del proveedor" (maqueta "Compras como venta", frame 16; venta no carga facturas de terceros): la foto de la
 * factura arriba y, debajo, los datos como figuran en el papel. Neto e IVA solo con letra A. Se abre desde el paso 4, desde
 * "Compra guardada" y desde "Recibir mercadería". La foto se sube en el acto (como la del cobro); el comprobante se arma
 * con `armarComprobante` y, si falta algo, dice qué.
 */
export function ComprobanteProveedorPantalla({ visible, form: inicial, fotoUrl: fotoInicial, onVolver, onGuardar, guardando = false, error = null }: Props) {
  if (!visible) return null
  return <Contenido form={inicial} fotoUrl={fotoInicial} onVolver={onVolver} onGuardar={onGuardar} guardando={guardando} error={error} />
}

function Contenido({ form: inicial, fotoUrl: fotoInicial, onVolver, onGuardar, guardando, error }: Omit<Props, 'visible'>) {
  const c = useColors()
  const [form, setForm] = useState(inicial)
  const [fotoUrl, setFotoUrl] = useState(fotoInicial)
  const [subiendo, setSubiendo] = useState(false)
  const [falta, setFalta] = useState<string | null>(null)
  // El CUIT del proveedor puede llegar después de abrir la pantalla: se precarga cuando está.
  useEffect(() => {
    if (inicial.cuit) setForm((f) => (f.cuit ? f : { ...f, cuit: inicial.cuit }))
  }, [inicial.cuit])
  const guardar = () => {
    const armado = armarComprobante(form)
    if ('error' in armado) return void setFalta(armado.error)
    setFalta(null)
    onGuardar({ form, comprobante: armado.comprobante, fotoUrl })
  }
  const secundario = { ...typeScale.secundario, color: c.textSecondary }

  return (
    <Modal visible animationType="slide" onRequestClose={() => { if (!guardando) onVolver() }} statusBarTranslucent navigationBarTranslucent>
      <View accessibilityLabel="Comprobante del proveedor" style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar title="Comprobante del proveedor" leading={{ kind: 'atras', onPress: () => { if (!guardando) onVolver() } }} />
        <ScrollView contentContainerStyle={{ padding: space[4] }} keyboardShouldPersistTaps="handled">
          <FormContainer style={{ gap: space[3] }}>
          <Text style={secundario}>Como figura en el papel. Las percepciones y varias alícuotas se cargan en la web.</Text>
          <View style={{ alignItems: 'center', gap: space[2], padding: space[4], borderRadius: radii.tarjeta, borderWidth: 1, borderStyle: 'dashed', borderColor: c.textSecondary, backgroundColor: c.surface }}>
            <Camera size={32} color={c.textSecondary} />
            <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>Foto de la factura</Text>
            <Text style={secundario}>Opcional. Ayuda a revisar los datos.</Text>
            <View style={{ alignSelf: 'stretch' }}>
              <FotoDelCobro que="de la factura" url={fotoUrl} subir={subirComprobanteCobro} onUrl={setFotoUrl} onSubiendo={setSubiendo} />
            </View>
          </View>
          <ComprobanteCampos form={form} onCambio={setForm} />
          {falta ? <Notice tone="peligro">{falta}</Notice> : null}
          {error ? <Notice tone="peligro">{error}</Notice> : null}
          </FormContainer>
        </ScrollView>
        <PieFijo>
          <Button label="Guardar comprobante" loading={guardando} disabled={subiendo || guardando} onPress={guardar} />
        </PieFijo>
      </View>
    </Modal>
  )
}
