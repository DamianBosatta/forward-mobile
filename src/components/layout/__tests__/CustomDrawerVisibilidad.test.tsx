/**
 * Visual review M9 (MD-26, MD-27): the permanent tablet menu shows that the list continues, shows who is
 * logged in with the role written for people (P11), and keeps the open screen in view.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ScrollView } from "react-native";
import CustomDrawerContent from "../CustomDrawerContent";

let mockAncho = 1024;
let mockRoles: string[] = ["AdministradorSistemas"];
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("expo-router/drawer", () => ({ useDrawerStatus: () => "closed" }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockAncho, height: 600, scale: 2, fontScale: 1 }),
}));
jest.mock("@/core/utils/haptics", () => ({
  safeHaptics: { impact: jest.fn(), notification: jest.fn() },
}));
jest.mock("@/features/cuenta/hooks/useCerrarSesion", () => ({
  useCerrarSesion: () => ({ cerrarSesion: jest.fn() }),
}));
jest.mock("@/core/auth/RequirePermission", () => ({
  usePermissions: () => ({ canDo: () => true }),
}));
jest.mock("@/features/auth/hooks/useAuth", () => ({
  useAuth: () => ({ refreshPermissions: jest.fn() }),
}));
jest.mock("@/features/auth/store/auth.store", () => ({
  useAuthStore: () => ({
    isAuthenticated: true,
    user: { nombre: "Ana", apellido: "Paz", roles: mockRoles, permissions: [] },
  }),
}));

const props = (ruta: string) =>
  ({ state: { routeNames: [ruta], index: 0 } }) as any;

describe.each([
  ["tablet", 1024],
  ["phone", 390],
])("menu on %s", (_n, ancho) => {
  beforeEach(() => {
    mockAncho = ancho;
    mockRoles = ["AdministradorSistemas"];
  });

  it("shows the scroll indicator so the list is seen to continue (MD-26)", () => {
    render(<CustomDrawerContent {...props("index")} />);
    expect(
      screen.getByTestId("menu-lista").props.showsVerticalScrollIndicator,
    ).toBe(true);
  });

  it("writes the role with the one translation function (P11), not the raw name (MD-27)", () => {
    render(<CustomDrawerContent {...props("index")} />);
    expect(screen.getByText("Administrador de sistemas")).toBeTruthy();
    expect(screen.queryByText("AdministradorSistemas")).toBeNull();
  });

  it("brings the open screen into view when it is below the fold (MD-27)", () => {
    const scrollTo = jest
      .spyOn(ScrollView.prototype as any, "scrollTo")
      .mockImplementation(() => {});
    render(<CustomDrawerContent {...props("reportes/index")} />);
    fireEvent(screen.getByTestId("menu-activo"), "layout", {
      nativeEvent: { layout: { x: 0, y: 700, width: 200, height: 44 } },
    });
    expect(scrollTo).toHaveBeenCalled();
    expect((scrollTo.mock.calls[0][0] as any).y).toBeGreaterThan(0);
    scrollTo.mockRestore();
  });
});
