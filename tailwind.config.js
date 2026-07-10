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
        // ── Forward V3.5 Brand Identity ──────────────────────
        primary:       "#00b4a2", // Nuevo Verde Forward Teal
        "primary-dark":"#008f81",
        secondary:     "#06b6d4", // Cyan/Teal secondary

        // ── Dynamic surfaces (Light/Dark via CSS vars) ───
        bg:            "var(--color-bg)",
        surface:       "var(--color-surface)",
        "surface-2":   "var(--color-surface-2)",
        "surface-3":   "var(--color-surface-3)",

        // ── Dynamic Text ────────────────────────────────
        text:          "var(--color-text)",
        "text-muted":  "var(--color-text-muted)",
        "text-disabled":"var(--color-text-disabled)",

        // ── Dynamic Borders ─────────────────────────────
        border:        "var(--color-border)",
        "border-strong":"var(--color-border-strong)",

        // ── Semantic ────────────────────────────────────────
        success:       "#22c55e",
        warning:       "#f59e0b",
        danger:        "#ef4444",
        info:          "#0ea5e9",
      },
    },
  },
  plugins: [],
}
