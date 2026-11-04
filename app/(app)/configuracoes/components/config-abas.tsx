'use client'

import { useState } from 'react'
import { Tabs } from '@/components/ui/form-steps'

// Abas das Configurações. As duas ficam montadas, para não perder o que foi alterado ao trocar de aba.
export function ConfigAbas({ personalizacao, admissao }: { personalizacao: React.ReactNode; admissao: React.ReactNode }) {
  const [aba, setAba] = useState(0)
  return (
    <>
      <Tabs labels={['Personalização', 'Admissão']} step={aba} onSelect={setAba} />
      <div className={aba === 0 ? undefined : 'hidden'}>{personalizacao}</div>
      <div className={aba === 1 ? undefined : 'hidden'}>{admissao}</div>
    </>
  )
}
