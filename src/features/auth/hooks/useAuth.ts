import { useState, useRef, useCallback } from 'react';
import { useAuthStore, parsePermissionsFromArray } from '../store/auth.store';
import { configureApiClient, API_URL } from '@/core/api/client';
import { useQueryClient } from '@tanstack/react-query';
import { realtimeClient } from '@/libs/api-client/realtime';

// ─────────────────────────────────────────────────────────────────────────────
// Login Rate Limiting — Previene ataques de fuerza bruta desde el cliente
// Max 5 intentos, luego bloqueo de 30 segundos con backoff exponencial
// ─────────────────────────────────────────────────────────────────────────────
const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 30_000
const BASE_DELAY_MS = 1000

export function useAuth() {
  const { setTokens, setUser, logout: clearAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rate limiting state
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const lastAttemptRef = useRef<number>(0);

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;
  const lockRemainingMs = isLocked ? (lockedUntil! - Date.now()) : 0;

  /** 
   * Refresca el perfil y permisos del usuario actual.
   * Útil cuando se cambia de pantalla o se rehidrata la app.
   */
  const refreshPermissions = useCallback(async (token?: string): Promise<boolean> => {
    const accessToken = token ?? useAuthStore.getState().accessToken;
    if (!accessToken) return false;

    try {
      const [profileRes, permissionsRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/users/me?t=${Date.now()}`, {
          headers: { 
            Authorization: `Bearer ${accessToken}`,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
        }),
        fetch(`${API_URL}/api/v1/users/me/permissions?t=${Date.now()}`, {
          headers: { 
            Authorization: `Bearer ${accessToken}`,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
        })
      ]);

      if (profileRes.ok && permissionsRes.ok) {
        const profile = await profileRes.json();
        const permissionsData = await permissionsRes.json();
        
        const rawPermissions = permissionsData.permissions ?? permissionsData.Permissions ?? [];
        const parsedPermissions = parsePermissionsFromArray(rawPermissions);

        setUser({
          ...profile,
          username: profile.username ?? profile.email ?? profile.userName ?? profile.UserName ?? '',
          nombre: profile.nombre ?? profile.Nombre,
          apellido: profile.apellido ?? profile.Apellido,
          roles: profile.roles ?? profile.Roles ?? [],
          permissions: parsedPermissions,
        });
        return true;
      }
      return false;
    } catch (err) {
      console.error("[useAuth] Failed to refresh permissions:", err);
      return false;
    }
  }, [setUser]);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    // ── Rate limit check ──
    if (isLocked) {
      const secs = Math.ceil(lockRemainingMs / 1000);
      setError(`Demasiados intentos. Esperá ${secs} segundos.`);
      return false;
    }

    // Backoff entre intentos
    const now = Date.now();
    const delay = failedAttempts > 0 ? BASE_DELAY_MS * Math.pow(2, failedAttempts - 1) : 0;
    const timeSinceLastAttempt = now - lastAttemptRef.current;
    if (delay > 0 && timeSinceLastAttempt < delay) {
      const waitSecs = Math.ceil((delay - timeSinceLastAttempt) / 1000);
      setError(`Esperá ${waitSecs} segundo${waitSecs > 1 ? 's' : ''} antes de reintentar.`);
      return false;
    }

    setIsLoading(true);
    setError(null);
    lastAttemptRef.current = Date.now();

    try {
      const body = new URLSearchParams({
        grant_type: 'password',
        username: username.trim(),
        password: password.trim(),
        client_id: 'forward_mobile',
        scope: 'openid profile email roles offline_access',
      }).toString();

      const tokenRes = await fetch(`${API_URL}/connect/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({}));
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);

        if (newAttempts >= MAX_ATTEMPTS) {
          setLockedUntil(Date.now() + LOCKOUT_DURATION_MS);
          setTimeout(() => {
            setLockedUntil(null);
            setFailedAttempts(0);
          }, LOCKOUT_DURATION_MS);
        }

        // Traducción de errores amigable
        let friendlyError = 'Credenciales inválidas.';
        const errDesc = (err?.error_description || err?.error || '').toLowerCase();
        
        if (errDesc.includes('invalid_grant')) {
          friendlyError = 'Usuario o contraseña incorrectos.';
        } else if (errDesc.includes('inactive') || errDesc.includes('not active') || errDesc.includes('desactivado') || errDesc.includes('inactive')) {
          friendlyError = 'El usuario se encuentra inactivo. Contactá al administrador.';
        } else if (errDesc.includes('locked')) {
          friendlyError = 'La cuenta se encuentra bloqueada.';
        } else if (errDesc) {
          friendlyError = err?.error_description || err?.error;
        }

        throw new Error(friendlyError);
      }

      const tokens = await tokenRes.json();
      setFailedAttempts(0);
      setLockedUntil(null);

      setTokens({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? '',
      });

      // Configurar el cliente HTTP
      configureApiClient({
        getToken: () => useAuthStore.getState().accessToken,
        getRefreshToken: () => useAuthStore.getState().refreshToken,
        onTokensRefreshed: (newTokens) => {
          useAuthStore.getState().setTokens(newTokens);
        },
        onUnauthorized: () => {
          useAuthStore.getState().logout();
        },
      });

      // Cargar perfil y permisos inmediatamente
      await refreshPermissions(tokens.access_token);

      setIsLoading(false);
      return true;
    } catch (err: any) {
      setIsLoading(false);
      setError(err?.message ?? 'No se pudo conectar al servidor.');
      return false;
    }
  }, [failedAttempts, isLocked, lockRemainingMs, setTokens, refreshPermissions]);

  const queryClient = useQueryClient();

  const logout = useCallback(() => {
    clearAuth();
    queryClient.clear();
    realtimeClient.disconnect().catch(() => {});
  }, [clearAuth, queryClient]);

  return {
    login,
    logout,
    refreshPermissions,
    isLoading,
    error,
    failedAttempts,
    isLocked,
    lockRemainingMs,
  };
}
