'use client'

import { useState } from 'react'
import { Tabs } from '@/components/ui/form-steps'

// Abas das Configurações. Todas ficam montadas, para não perder o que foi alterado ao trocar de aba.
export function ConfigAbas({ personalizacao, admissao, rescisao, folha, ferias }: {
  personalizacao: React.ReactNode
  admissao: React.ReactNode
  rescisao: React.ReactNode
  folha: React.ReactNode
  ferias: React.ReactNode
}) {
  const [aba, setAba] = useState(0)
  return (
    <>
      <Tabs labels={['Personalização', 'Admissão', 'Rescisão', 'Folha de pagamento', 'Férias']} step={aba} onSelect={setAba} />
      <div className={aba === 0 ? undefined : 'hidden'}>{personalizacao}</div>
      <div className={aba === 1 ? undefined : 'hidden'}>{admissao}</div>
      <div className={aba === 2 ? undefined : 'hidden'}>{rescisao}</div>
      <div className={aba === 3 ? undefined : 'hidden'}>{folha}</div>
      <div className={aba === 4 ? undefined : 'hidden'}>{ferias}</div>
    </>
  )
}
