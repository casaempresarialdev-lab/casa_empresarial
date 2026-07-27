'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { deriveThemeColors } from '@/lib/theme'

interface Props {
  companies: { id: string; cor_primaria: string | null }[]
}

export function ThemeSync({ companies }: Props) {
  const activeId = useAppStore(s => s.activeCompanyId)

  useEffect(() => {
    const company = companies.find(c => c.id === activeId)
    const { primary, dark, darker } = deriveThemeColors(company?.cor_primaria ?? null)
    const root = document.documentElement
    root.style.setProperty('--color-primary',        primary)
    root.style.setProperty('--color-primary-dark',   dark)
    root.style.setProperty('--color-primary-darker', darker)
  }, [activeId, companies])

  return null
}
