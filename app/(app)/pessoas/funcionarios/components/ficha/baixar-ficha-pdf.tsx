'use client'

import { pdf } from '@react-pdf/renderer'
import { FichaPdf } from './ficha-pdf'
import type { Employee } from '../../queries'
import type { CompanyBenefit } from '../../../beneficios/queries'
import type { Company } from '../../../../empresa/queries'

// Foto baixada como data URL para o PDF (sem foto, ou se falhar, o PDF usa as iniciais)
async function fotoParaPdf(url: string | null) {
  if (!url) return null
  try {
    const blob = await (await fetch(url)).blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/** Gera a ficha do funcionário em PDF no navegador e baixa o arquivo. Lança erro se não conseguir. */
export async function baixarFichaPdf({ employee, company, benefits, fotoUrl }: {
  employee: Employee
  company: Company | null
  benefits: CompanyBenefit[]
  fotoUrl: string | null
}) {
  const agora = new Date()
  const geradoEm = `${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  // Se a logo/foto não carregar, gera de novo sem as imagens
  let blob: Blob
  try {
    blob = await pdf(<FichaPdf employee={employee} company={company} foto={await fotoParaPdf(fotoUrl)} benefits={benefits} geradoEm={geradoEm} />).toBlob()
  } catch {
    blob = await pdf(<FichaPdf employee={employee} company={company ? { ...company, logo_url: null } : null} foto={null} benefits={benefits} geradoEm={geradoEm} />).toBlob()
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ficha-${employee.nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
