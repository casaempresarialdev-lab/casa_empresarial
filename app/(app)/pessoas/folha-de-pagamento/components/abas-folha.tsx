'use client'

import { useRouter } from 'next/navigation'
import { Tabs } from '@/components/ui/form-steps'

/** Folha mensal e 13º salário: cada aba é uma página (?aba=decimo), para manter o mês ou o ano no endereço */
export function AbasFolha({ aba, ano }: { aba: 'mensal' | 'decimo'; ano: number }) {
  const router = useRouter()
  return (
    <Tabs
      labels={['Folha mensal', '13º salário']}
      step={aba === 'mensal' ? 0 : 1}
      onSelect={(i) => router.push(i === 0 ? '/pessoas/folha-de-pagamento' : `/pessoas/folha-de-pagamento?aba=decimo&ano=${ano}`)}
    />
  )
}
