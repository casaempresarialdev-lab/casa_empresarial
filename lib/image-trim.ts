// Recorte automático de margens vazias de imagens (só no navegador).
// Logos costumam vir com muita área vazia em volta (ex.: SVG quadrado com o desenho no meio),
// o que deixa o desenho minúsculo quando a imagem é encaixada no menu lateral.

const TARGET_LONG_SIDE = 1200 // resolução de saída para SVG (vetor é rasterizado)
const ALPHA_THRESHOLD = 10    // abaixo disso o pixel conta como transparente
const COLOR_TOLERANCE = 30    // distância de cor para considerar "igual ao fundo"
const PADDING = 0.02          // respiro mantido em volta do desenho (2% do maior lado)

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler a imagem.')) }
    img.src = url
  })
}

/**
 * Remove as margens vazias da imagem. O "vazio" é definido pela cor do canto superior
 * esquerdo: transparente (corta pelo alfa) ou uma cor sólida, como branco (corta pela cor).
 * Devolve um PNG recortado, ou o arquivo original se não houver o que cortar.
 */
export async function trimImage(file: File): Promise<File> {
  const isSvg = file.type === 'image/svg+xml'
  const img = await loadImage(file)
  const w0 = img.naturalWidth || 500
  const h0 = img.naturalHeight || 500
  const scale = isSvg ? TARGET_LONG_SIDE / Math.max(w0, h0) : 1
  const w = Math.round(w0 * scale)
  const h = Math.round(h0 * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return file
  ctx.drawImage(img, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)

  // Cor de fundo = canto superior esquerdo
  const [br, bg, bb, ba] = [data[0], data[1], data[2], data[3]]
  const transparentBg = ba < ALPHA_THRESHOLD
  const isContent = (i: number) => {
    const a = data[i + 3]
    if (a < ALPHA_THRESHOLD) return false
    if (transparentBg) return true
    return Math.abs(data[i] - br) + Math.abs(data[i + 1] - bg) + Math.abs(data[i + 2] - bb) > COLOR_TOLERANCE
  }

  let minX = w, minY = h, maxX = -1, maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isContent((y * w + x) * 4)) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return file // imagem vazia: deixa como está

  const pad = Math.round(Math.max(w, h) * PADDING)
  const x = Math.max(0, minX - pad)
  const y = Math.max(0, minY - pad)
  const cw = Math.min(w, maxX + pad + 1) - x
  const ch = Math.min(h, maxY + pad + 1) - y

  // Quase nada a cortar num raster: mantém o original
  if (!isSvg && cw >= w * 0.97 && ch >= h * 0.97) return file

  const out = document.createElement('canvas')
  out.width = cw
  out.height = ch
  out.getContext('2d')!.drawImage(canvas, x, y, cw, ch, 0, 0, cw, ch)
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'))
  if (!blob) return file
  const name = file.name.replace(/\.[^.]+$/, '') + '.png'
  return new File([blob], name, { type: 'image/png' })
}
