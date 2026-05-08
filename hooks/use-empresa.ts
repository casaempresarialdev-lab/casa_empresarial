'use client'

import { useAppStore } from '@/store'

export function useEmpresa() {
  const activeCompanyId = useAppStore((s) => s.activeCompanyId)
  const setActiveCompany = useAppStore((s) => s.setActiveCompany)

  return { activeCompanyId, setActiveCompany }
}
