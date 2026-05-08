'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: '⊞',
  },
  {
    label: 'Administrativo',
    icon: '🏢',
    children: [
      { label: 'Usuários', href: '/admin/usuarios' },
      { label: 'Quadro Societário', href: '/admin/quadro-societario' },
      { label: 'Logins e Senhas', href: '/admin/logins-senhas' },
    ],
  },
  {
    label: 'Financeiro',
    icon: '💰',
    children: [
      { label: 'Contatos', href: '/financeiro/contatos' },
      { label: 'Centro de Custo', href: '/financeiro/centro-de-custo' },
      { label: 'Categorias', href: '/financeiro/categorias' },
      { label: 'Contas e Cartões', href: '/financeiro/contas-cartoes' },
      { label: 'Fluxo de Caixa', href: '/financeiro/fluxo-de-caixa' },
      { label: 'Faturas', href: '/financeiro/faturas' },
    ],
  },
  {
    label: 'Operacional',
    icon: '📦',
    children: [
      { label: 'Produtos', href: '/operacional/produtos' },
      { label: 'Pedidos de Compra', href: '/operacional/pedidos-compra' },
      { label: 'Pedidos de Venda', href: '/operacional/pedidos-venda' },
      { label: 'Frente de Caixa', href: '/operacional/frente-de-caixa' },
    ],
  },
  {
    label: 'Pessoas',
    icon: '👥',
    children: [
      { label: 'Funcionários', href: '/pessoas/funcionarios' },
      { label: 'Prestadores', href: '/pessoas/prestadores' },
      { label: 'Registro de Ponto', href: '/pessoas/registro-de-ponto' },
      { label: 'Escala de Trabalho', href: '/pessoas/escala-de-trabalho' },
      { label: 'Folha de Pagamento', href: '/pessoas/folha-de-pagamento' },
    ],
  },
  {
    label: 'Marketing',
    icon: '📣',
    children: [
      { label: 'Calendário', href: '/marketing/calendario' },
      { label: 'Depoimentos', href: '/marketing/depoimentos' },
      { label: 'Fotos e Vídeos', href: '/marketing/fotos-videos' },
      { label: 'Material Gráfico', href: '/marketing/material-grafico' },
      { label: 'Manual da Marca', href: '/marketing/manual-da-marca' },
    ],
  },
]

export function Sidebar() {
  const expanded = useAppStore((s) => s.sidebarExpanded)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const pathname = usePathname()

  return (
    <aside
      className="flex flex-col h-screen fixed left-0 top-0 z-40 border-r transition-all duration-200"
      style={{
        width: expanded ? 'var(--sidebar-width-expanded)' : 'var(--sidebar-width-collapsed)',
        backgroundColor: '#FFFFFF',
        borderColor: 'var(--color-bg-surface)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b" style={{ borderColor: 'var(--color-bg-surface)' }}>
        {expanded ? (
          <span className="font-bold text-base" style={{ fontFamily: 'Manrope', color: 'var(--color-primary-darker)' }}>
            Casa Empresarial
          </span>
        ) : (
          <span className="font-bold text-lg" style={{ color: 'var(--color-primary-darker)' }}>CE</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {NAV_ITEMS.map((item) => {
          if (!item.children) {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href!}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg mb-1 text-sm transition-colors',
                  active
                    ? 'font-semibold'
                    : 'hover:bg-gray-50'
                )}
                style={active ? { backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-darker)' } : { color: 'var(--color-text-secondary)' }}
                title={!expanded ? item.label : undefined}
              >
                <span className="text-base shrink-0">{item.icon}</span>
                {expanded && <span className="truncate">{item.label}</span>}
              </Link>
            )
          }

          const isGroupActive = item.children.some(c => pathname.startsWith(c.href))

          return (
            <div key={item.label} className="mb-1">
              <div
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium',
                  isGroupActive ? '' : ''
                )}
                style={{ color: isGroupActive ? 'var(--color-primary-darker)' : 'var(--color-text-muted)' }}
                title={!expanded ? item.label : undefined}
              >
                <span className="text-base shrink-0">{item.icon}</span>
                {expanded && <span className="truncate">{item.label}</span>}
              </div>

              {expanded && (
                <div className="ml-4 pl-3 border-l" style={{ borderColor: 'var(--color-bg-surface)' }}>
                  {item.children.map((child) => {
                    const active = pathname.startsWith(child.href)
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          'flex items-center px-3 py-1.5 rounded-lg text-sm transition-colors mb-0.5',
                          active ? 'font-semibold' : 'hover:bg-gray-50'
                        )}
                        style={active
                          ? { backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-darker)' }
                          : { color: 'var(--color-text-secondary)' }
                        }
                      >
                        {child.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Toggle button */}
      <button
        onClick={toggleSidebar}
        className="m-3 p-2 rounded-lg text-sm hover:bg-gray-100 transition-colors"
        style={{ color: 'var(--color-text-muted)' }}
        aria-label={expanded ? 'Recolher menu' : 'Expandir menu'}
      >
        {expanded ? '◀' : '▶'}
      </button>
    </aside>
  )
}
