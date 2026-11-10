'use client'

import type { DadosHolerite } from './holerite-pdf'

/** Gera o PDF no navegador e baixa */
export async function baixarHolerite(d: DadosHolerite, arquivo: string) {
  const [{ pdf }, { HoleritePdf }] = await Promise.all([import('@react-pdf/renderer'), import('./holerite-pdf')])
  const blob = await pdf(<HoleritePdf d={d} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${arquivo}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
