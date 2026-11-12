/**
 * Ingreso (bloque 12, T2: lienzo M1 y TM13; D11; reglas mobile §15): usuario y contraseña o
 * huella, y el selector de servidor solo en la build de desarrollo.
 */
import React from 'react';
import { act } from '@testing-library/react-native';
import { render, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginScreen from '../../../../../app/login';
import { useAuth } from '../../hooks/useAuth';
import { useOfertaDeHuella } from '../../store/ofertaDeHuella.store';
import { themeColors, useThemeStore } from '@/libs/theme';

// LoginScreen uses useQueryClient() (to clear cache on API env switch), so it
// must render inside a QueryClientProvider.
const renderLogin = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LoginScreen />
    </QueryClientProvider>
  );
};

// El ingreso usa la marca FWD real (la de la web): si renderiza el logo viejo, falla.
jest.mock('@/core/ui/ForwardLogo', () => ({ ForwardLogo: () => { throw new Error('ForwardLogo viejo'); } }));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace })
}));
jest.mock('@/core/utils/haptics', () => ({ safeHaptics: { impact: jest.fn(), notification: jest.fn(), selection: jest.fn() } }));

let mockResponsive = { isTablet: false };
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => mockResponsive }));

let mockRed: (e: { isConnected: boolean | null; isInternetReachable: boolean | null }) => void = () => {};
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: (cb: typeof mockRed) => { mockRed = cb; return () => {}; } },
}));

jest.mock('../../hooks/useAuth', () => ({
  useAuth: jest.fn()
}));

const mockBio = {
  available: false,
  saved: false,
  choice: null as 'enabled' | 'disabled' | null,
};
const mockSaveCredentials = jest.fn();
const mockAuthenticate = jest.fn();
jest.mock('../../utils/biometrics', () => ({
  isBiometricsAvailable: async () => mockBio.available,
  hasSavedCredentials: async () => mockBio.saved,
  getBiometricChoice: async () => mockBio.choice,
  getBiometricChoiceFor: async () => mockBio.choice,
  isBiometricLoginEnabled: async () => mockBio.choice === 'enabled',
  saveCredentials: (c: unknown) => mockSaveCredentials(c),
  authenticateWithBiometrics: () => mockAuthenticate(),
}));

function auth(extra: object = {}) {
  const login = jest.fn().mockResolvedValue(true);
  (useAuth as jest.Mock).mockReturnValue({ login, isLoading: false, error: null, isLocked: false, failedAttempts: 0, ...extra });
  return login;
}

const usuario = () => screen.getByLabelText('Usuario o email');
const contrasena = () => screen.getByLabelText('Contraseña');
const ingresar = () => screen.getByRole('button', { name: 'Ingresar' });

beforeEach(() => {
  jest.clearAllMocks();
  mockBio.available = false;
  mockBio.saved = false;
  mockBio.choice = null;
  useOfertaDeHuella.getState().descartar();
  mockResponsive = { isTablet: false };
  mockAuthenticate.mockResolvedValue(null);
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  useThemeStore.setState({ mode: 'light' });
});

const estiloCon = (el: { parent: any }, clave: string) => {
  let n = el.parent;
  while (n && !(n.props.style && [].concat(n.props.style).flat().some((x: any) => x && x[clave] !== undefined))) n = n.parent;
  return [].concat(n.props.style).flat().find((x: any) => x && x[clave] !== undefined) as any;
};
const plano = (style: unknown) => Object.assign({}, ...[style].flat(Infinity as 1).filter(Boolean));

