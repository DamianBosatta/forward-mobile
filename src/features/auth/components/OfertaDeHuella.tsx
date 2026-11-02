import { useState } from 'react'
import { ConfirmModal } from '@/core/ui/ConfirmModal'
import { useAuthStore } from '../store/auth.store'
import { useOfertaDeHuella } from '../store/ofertaDeHuella.store'
import { acceptBiometricLogin, declineBiometricLogin } from '../utils/biometrics'

/**
 * After the first password login, asks whether to enter with the fingerprint next time (audit tranche 1, S2).
 * Mounted once in `app/_layout.tsx`; only shows while the session is open and an offer is pending.
 */
export function OfertaDeHuella() {
  const pendiente = useOfertaDeHuella((s) => s.pendiente)
  const descartar = useOfertaDeHuella((s) => s.descartar)
  const conSesion = useAuthStore((s) => s.isAuthenticated)
  const [guardando, setGuardando] = useState(false)

  const aceptar = async () => {
    if (!pendiente) return
    setGuardando(true)
    try {
      await acceptBiometricLogin(pendiente)
    } finally {
      setGuardando(false)
      descartar()
    }
  }

  const rechazar = async () => {
    if (!pendiente) return
    descartar()
    await declineBiometricLogin(pendiente.username)
  }

  return (
    <ConfirmModal
      visible={conSesion && pendiente !== null}
      variant="primary"
      title="¿Querés entrar con huella la próxima vez?"
      message="Guardamos tu usuario y tu contraseña en este teléfono, protegidos con tu huella o el bloqueo del teléfono. Al cerrar sesión se borran."
      confirmLabel="Sí, usar huella"
      cancelLabel="Ahora no"
      loading={guardando}
      onConfirm={() => { void aceptar() }}
      onCancel={() => { void rechazar() }}
    />
  )
}
