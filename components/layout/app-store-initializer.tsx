'use client'

import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store'

interface Props {
  companies: { id: string; razao_social: string }[]
  firstCompanyId: string | null
  children: React.ReactNode
}

export function AppStoreInitializer({ companies, firstCompanyId, children }: Props) {
  const initialized = useRef(false)
  // Seletores separados — objeto literal causaria re-render infinito
  const activeCompanyId = useAppStore((s) => s.activeCompanyId)
  const setActiveCompany = useAppStore((s) => s.setActiveCompany)

  useEffect(() => {
    const isValid = companies.some((c) => c.id === activeCompanyId)
    const resolved = isValid ? activeCompanyId : firstCompanyId

    if (!initialized.current) {
      initialized.current = true
      if (!isValid && firstCompanyId) setActiveCompany(firstCompanyId)
    }

    if (resolved) {
      document.cookie = `active_company_id=${resolved}; path=/; max-age=86400; SameSite=Lax`
    }
  }, [activeCompanyId, companies, firstCompanyId, setActiveCompany])

  return <>{children}</>
}
