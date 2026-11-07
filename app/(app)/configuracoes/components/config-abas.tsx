'use client'

import { useState } from 'react'
import { Tabs } from '@/components/ui/form-steps'

// Abas das Configurações. Todas ficam montadas, para não perder o que foi alterado ao trocar de aba.
export function ConfigAbas({ personalizacao, admissao, rescisao }: { personalizacao: React.ReactNode; admissao: React.ReactNode; rescisao: React.ReactNode }) {
  const [aba, setAba] = useState(0)
  return (
    <>
      <Tabs labels={['Personalização', 'Admissão', 'Rescisão']} step={aba} onSelect={setAba} />
      <div className={aba === 0 ? undefined : 'hidden'}>{personalizacao}</div>
      <div className={aba === 1 ? undefined : 'hidden'}>{admissao}</div>
      <div className={aba === 2 ? undefined : 'hidden'}>{rescisao}</div>
    </>
  )
}
