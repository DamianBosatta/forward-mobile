import { create } from 'zustand';
import type { BiometricCredentials } from '../utils/biometrics';

/**
 * The question "¿Querés entrar con huella la próxima vez?" waiting for an answer (audit tranche 1, S2). The login
 * screen leaves it here because it unmounts as soon as the session opens; `OfertaDeHuella` asks it. Memory only:
 * the password is never persisted here, and logout drops it.
 */
interface OfertaDeHuellaState {
  pendiente: BiometricCredentials | null;
  ofrecer: (creds: BiometricCredentials) => void;
  descartar: () => void;
}

export const useOfertaDeHuella = create<OfertaDeHuellaState>((set) => ({
  pendiente: null,
  ofrecer: (creds) => set({ pendiente: creds }),
  descartar: () => set({ pendiente: null }),
}));
