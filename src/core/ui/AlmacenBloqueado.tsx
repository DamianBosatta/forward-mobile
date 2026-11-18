import React, { useEffect, useRef, useState } from 'react'
import { DevSettings, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as SplashScreen from 'expo-splash-screen'
import { space, useColors } from '@/libs/theme'
import { logger } from '@/core/utils/logger'
import {
  quedoUnReinicioAMedias,
  reiniciarAlmacen,
  sePuedeAbrirElAlmacen,
  type MotivoDeBloqueo,
  type ResultadoDelReinicio,
} from '@/core/utils/storage'
import { cerrarSesion } from '@/features/auth/lib/cerrarSesion'
import { ConfirmModal } from './ConfirmModal'
import { Button } from './fw/Button'
import { EstadoDePantalla } from './fw/EstadoDePantalla'
import { Notice } from './fw/Notice'

const TITULO = 'No pudimos abrir lo guardado en el teléfono'
/**
 * Nothing can tell how many operations are pending without the key: every queue lives in the encrypted file and no
 * plain counter exists. So the loss is said in general, never with an invented number.
 */
const TEXTO =
  'Pasa cuando se restaura una copia de seguridad o se cambia el bloqueo de pantalla. Para seguir usando la app hay que empezar de nuevo: se borra lo guardado en el teléfono y se vuelve a iniciar sesión. Lo que todavía no se envió al servidor se pierde (ventas, entregas y cobros cargados sin señal) y hay que volver a cargarlo. Si acabás de prender el teléfono, probá antes con Reintentar.'
const TEXTO_YA_REINICIADO = 'Ya se borró lo guardado, pero la app no se pudo reiniciar sola. Cerrá la app y volvé a abrirla.'

/** What went wrong with the last action, if anything. */
export type AvisoDeRecuperacion = 'reintento-fallido' | 'sin-guardar' | 'sin-leer'

const AVISO: Record<AvisoDeRecuperacion, string> = {
  'reintento-fallido': 'Todavía no se pudo. Esperá unos segundos y tocá Reintentar; si sigue igual, reiniciá el teléfono.',
  'sin-guardar':
    'No se pudo empezar de nuevo: el teléfono no dejó guardar una clave nueva. No se borró nada. Reiniciá el teléfono y probá otra vez.',
  'sin-leer':
    'No se pudo terminar: el teléfono no deja leer la clave nueva. Lo que estaba guardado en el teléfono ya no se puede recuperar. Reiniciá el teléfono y tocá Reintentar para terminar.',
}

interface AlmacenBloqueadoVistaProps {
  aviso: AvisoDeRecuperacion | null
  /** Empezar de nuevo already ran but the app did not reload: only reopening the app is left. */
  yaReiniciado: boolean
  confirmando: boolean
  procesando: boolean
  onEmpezarDeNuevo: () => void
  onConfirmar: () => void
  onCancelar: () => void
  onReintentar: () => void
}

/** SEG-01 recovery: what happened, what is lost, Empezar de nuevo (asks first) and Reintentar. */
export function AlmacenBloqueadoVista({
  aviso,
  yaReiniciado,
  confirmando,
  procesando,
  onEmpezarDeNuevo,
  onConfirmar,
  onCancelar,
  onReintentar,
}: AlmacenBloqueadoVistaProps) {
  const c = useColors()
  const insets = useSafeAreaInsets()
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Scrolls: the long text at a large system font size must not push the buttons off the screen. */}
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top, paddingBottom: insets.bottom + space[6] }}>
        <EstadoDePantalla tipo="sinPermiso" titulo={TITULO} texto={yaReiniciado ? TEXTO_YA_REINICIADO : TEXTO} />
        {yaReiniciado ? null : (
          // Same column on phone and tablet: a readable width, centered.
          <View style={{ width: '100%', maxWidth: 480, alignSelf: 'center', gap: space[3], paddingHorizontal: space[6] }}>
            {aviso ? <Notice tone="advertencia">{AVISO[aviso]}</Notice> : null}
            {/* Reintentar first: it never deletes anything, and an unreadable Keystore can be transient. */}
            <Button label="Reintentar" onPress={onReintentar} disabled={procesando} />
            <Button label="Empezar de nuevo" variant="peligroContorno" onPress={onEmpezarDeNuevo} disabled={procesando} />
          </View>
        )}
      </ScrollView>
      <ConfirmModal
        visible={confirmando}
        variant="danger"
        title="¿Empezar de nuevo?"
        message="Se borra lo guardado en el teléfono y se cierra la sesión. Lo que todavía no se envió al servidor se pierde y no se puede recuperar."
        confirmLabel="Borrar y empezar"
        cancelLabel="Cancelar"
        loading={procesando}
        onConfirm={onConfirmar}
        onCancel={onCancelar}
      />
    </View>
  )
}

