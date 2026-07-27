// Derivação de cores do tema a partir de cor_primaria (= --color-primary-dark)

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, Math.round(l * 100)]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
    case g: h = ((b - r) / d + 2) / 6; break
    case b: h = ((r - g) / d + 4) / 6; break
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

function hslToHex(h: number, s: number, l: number): string {
  const sl = s / 100, ll = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sl * Math.min(ll, 1 - ll)
  const f = (n: number) => ll - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const hex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0')
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`
}

const DEFAULT = { primary: '#EED9C4', dark: '#C19A6B', darker: '#A67B5B' }

export function deriveThemeColors(corPrimaria: string | null): typeof DEFAULT {
  const base = corPrimaria?.trim() ?? ''
  if (!/^#[0-9a-fA-F]{6}$/.test(base)) return DEFAULT

  const [h, s, l] = hexToHsl(base)
  return {
    primary: hslToHex(h, Math.max(0, s - 5),  Math.min(95, l + 27)),
    dark:    base,
    darker:  hslToHex(h, Math.max(0, s - 8),  Math.max(10, l - 10)),
  }
}
