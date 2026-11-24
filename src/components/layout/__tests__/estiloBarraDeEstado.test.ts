// Visual review MB-19: the status bar icons follow what is painted under them.
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock("expo-local-authentication", () => ({}));
jest.mock("../../../../global.css", () => ({}));
jest.setTimeout(60_000);

const cargar = () =>
  require("../../../../app/_layout").estiloDeBarraDeEstado as (
    isDark: boolean,
    isTablet: boolean,
  ) => string;

describe("estiloDeBarraDeEstado", () => {
  it("phone, light theme: dark icons over the light screen (as before)", () => {
    expect(cargar()(false, false)).toBe("dark");
  });
  it("phone, dark theme: light icons (as before)", () => {
    expect(cargar()(true, false)).toBe("light");
  });
  it("tablet, light theme: light icons over the dark side panel and login panel", () => {
    expect(cargar()(false, true)).toBe("light");
  });
  it("tablet, dark theme: light icons", () => {
    expect(cargar()(true, true)).toBe("light");
  });
});
