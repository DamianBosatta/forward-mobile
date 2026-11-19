// Semantic version compare (MAJOR.MINOR.PATCH, optional -prerelease and +build), for the minimum app version (OPS-03).
const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/

interface Version {
  nucleo: [number, number, number]
  prerelease: string[]
}

function leer(v: string): Version | null {
  const m = SEMVER.exec(v.trim())
  if (!m) return null
  return { nucleo: [Number(m[1]), Number(m[2]), Number(m[3])], prerelease: m[4] ? m[4].split('.') : [] }
}

const esNumero = (s: string) => /^\d+$/.test(s)

function compararPrerelease(a: string[], b: string[]): number {
  // A version without prerelease is greater than the same version with one.
  if (a.length === 0 && b.length === 0) return 0
  if (a.length === 0) return 1
  if (b.length === 0) return -1
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i]
    const y = b[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    if (x === y) continue
    if (esNumero(x) && esNumero(y)) return Number(x) < Number(y) ? -1 : 1
    if (esNumero(x)) return -1
    if (esNumero(y)) return 1
    return x < y ? -1 : 1
  }
  return 0
}

/** -1, 0 or 1 by semver precedence (build metadata ignored); null when either value is not a valid version. */
export function compararVersiones(a: string, b: string): -1 | 0 | 1 | null {
  const va = leer(a)
  const vb = leer(b)
  if (!va || !vb) return null
  for (let i = 0; i < 3; i++) {
    if (va.nucleo[i] !== vb.nucleo[i]) return va.nucleo[i] < vb.nucleo[i] ? -1 : 1
  }
  return compararPrerelease(va.prerelease, vb.prerelease) as -1 | 0 | 1
}

/** True only when both are valid versions and the installed one is lower. Anything else never blocks. */
export function estaDesactualizada(instalada: string | null | undefined, minima: string | null | undefined): boolean {
  if (!instalada || !minima) return false
  return compararVersiones(instalada, minima) === -1
}
