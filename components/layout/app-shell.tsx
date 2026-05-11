'use client'

import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'

export function AppShell({ children }: { children: React.ReactNode }) {
  const expanded = useAppStore((s) => s.sidebarExpanded)

  return (
    <div
      className={cn(
        'flex flex-col min-h-screen transition-all duration-200',
        // Mobile: sem margem (sidebar é overlay). Desktop: margem conforme estado da sidebar.
        expanded ? 'md:ml-60' : 'md:ml-16',
      )}
    >
      {children}
    </div>
  )
}
