/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Tokens del Bloque 9 (variables por tema en global.css) ──
        brand:          "var(--color-brand)",
        "brand-ink":    "var(--color-brand-ink)",
        "brand-soft":   "var(--color-brand-soft)",
        action:         "var(--color-action)",
        "on-action":    "var(--color-on-action)",
        "danger-strong":"var(--color-danger-strong)",
        "top-bar":      "var(--color-top-bar)",
        "on-top-bar":   "var(--color-on-top-bar)",
        bg:             "var(--color-bg)",
        surface:        "var(--color-surface)",
        "surface-2":    "var(--color-surface-2)",
        border:         "var(--color-border)",
        text:           "var(--color-text)",
        "text-muted":   "var(--color-text-muted)",

        // ── Legados (mismo mapeo que libs/theme.ts) ──
        primary:        "var(--color-brand-ink)",
        "primary-dark": "var(--color-brand-ink)",
        secondary:      "#0DA2E7",
        "surface-3":    "var(--color-surface-3)",
        "text-disabled":"var(--color-text-disabled)",
        "border-strong":"var(--color-border-strong)",

        // ── Estados de la web: solo íconos y puntos ──
        success:        "#21C45D",
        warning:        "#FFA200",
        danger:         "#EF4343",
        info:           "#0DA2E7",
      },
    },
  },
  plugins: [],
}
