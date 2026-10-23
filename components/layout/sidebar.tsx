'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { UserMenu } from './user-menu'
import { Icon, type IconName } from '@/components/ui/icon'


type NavLeaf  = { label: string; href: string; icon: IconName; children?: never }
type NavGroup = { label: string; href?: never; icon: IconName; children: { label: string; href: string }[] }
type NavItem  = NavLeaf | NavGroup

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Visão geral',
    href: '/dashboard',
    icon: 'grid',
  },
  {
    label: 'Administrativo',
    icon: 'file',
    children: [
      { label: 'Minha Empresa', href: '/empresa' },
      { label: 'Quadro Societário', href: '/admin/quadro-societario' },
      { label: 'Logins e Senhas', href: '/admin/logins-senhas' },
      { label: 'Documentação', href: '/admin/documentacao' },
    ],
  },
  {
    label: 'Financeiro',
    icon: 'dollar',
    children: [
      { label: 'Contatos', href: '/financeiro/contatos' },
      { label: 'Centro de Custo', href: '/financeiro/centro-de-custo' },
      { label: 'Categorias', href: '/financeiro/categorias' },
      { label: 'Contas e Cartões', href: '/financeiro/contas-cartoes' },
      { label: 'Fluxo de Caixa', href: '/financeiro/fluxo-de-caixa' },
      { label: 'DRE', href: '/financeiro/dre' },
      { label: 'Balanço', href: '/financeiro/balanco' },
      { label: 'Faturas', href: '/financeiro/faturas' },
    ],
  },
  {
    label: 'Pessoas',
    icon: 'users',
    children: [
      { label: 'Equipe', href: '/pessoas/funcionarios' },
      { label: 'Admissão', href: '/pessoas/admissao' },
      { label: 'Registro de Ponto', href: '/pessoas/registro-de-ponto' },
      { label: 'Escala de Trabalho', href: '/pessoas/escala-de-trabalho' },
      { label: 'Folha de Pagamento', href: '/pessoas/folha-de-pagamento' },
      { label: 'Benefícios', href: '/pessoas/beneficios' },
      { label: 'Encargos', href: '/pessoas/encargos' },
      { label: 'Reuniões', href: '/pessoas/reunioes' },
      { label: 'Pesquisas', href: '/pessoas/pesquisas' },
      { label: 'Segurança e Saúde', href: '/pessoas/seguranca-saude' },
    ],
  },
  {
    label: 'Operacional',
    icon: 'briefcase',
    children: [
      { label: 'Produtos e Serviços', href: '/operacional/produtos' },
      { label: 'Pedidos de Compra', href: '/operacional/pedidos-compra' },
      { label: 'Pedidos de Venda', href: '/operacional/pedidos-venda' },
      { label: 'Ordens de Serviço', href: '/operacional/ordens-de-servico' },
      { label: 'Frente de Caixa', href: '/operacional/frente-de-caixa' },
    ],
  },
  {
    label: 'Marketing',
    icon: 'megaphone',
    children: [
      { label: 'Calendário', href: '/marketing/calendario' },
      { label: 'Depoimentos', href: '/marketing/depoimentos' },
      { label: 'Fotos e Vídeos', href: '/marketing/fotos-videos' },
      { label: 'Material Gráfico', href: '/marketing/material-grafico' },
      { label: 'Manual da Marca', href: '/marketing/manual-da-marca' },
    ],
  },
]

const COLABORADOR_NAV_ITEMS: NavItem[] = [
  {
    label: 'Pessoas',
    icon: 'users',
    children: [
      { label: 'Registro de Ponto',    href: '/pessoas/registro-de-ponto' },
      { label: 'Escala de Trabalho',   href: '/pessoas/escala-de-trabalho' },
      { label: 'Folha de Pagamento',   href: '/pessoas/folha-de-pagamento' },
      { label: 'Benefícios',           href: '/pessoas/beneficios' },
    ],
  },
]

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

interface SidebarProps {
  /** Logos da empresa (Configurações); sem elas, usa as da Casa Empresarial */
  logoUrl?: string | null
  logoReduzidaUrl?: string | null
  role?: string | null
  myEmployeeId?: string | null
  userName?: string
  userAvatar?: string | null
  companies?: { id: string; razao_social: string }[]
}