describe('Ingreso', () => {
  it('muestra la marca (logo FWD real al lado de "Forward"), el título y la frase de la variante A', () => {
    auth();
    renderLogin();
    expect(screen.getByRole('header', { name: 'Ingresá a tu cuenta' })).toBeTruthy();
    expect(screen.getByText('Usá el mismo usuario y contraseña de la web.')).toBeTruthy();
    // El nombre va una sola vez, al lado del logo; no hay un "Forward" gigante repetido como título.
    expect(screen.getAllByText('Forward')).toHaveLength(1);
    expect(screen.queryByRole('header', { name: 'Forward' })).toBeNull();
    const marca = screen.getByTestId('login-marca', { includeHiddenElements: true });
    // El logo de la web (icon.svg), no el cuadrado con la flecha.
    expect(within(marca).getByTestId('logo-fwd', { includeHiddenElements: true })).toBeTruthy();
    expect(within(marca).getByTestId('logo-fwd', { includeHiddenElements: true }).props.height).toBe(56);
  });

  it('el logo FWD se ve también en tablet', () => {
    auth();
    mockResponsive = { isTablet: true };
    renderLogin();
    const marca = screen.getByTestId('login-marca', { includeHiddenElements: true });
    expect(within(marca).getByTestId('logo-fwd', { includeHiddenElements: true })).toBeTruthy();
  });

  describe.each(['light', 'dark'] as const)('tema %s', (modo) => {
    const c = themeColors[modo];
    beforeEach(() => useThemeStore.setState({ mode: modo }));

    it('sigue el tema: fondo, campos y borde de control salen de libs/theme', () => {
      auth();
      renderLogin();
      expect(estiloCon(usuario(), 'borderWidth')).toMatchObject({ borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surface });
      expect(plano(screen.getByText('Usuario o email').props.style).color).toBe(c.text);
    });

    it('el campo con foco lleva borde de 2 pt en el color de marca del tema', () => {
      auth();
      renderLogin();
      fireEvent(usuario(), 'focus');
      expect(estiloCon(usuario(), 'borderWidth')).toMatchObject({ borderWidth: 2, borderColor: c.brandInk });
    });

    it('con error del servidor marca los dos campos en el color de peligro del tema', () => {
      auth({ error: 'Usuario o contraseña incorrectos' });
      renderLogin();
      expect(estiloCon(usuario(), 'borderWidth')).toMatchObject({ borderWidth: 2, borderColor: c.chip.anulado.text });
      expect(estiloCon(contrasena(), 'borderWidth')).toMatchObject({ borderWidth: 2, borderColor: c.chip.anulado.text });
    });

    it('la huella es un botón de contorno con borderStrong', async () => {
      auth();
      mockBio.available = true;
      mockBio.saved = true;
      mockBio.choice = 'enabled';
      renderLogin();
      const huella = await screen.findByRole('button', { name: 'Entrar con huella' });
      expect(plano(huella.props.style)).toMatchObject({ borderWidth: 1, borderColor: c.borderStrong });
    });
  });

  it('el botón Ingresar queda en el pie fijo sobre el teclado y la huella debajo, en el mismo pie', async () => {
    auth();
    mockBio.available = true;
    mockBio.saved = true;
    mockBio.choice = 'enabled';
    renderLogin();
    const huella = await screen.findByRole('button', { name: 'Entrar con huella' });
    const pie = screen.getByTestId('login-pie');
    expect(within(pie).getByRole('button', { name: 'Ingresar' })).toBeTruthy();
    expect(within(pie).getByRole('button', { name: 'Entrar con huella' })).toBe(huella);
  });

  it('cargando: el botón muestra el giro y los campos se atenúan', () => {
    auth({ isLoading: true });
    renderLogin();
    expect(ingresar().props.accessibilityState).toMatchObject({ busy: true });
    expect(estiloCon(usuario(), 'borderWidth').opacity).toBeLessThan(1);
  });

  it('pide usuario o email y contraseña, y dice a quién pedir la contraseña olvidada', () => {
    auth();
    renderLogin();
    expect(usuario()).toBeTruthy();
    expect(contrasena()).toBeTruthy();
    expect(ingresar()).toBeTruthy();
    expect(screen.getByText('¿Olvidaste la contraseña? Pedila a tu administrador.')).toBeTruthy();
  });

  it('con los campos vacíos no llama al servidor y lo dice', async () => {
    const login = auth();
    renderLogin();
    fireEvent.press(ingresar());
    expect(await screen.findByText('Completá tu usuario y tu contraseña.')).toBeTruthy();
    expect(login).not.toHaveBeenCalled();
  });

  it('ingresa con lo escrito y entra a la app; sin decisión no guarda la contraseña y ofrece la huella', async () => {
    const login = auth();
    mockBio.available = true;
    renderLogin();
    fireEvent.changeText(usuario(), 'admin');
    fireEvent.changeText(contrasena(), 'secreta123');
    fireEvent.press(ingresar());
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)'));
    expect(login).toHaveBeenCalledWith('admin', 'secreta123');
    expect(mockSaveCredentials).not.toHaveBeenCalled();
    expect(useOfertaDeHuella.getState().pendiente).toEqual({ username: 'admin', password: 'secreta123' });
  });

  it('con la huella aceptada guarda las credenciales al ingresar con contraseña', async () => {
    mockBio.available = true;
    mockBio.choice = 'enabled';
    auth();
    renderLogin();
    fireEvent.changeText(usuario(), 'admin');
    fireEvent.changeText(contrasena(), 'secreta123');
    fireEvent.press(ingresar());
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)'));
    expect(mockSaveCredentials).toHaveBeenCalledWith({ username: 'admin', password: 'secreta123' });
    expect(useOfertaDeHuella.getState().pendiente).toBeNull();
  });

  it('con la huella rechazada no guarda la contraseña ni vuelve a preguntar', async () => {
    mockBio.available = true;
    mockBio.choice = 'disabled';
    auth();
    renderLogin();
    fireEvent.changeText(usuario(), 'admin');
    fireEvent.changeText(contrasena(), 'secreta123');
    fireEvent.press(ingresar());
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)'));
    expect(mockSaveCredentials).not.toHaveBeenCalled();
    expect(useOfertaDeHuella.getState().pendiente).toBeNull();
  });

  it('sin huella en el teléfono no pregunta', async () => {
    auth();
    renderLogin();
    fireEvent.changeText(usuario(), 'admin');
    fireEvent.changeText(contrasena(), 'secreta123');
    fireEvent.press(ingresar());
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)'));
    expect(useOfertaDeHuella.getState().pendiente).toBeNull();
  });

  it('si el ingreso falla no guarda la contraseña ni entra', async () => {
    const login = auth();
    login.mockResolvedValue(false);
    renderLogin();
    fireEvent.changeText(usuario(), 'admin');
    fireEvent.changeText(contrasena(), 'equivocada');
    fireEvent.press(ingresar());
    await waitFor(() => expect(login).toHaveBeenCalledWith('admin', 'equivocada'));
    expect(mockSaveCredentials).not.toHaveBeenCalled();
    expect(useOfertaDeHuella.getState().pendiente).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('si el servidor rechaza, muestra el error y no entra', async () => {
    auth({ error: 'Usuario o contraseña incorrectos.' });
    renderLogin();
    expect(await screen.findByText('Usuario o contraseña incorrectos.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('un solo aviso de error trae el texto del servidor y los intentos que quedan', () => {
    auth({ error: 'Usuario o contraseña incorrectos.', failedAttempts: 2 });
    renderLogin();
    const avisos = screen.getAllByTestId('login-aviso-error');
    expect(avisos).toHaveLength(1);
    expect(within(avisos[0]).getByText(/Usuario o contraseña incorrectos\./)).toBeTruthy();
    expect(within(avisos[0]).getByText(/Te quedan 3 intentos antes del bloqueo\./)).toBeTruthy();
    // Nada de una segunda línea de intentos suelta fuera del aviso.
    expect(screen.getAllByText(/Te quedan 3 intentos/)).toHaveLength(1);
  });

  it('avisa los intentos que quedan y bloquea el botón cuando se agotan', () => {
    auth({ failedAttempts: 3 });
    const { rerender } = renderLogin();
    expect(screen.getByText('Te quedan 2 intentos antes del bloqueo.')).toBeTruthy();

    auth({ isLocked: true, failedAttempts: 5 });
    rerender(<QueryClientProvider client={new QueryClient()}><LoginScreen /></QueryClientProvider>);
    expect(screen.getByRole('button', { name: 'Acceso bloqueado' })).toBeDisabled();
  });

  it('"Entrar con huella" aparece con huella disponible, aceptada y guardada, y no se dispara sola', async () => {
    auth();
    mockBio.available = true;
    mockBio.saved = true;
    mockBio.choice = 'enabled';
    renderLogin();
    expect(await screen.findByRole('button', { name: 'Entrar con huella' })).toBeTruthy();
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('sin decisión, rechazada o sin credencial guardada no muestra el botón', async () => {
    auth();
    mockBio.available = true;
    mockBio.saved = true;
    mockBio.choice = null;
    const { unmount } = renderLogin();
    await act(async () => {});
    expect(screen.queryByRole('button', { name: 'Entrar con huella' })).toBeNull();
    unmount();

    mockBio.choice = 'disabled';
    const otra = renderLogin();
    await act(async () => {});
    expect(screen.queryByRole('button', { name: 'Entrar con huella' })).toBeNull();
    otra.unmount();

    mockBio.choice = 'enabled';
    mockBio.saved = false;
    renderLogin();
    await act(async () => {});
    expect(screen.queryByRole('button', { name: 'Entrar con huella' })).toBeNull();
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('tocar "Entrar con huella" pide la huella e ingresa con las credenciales guardadas', async () => {
    const login = auth();
    mockBio.available = true;
    mockBio.saved = true;
    mockBio.choice = 'enabled';
    mockAuthenticate.mockResolvedValue({ username: 'admin', password: 'secreta123' });
    renderLogin();
    fireEvent.press(await screen.findByRole('button', { name: 'Entrar con huella' }));
    await waitFor(() => expect(login).toHaveBeenCalledWith('admin', 'secreta123'));
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)'));
  });

  it('en la build de desarrollo deja elegir el servidor', () => {
    auth();
    renderLogin();
    expect(screen.getByLabelText('Servidor')).toBeTruthy();
  });

  it('en las builds que van a los teléfonos no hay selector de servidor', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    auth();
    renderLogin();
    expect(screen.queryByLabelText('Servidor')).toBeNull();
    expect(screen.queryByText(/Local/)).toBeNull();
  });

  it('en tablet muestra la presentación al lado del formulario', () => {
    mockResponsive = { isTablet: true };
    auth();
    renderLogin();
    expect(screen.getByText('Vendé, cobrá y seguí tus pedidos desde la calle, con los mismos datos que la web.')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Ingresá' })).toBeTruthy();
    expect(ingresar()).toBeTruthy();
  });
  it('sin conexión avisa y apaga "Ingresar" y la huella; al volver la red se reactivan', async () => {
    mockBio.available = true;
    mockBio.saved = true;
    mockBio.choice = 'enabled';
    auth();
    renderLogin();
    const huella = await screen.findByRole('button', { name: 'Entrar con huella' });
    act(() => mockRed({ isConnected: false, isInternetReachable: false }));
    expect(screen.getByText('Sin conexión. Conectate a internet para ingresar; se reintenta solo.')).toBeTruthy();
    expect(ingresar().props.accessibilityState).toMatchObject({ disabled: true });
    expect(huella.props.accessibilityState).toMatchObject({ disabled: true });
    act(() => mockRed({ isConnected: true, isInternetReachable: true }));
    expect(screen.queryByText(/Sin conexión/)).toBeNull();
    expect(ingresar().props.accessibilityState).not.toMatchObject({ disabled: true });
  });

  it('un estado de red desconocido no apaga el ingreso', () => {
    auth();
    renderLogin();
    act(() => mockRed({ isConnected: true, isInternetReachable: null }));
    expect(screen.queryByText(/Sin conexión/)).toBeNull();
  });
});

describe('Ingreso: tokens', () => {
  it('app/login.tsx no trae colores hex sueltos: todo sale de libs/theme', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fuente = (require('fs') as typeof import('fs')).readFileSync(require.resolve('../../../../../app/login.tsx'), 'utf8');
    expect(fuente.match(/#[0-9a-fA-F]{6}/g)).toBeNull();
  });
});
