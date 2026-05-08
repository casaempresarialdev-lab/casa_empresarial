'use client'

import { useAppStore } from '@/store'

export function AppShell({ children }: { children: React.ReactNode }) {
  const expanded = useAppStore((s) => s.sidebarExpanded)

  return (
    <div
      className="flex flex-col min-h-screen transition-all duration-200"
      style={{
        marginLeft: expanded ? 'var(--sidebar-width-expanded)' : 'var(--sidebar-width-collapsed)',
      }}
    >
      {children}
    </div>
  )
}
