'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { PageLoader } from './page-loader'

// Tempo mínimo que o pré-loader fica na tela a cada troca de página
const MIN_LOADER_MS = 800

/**
 * Remonta a cada troca de pathname (inclusive entre telas da mesma área) e segura
 * o pré-loader por MIN_LOADER_MS. Se a página demorar mais, o loading.tsx assume
 * com a mesma logo. Mudanças só de query string (?page=2) não disparam o loader.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return <MinDelay key={pathname}>{children}</MinDelay>
}

function MinDelay({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setReady(true), MIN_LOADER_MS)
    return () => clearTimeout(t)
  }, [])

  return ready ? <>{children}</> : <PageLoader />
}
