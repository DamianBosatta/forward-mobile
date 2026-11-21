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
        "surface-alt":  "var(--color-surface-alt)",
        lime:           "var(--color-lime)",
        teal:           "var(--color-teal)",
        ink:            "var(--color-ink)",
        "accent-text":  "var(--color-accent-text)",
        "primary-bg":   "var(--color-primary-bg)",
        "primary-fg":   "var(--color-primary-fg)",
        "fab-bg":       "var(--color-fab-bg)",
        "danger-fill":  "var(--color-danger-fill)",
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

        // ── Estados: success e info como hoy; warning y danger de la spec FWD (danger legible como texto por tema) ──
        success:        "#21C45D",
        warning:        "var(--color-warning)",
        danger:         "var(--color-danger)",
        info:           "#0DA2E7",
      },
    },
  },
  plugins: [],
}