export function Sidebar({ logoUrl, logoReduzidaUrl, role, myEmployeeId, userName, userAvatar, companies }: SidebarProps) {
  const expanded = useAppStore((s) => s.sidebarExpanded)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const setSidebarExpanded = useAppStore((s) => s.setSidebarExpanded)
  const mobileSidebarOpen = useAppStore((s) => s.mobileSidebarOpen)
  const setMobileSidebarOpen = useAppStore((s) => s.setMobileSidebarOpen)
  const pathname = usePathname()
  const router = useRouter()

  const isColaborador = role === 'colaborador'
  const navItems: NavItem[] = isColaborador
    ? [
        ...COLABORADOR_NAV_ITEMS,
        ...(myEmployeeId ? [{ label: 'Meus Dados', href: `/pessoas/funcionarios/${myEmployeeId}`, icon: 'user' } as NavLeaf] : []),
      ]
    : NAV_ITEMS
  const areaCount = navItems.filter((i) => i.children).length

  // Grupos abertos — o grupo da rota atual abre automaticamente
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  useEffect(() => {
    const active = navItems.find((i) => i.children?.some((c) => pathname.startsWith(c.href)))
    if (active) setOpenGroups((prev) => (prev.has(active.label) ? prev : new Set(prev).add(active.label)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  // Busca — Ctrl/Cmd+K foca o campo
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSidebarExpanded(true)
        setMobileSidebarOpen(true)
        setTimeout(() => searchRef.current?.focus(), 0)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [setSidebarExpanded, setMobileSidebarOpen])

  const results = query.trim()
    ? navItems
        .flatMap((item) =>
          item.children
            ? item.children.map((c) => ({ ...c, group: item.label }))
            : [{ label: item.label, href: item.href, group: null as string | null }],
        )
        .filter((r) => normalize(r.label).includes(normalize(query.trim())))
    : null

  function closeMobile() {
    setMobileSidebarOpen(false)
  }

  function navigateTo(href: string) {
    setQuery('')
    closeMobile()
    router.push(href)
  }

  // Botão "<": no mobile fecha o menu, no desktop recolhe/expande
  function handleToggle() {
    if (window.matchMedia('(min-width: 768px)').matches) toggleSidebar()
    else closeMobile()
  }

  const hideWhenCollapsed = !expanded && 'md:hidden'

  return (
    <>
      {/* Abrir menu — mobile apenas */}
      {!mobileSidebarOpen && (
        <button
          className="md:hidden fixed top-3 left-3 z-30 p-2 rounded-xl border bg-white shadow-sm cursor-pointer"
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Abrir menu"
          style={{ color: 'var(--color-sidebar-text)', borderColor: 'var(--color-brand)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}

      {/* Overlay escuro — mobile apenas */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={closeMobile}
        />
      )}

      <aside
        className={cn(
          'flex flex-col fixed left-3 top-3 bottom-3 z-40 rounded-2xl border-l-[3px] shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)] transition-all duration-200 bg-white',
          // Botões (áreas, busca, recolher, menu do usuário) com cursor de link
          '[&_button]:cursor-pointer',
          // Mobile: sempre 240px. Desktop: 64px retraído ou 240px expandido.
          expanded ? 'w-60' : 'w-60 md:w-16',
          // Mobile: oculto por padrão, desliza ao abrir. Desktop: sempre visível.
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-[calc(100%+1rem)] md:translate-x-0',
        )}
        style={{ borderColor: 'var(--color-brand)' }}
      >
        {/* Logo + recolher */}
        <div className={cn('relative flex flex-col items-center pt-8 pb-5', expanded ? 'px-5' : 'px-5 md:px-2 md:pt-12')}>
          <button
            onClick={handleToggle}
            className={cn(
              'absolute top-3 p-1 rounded-md hover:bg-gray-100 transition-colors',
              expanded ? 'right-3' : 'right-3 md:right-1/2 md:translate-x-1/2',
            )}
            style={{ color: 'var(--color-sidebar-text)' }}
            aria-label={expanded ? 'Recolher menu' : 'Expandir menu'}
          >
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              className={cn('transition-transform', !expanded && 'md:rotate-180')}
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {/* Expandida: logo completa. Retraída (desktop): só o símbolo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl || '/logo-casa-empresarial-completa.svg'}
            alt={logoUrl ? 'Logo da empresa' : 'Casa Empresarial'}
            className={cn('object-contain', hideWhenCollapsed)}
            style={{ maxWidth: 170, maxHeight: 72 }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoReduzidaUrl || '/logo-casa-empresarial-reduzida.svg'}
            alt={logoReduzidaUrl ? 'Logo da empresa' : 'Casa Empresarial'}
            className={cn('hidden object-contain', !expanded && 'md:block')}
            style={{ width: 36, height: 36 }}
          />
        </div>

        {/* Busca */}
        <div className={cn('px-3 mb-4', !expanded && 'md:px-2')}>
          <label
            className={cn('flex items-center gap-2 h-10 px-3 rounded-xl border cursor-text', !expanded && 'md:hidden')}
            style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-muted)' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setQuery('')
                if (e.key === 'Enter' && results?.[0]) navigateTo(results[0].href)
              }}
              placeholder="Buscar"
              className="flex-1 min-w-0 bg-transparent text-sm outline-none"
              style={{ color: 'var(--color-text-primary)' }}
            />
            <kbd
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0"
              style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-sidebar-text)' }}
            >
              Ctrl K
            </kbd>
          </label>
          <button
            onClick={() => { setSidebarExpanded(true); setTimeout(() => searchRef.current?.focus(), 0) }}
            className={cn('hidden w-full h-10 items-center justify-center rounded-xl hover:bg-gray-50', !expanded && 'md:flex')}
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="Buscar"
            title="Buscar (Ctrl K)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className={cn('flex-1 overflow-y-auto px-3', !expanded && 'md:px-2')}>
          {results ? (
            results.length === 0 ? (
              <p className="px-3 py-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Nada encontrado.
              </p>
            ) : (
              results.map((r) => (
                <button
                  key={r.href}
                  onClick={() => navigateTo(r.href)}
                  className="w-full flex flex-col items-start px-3 py-2 rounded-xl mb-0.5 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{r.label}</span>
                  {r.group && <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{r.group}</span>}
                </button>
              ))
            )
          ) : (
            <>
              <div
                className={cn('flex items-center justify-between px-1 mb-2 text-[11px] font-semibold tracking-wider', hideWhenCollapsed)}
                style={{ color: 'var(--color-sidebar-text)' }}
              >
                <span>SUA CASA</span>
                <span>{areaCount} {areaCount === 1 ? 'ÁREA' : 'ÁREAS'}</span>
              </div>

              {navItems.map((item) => {
                if (!item.children) {
                  const active = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeMobile}
                      className={cn(
                        'flex items-center gap-3 px-3 h-11 rounded-xl mb-1 text-[15px] transition-colors',
                        !expanded && 'md:justify-center md:px-0',
                        active ? 'font-bold' : 'font-semibold hover:bg-gray-50',
                      )}
                      style={{
                        fontFamily: 'Manrope',
                        ...(active
                          ? { backgroundColor: 'var(--color-primary-dark)', color: '#FFFFFF' }
                          : { color: 'var(--color-sidebar-text)' }),
                      }}
                      title={!expanded ? item.label : undefined}
                    >
                      <Icon name={item.icon} />
                      <span className={cn('truncate', hideWhenCollapsed)}>{item.label}</span>
                    </Link>
                  )
                }

                const isGroupActive = item.children.some((c) => pathname.startsWith(c.href))
                const isOpen = openGroups.has(item.label)

                return (
                  <div key={item.label} className="mb-1">
                    <button
                      onClick={() => {
                        // Retraído no desktop: expande a sidebar e abre o grupo
                        if (!expanded && window.matchMedia('(min-width: 768px)').matches) {
                          setSidebarExpanded(true)
                          setOpenGroups((prev) => new Set(prev).add(item.label))
                          return
                        }
                        toggleGroup(item.label)
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 h-11 rounded-xl text-[15px] font-semibold transition-colors hover:bg-gray-50',
                        !expanded && 'md:justify-center md:px-0',
                      )}
                      style={{
                        fontFamily: 'Manrope',
                        color: isGroupActive ? 'var(--color-primary-darker)' : 'var(--color-sidebar-text)',
                      }}
                      title={!expanded ? item.label : undefined}
                      aria-expanded={isOpen}
                    >
                      <Icon name={item.icon} />
                      <span className={cn('flex-1 truncate text-left', hideWhenCollapsed)}>{item.label}</span>
                      <svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                        className={cn('shrink-0 transition-transform duration-200', isOpen && 'rotate-180', hideWhenCollapsed)}
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {isOpen && (
                      <div
                        className={cn('ml-[21px] pl-3 border-l mt-0.5 mb-1', hideWhenCollapsed)}
                        style={{ borderColor: 'var(--color-bg-surface)' }}
                      >
                        {item.children.map((child) => {
                          const active = pathname.startsWith(child.href)
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={closeMobile}
                              className={cn(
                                'flex items-center px-3 py-1.5 rounded-lg text-sm transition-colors mb-0.5',
                                active ? 'font-semibold' : 'hover:bg-gray-50',
                              )}
                              style={active
                                ? { backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-darker)' }
                                : { color: 'var(--color-sidebar-text)' }
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
            </>
          )}
        </nav>

        {/* Usuário */}
        <div className={cn('mx-3 mb-3 pt-3 border-t', !expanded && 'md:mx-2')} style={{ borderColor: 'var(--color-bg-surface)' }}>
          <UserMenu
            userName={userName}
            userAvatar={userAvatar}
            companies={companies}
            compact={!expanded}
            onNavigate={closeMobile}
          />
        </div>
      </aside>
    </>
  )
}
