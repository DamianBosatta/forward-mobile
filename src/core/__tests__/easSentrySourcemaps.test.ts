import easConfig from "../../../eas.json";

type Perfil = { environment?: string; env?: Record<string, string> };

/**
 * Release builds upload their source maps to Sentry with `SENTRY_AUTH_TOKEN`, a secret EAS
 * environment variable. Each profile names its EAS environment: without `environment`, EAS picks
 * `preview` for every profile that is not a store or dev-client build, `production` included.
 */
describe("Source maps de Sentry en los builds de release", () => {
  const perfiles = easConfig.build as Record<string, Perfil>;

  it.each(["development", "preview", "production"])(
    "%s usa su entorno de EAS",
    (nombre) => {
      expect(perfiles[nombre].environment).toBe(nombre);
    },
  );

  it.each(["preview", "production"])("%s sube los source maps", (nombre) => {
    expect(perfiles[nombre].env).not.toHaveProperty(
      "SENTRY_DISABLE_AUTO_UPLOAD",
    );
  });
});