/** Reloads the JS bundle so every store reads the real file from the start. */
function recargarLaApp(alFallar: () => void) {
  try {
    // Optional native module, as in perfil/lib/version.ts: absent in a dev client without expo-updates.
    const Updates = require('expo-updates') as typeof import('expo-updates')
    Updates.reloadAsync().catch((e) => {
      // DevSettings.reload does nothing in a release build: say it did not work instead.
      logger.error(new Error(`Encrypted storage reload failed: ${e instanceof Error ? e.message : 'unknown'}`))
      alFallar()
    })
  } catch {
    DevSettings.reload()
  }
}

/**
 * Shown instead of the whole app while the encrypted storage is blocked. Reports it once to Sentry (only the reason,
 * never the key). Reintentar reloads the app only if the key reads now. Empezar de nuevo asks first and, confirmed,
 * replaces the file with an empty one on a new key (`reiniciarAlmacen`), closes the session as a forced logout and
 * reloads the app, which opens on the login.
 */
export function AlmacenBloqueado({ motivo }: { motivo: MotivoDeBloqueo }) {
  const [aviso, setAviso] = useState<AvisoDeRecuperacion | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [yaReiniciado, setYaReiniciado] = useState(false)
  // A second tap on the confirm button before the state updates must not write a second key.
  const enCurso = useRef(false)

  useEffect(() => {
    // The app never renders its own screens here, so the splash would stay up.
    SplashScreen.hideAsync().catch(() => {})
    // Storage opens at import, before Sentry.init: the report goes out once the app mounts.
    logger.error(new Error(`Encrypted storage blocked: ${motivo}`))
  }, [motivo])

  const reintentar = () => {
    // After `sin-leer` the old key is gone: Reintentar finishes the reset, never reloads into the old data.
    const aMedias = quedoUnReinicioAMedias()
    if (!sePuedeAbrirElAlmacen()) {
      setAviso(aMedias ? 'sin-leer' : 'reintento-fallido')
      return
    }
    if (aMedias) {
      void empezarDeNuevo()
      return
    }
    recargarLaApp(() => setAviso('reintento-fallido'))
  }

  const terminar = (siguiente: () => void) => {
    enCurso.current = false
    setProcesando(false)
    setConfirmando(false)
    siguiente()
  }

  const empezarDeNuevo = async () => {
    if (enCurso.current) return
    enCurso.current = true
    setProcesando(true)
    let resultado: ResultadoDelReinicio
    try {
      resultado = reiniciarAlmacen()
    } catch (e) {
      // Unexpected: the reset threw before deleting anything. The buttons come back and the notice says so.
      logger.error(new Error(`Storage reset failed: ${e instanceof Error ? e.message : 'unknown'}`))
      terminar(() => setAviso(quedoUnReinicioAMedias() ? 'sin-leer' : 'sin-guardar'))
      return
    }
    if (resultado === 'sin-guardar' || resultado === 'sin-leer') {
      terminar(() => setAviso(resultado))
      return
    }
    if (resultado === 'reiniciado') {
      // After the reset, never before: a Keystore that takes no key leaves the session and the fingerprint as they
      // were. A failure here does not stop the reload, which opens on the new empty file anyway.
      try {
        await cerrarSesion({ forzado: true })
      } catch (e) {
        logger.error(new Error(`Logout after storage reset failed: ${e instanceof Error ? e.message : 'unknown'}`))
      }
    }
    // `se-abre`: the key reads again and no key was written, so the reload recovers everything instead of wiping it.
    recargarLaApp(() =>
      terminar(() => (resultado === 'reiniciado' ? setYaReiniciado(true) : setAviso('reintento-fallido'))),
    )
  }

  return (
    <AlmacenBloqueadoVista
      aviso={aviso}
      yaReiniciado={yaReiniciado}
      confirmando={confirmando}
      procesando={procesando}
      onEmpezarDeNuevo={() => setConfirmando(true)}
      onConfirmar={() => void empezarDeNuevo()}
      onCancelar={() => setConfirmando(false)}
      onReintentar={reintentar}
    />
  )
}
