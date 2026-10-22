import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Check } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { FotoEntrega } from './FotoEntrega'

interface Props {
  firmar: boolean
  onFirmar: (firmar: boolean) => void
  url: string | null
  onUrl: (url: string) => void
  onSubiendo: (subiendo: boolean) => void
}

/**
 * Lámina CobroFirma: la firma no es un medio de pago, es la parte que no se cobra y queda en la cuenta
 * corriente. Va siempre con su foto. Nunca frena la entrega (lo marca el servidor para administración).
 */
export function FirmaEnEntrega({ firmar, onFirmar, url, onUrl, onSubiendo }: Props) {
  const c = useColors()
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[4], gap: space[3] }}>
      <Pressable
        onPress={() => onFirmar(!firmar)}
        accessibilityRole="checkbox"
        accessibilityLabel="Firma del cliente"
        accessibilityState={{ checked: firmar }}
        style={{ minHeight: space[12], flexDirection: 'row', alignItems: 'center', gap: space[3] }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: radii.campo,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: firmar ? c.brand : c.surface,
            borderWidth: firmar ? 0 : 2,
            borderColor: c.textSecondary,
          }}
        >
          {firmar ? <Check size={16} color={c.surface} strokeWidth={3} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>Firma</Text>
          <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Queda en su cuenta corriente · foto obligatoria</Text>
        </View>
      </Pressable>
      {firmar ? (
        <>
          <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
            Firmar deja deuda nueva en su cuenta corriente. Aunque sea de contado o pase su tope, la entrega sigue: administración lo arregla con el cliente.
          </Text>
          <FotoEntrega que="de la firma del cliente" url={url} onUrl={onUrl} onSubiendo={onSubiendo} />
        </>
      ) : null}
    </View>
  )
}
