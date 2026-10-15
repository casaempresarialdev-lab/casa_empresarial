'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { parseAreaPermissions, FULL_AREA_PERMISSIONS, type AreaKey, type AreaPermissions } from '@/lib/auth/area-permissions'
import { ThreeDotMenu, type ThreeDotMenuItem } from '@/components/shared/three-dot-menu'
import { ModalItemMenu, type ItemMenuMode } from './modal-item-menu'
import { SidebarProfileMenu } from './sidebar-profile-menu'
import type { SwitcherCompany } from './company-switcher'
import {
  createAreaAction, addSubItemAction, renameItemAction,
  changeItemIconAction, deleteItemAction, reorderItemsAction,
} from '@/lib/menu/actions'
import type { MenuArea, MenuSubItem } from '@/lib/menu/queries'
import type { CustomItemType } from '@/lib/menu/catalog'

type NavLeaf  = { label: string; href: string; icon: string; children?: never; areaKey?: never }
type NavGroup = { label: string; href?: never; icon: string; areaKey?: AreaKey; children: { label: string; href: string }[] }
type NavItem  = NavLeaf | NavGroup

const DASHBOARD_ITEM: NavLeaf = { label: 'Visão geral', href: '/dashboard', icon: '⊞' }

// Fallback estático — só usado se a árvore do banco vier vazia (falha de leitura).
const NAV_ITEMS: NavItem[] = [
  DASHBOARD_ITEM,
  {
    label: 'Administrativo',
    icon: '🏢',
    areaKey: 'administrativo',
    children: [
      { label: 'Minha Empresa', href: '/empresa' },
      { label: 'Quadro Societário', href: '/admin/quadro-societario' },
      { label: 'Logins e Senhas', href: '/admin/logins-senhas' },
      { label: 'Documentação', href: '/admin/documentacao' },
    ],
  },
  {
    label: 'Financeiro',
    icon: '💰',
    areaKey: 'financeiro',
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
    label: 'Operacional',
    icon: '📦',
    areaKey: 'operacional',
    children: [
      { label: 'Produtos e Serviços', href: '/operacional/produtos' },
      { label: 'Pedidos de Compra', href: '/operacional/pedidos-compra' },
      { label: 'Pedidos de Venda', href: '/operacional/pedidos-venda' },
      { label: 'Ordens de Serviço', href: '/operacional/ordens-de-servico' },
      { label: 'Frente de Caixa', href: '/operacional/frente-de-caixa' },
    ],
  },
  {
    label: 'Pessoas',
    icon: '👥',
    areaKey: 'pessoas',
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
    label: 'Marketing',
    icon: '📣',
    areaKey: 'marketing',
    children: [
      { label: 'Calendário', href: '/marketing/calendario' },
      { label: 'Depoimentos', href: '/marketing/depoimentos' },
      { label: 'Fotos e Vídeos', href: '/marketing/fotos-videos' },
      { label: 'Material Gráfico', href: '/marketing/material-grafico' },
      { label: 'Manual da Marca', href: '/marketing/manual-da-marca' },
    ],
  },
]

interface SidebarProps {
  logoUrl?: string | null
  role?: string | null
  myEmployeeId?: string | null
  areaPermissions?: AreaPermissions | Record<string, string> | null
  companyId?: string | null
  menuTree?: MenuArea[]
  companies?: SwitcherCompany[]
  userName?: string
  userEmail?: string
  userAvatar?: string | null
}

function hrefForSubItem(sub: MenuSubItem): string {
  if (sub.href) return sub.href
  if (sub.tipo === 'pasta') return `/menu/pasta/${sub.id}`
  return `/menu/em-breve/${sub.id}`
}

const COLABORADOR_NAV_ITEMS: NavItem[] = [
  {
    label: 'Pessoas',
    icon: '👥',
    children: [
      { label: 'Registro de Ponto',    href: '/pessoas/registro-de-ponto' },
      { label: 'Escala de Trabalho',   href: '/pessoas/escala-de-trabalho' },
      { label: 'Folha de Pagamento',   href: '/pessoas/folha-de-pagamento' },
      { label: 'Benefícios',           href: '/pessoas/beneficios' },
    ],
  },
]

export function Sidebar({
  logoUrl, role, myEmployeeId, areaPermissions, companyId, menuTree,
  companies = [], userName, userEmail, userAvatar,
}: SidebarProps) {
  const router = useRouter()
  const expanded = useAppStore((s) => s.sidebarExpanded)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const mobileSidebarOpen = useAppStore((s) => s.mobileSidebarOpen)
  const setMobileSidebarOpen = useAppStore((s) => s.setMobileSidebarOpen)
  const activeCompanyId = useAppStore((s) => s.activeCompanyId)
  const setActiveCompany = useAppStore((s) => s.setActiveCompany)
  const pathname = usePathname()

  // Árvore local (pra feedback instantâneo ao arrastar) — resincroniza sempre que o
  // servidor manda uma versão nova (depois de um router.refresh()). Nunca usar
  // useState(menuTree) sozinho aqui: a prop fica "congelada" na primeira renderização
  // e não acompanha updates vindos do servidor.
  const [localTree, setLocalTree] = useState<MenuArea[]>(menuTree ?? [])
  useEffect(() => { setLocalTree(menuTree ?? []) }, [menuTree])

  // Cada área abre/fecha de forma independente — e começa tudo fechado, igual o
  // protótipo da Carol (esse estado é só de tela, não é salvo em lugar nenhum).
  const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>({})
  const [itemMenuMode, setItemMenuMode] = useState<ItemMenuMode | null>(null)
  const dragRef = useRef<{ id: string; parentId: string | null } | null>(null)

  // Busca — igual ao artefato da Carol: campo acima do menu + atalho Ctrl/Cmd+K.
  const [search, setSearch] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  const isColaborador = role === 'colaborador'
  const isOwner = role === 'owner'
  const resolvedPermissions = isOwner ? FULL_AREA_PERMISSIONS : parseAreaPermissions(areaPermissions)
  const visibleAreas = localTree.filter(area => !area.areaKey || resolvedPermissions[area.areaKey] !== 'nenhum')
  const useDynamicTree = !isColaborador && localTree.length > 0

  const searchTerm = search.trim().toLowerCase()
  const searchedAreas = useMemo(() => {
    if (!searchTerm) return visibleAreas
    return visibleAreas
      .map(area => {
        const areaMatches = area.displayLabel.toLowerCase().includes(searchTerm)
        const children = areaMatches ? area.children : area.children.filter(c => c.displayLabel.toLowerCase().includes(searchTerm))
        return { ...area, children }
      })
      .filter(area => area.displayLabel.toLowerCase().includes(searchTerm) || area.children.length > 0)
  }, [visibleAreas, searchTerm])

  const navItems: NavItem[] = isColaborador
    ? [
        ...COLABORADOR_NAV_ITEMS,
        ...(myEmployeeId ? [{ label: 'Meus Dados', href: `/pessoas/funcionarios/${myEmployeeId}`, icon: '🙋' } as NavLeaf] : []),
      ]
    : NAV_ITEMS.filter(item => !item.areaKey || resolvedPermissions[item.areaKey] !== 'nenhum')

  function closeMobile() {
    setMobileSidebarOpen(false)
  }

  function toggleArea(areaId: string) {
    setExpandedAreas(prev => ({ ...prev, [areaId]: !prev[areaId] }))
  }

  async function handleCreateArea(label: string) {
    if (!companyId) return
    await createAreaAction(companyId, label)
    router.refresh()
  }

  async function handleAddSubItem(areaId: string, tipo: CustomItemType, label: string) {
    if (!companyId) return
    await addSubItemAction(companyId, areaId, tipo, label)
    setExpandedAreas(prev => ({ ...prev, [areaId]: true }))
    router.refresh()
  }

  async function handleRename(itemId: string, label: string) {
    if (!companyId) return
    await renameItemAction(itemId, companyId, label)
    router.refresh()
  }

  async function handleChangeIcon(itemId: string, icon: string) {
    if (!companyId) return
    await changeItemIconAction(itemId, companyId, icon)
    router.refresh()
  }

  async function handleDelete(kind: 'área' | 'sub-área', itemId: string, label: string) {
    if (!companyId) return
    const msg = kind === 'área'
      ? `Excluir esta área ("${label}") e todas as suas sub-áreas? Essa ação não pode ser desfeita.`
      : `Excluir esta sub-área ("${label}")? Essa ação não pode ser desfeita.`
    if (!confirm(msg)) return
    await deleteItemAction(itemId, companyId)
    router.refresh()
  }

  function areaMenuItems(area: MenuArea): ThreeDotMenuItem[] {
    const items: ThreeDotMenuItem[] = [
      { label: 'Alterar ícone', onClick: () => setItemMenuMode({ kind: 'icone', itemId: area.id, currentIcon: area.icon }) },
      { label: 'Renomear', onClick: () => setItemMenuMode({ kind: 'renomear', itemId: area.id, currentLabel: area.displayLabel }) },
    ]
    if (area.natureza === 'personalizada') {
      items.push({ label: 'Excluir', danger: true, onClick: () => handleDelete('área', area.id, area.displayLabel) })
    }
    return items
  }

  function subMenuItems(sub: MenuSubItem): ThreeDotMenuItem[] {
    const items: ThreeDotMenuItem[] = [
      { label: 'Alterar ícone', onClick: () => setItemMenuMode({ kind: 'icone', itemId: sub.id, currentIcon: sub.icon }) },
      { label: 'Renomear', onClick: () => setItemMenuMode({ kind: 'renomear', itemId: sub.id, currentLabel: sub.displayLabel }) },
    ]
    if (sub.natureza === 'personalizada') {
      items.push({ label: 'Excluir', danger: true, onClick: () => handleDelete('sub-área', sub.id, sub.displayLabel) })
    }
    return items
  }

  // Arrastar-e-soltar — só entre irmãos do mesmo nível (área com área; sub-área só
  // dentro da própria área). Atualiza a tela na hora e confirma com o servidor depois.
  async function handleDropOnArea(targetId: string) {
    const dragged = dragRef.current
    dragRef.current = null
    if (!dragged || dragged.parentId !== null || dragged.id === targetId || !companyId) return

    const ids = visibleAreas.map(a => a.id)
    const from = ids.indexOf(dragged.id)
    const to = ids.indexOf(targetId)
    if (from === -1 || to === -1) return
    ids.splice(to, 0, ids.splice(from, 1)[0])

    setLocalTree(prev => {
      const byId = new Map(prev.map(a => [a.id, a]))
      return ids.map(id => byId.get(id)).filter((a): a is MenuArea => !!a)
        .concat(prev.filter(a => !ids.includes(a.id)))
    })
    await reorderItemsAction(companyId, null, ids)
    router.refresh()
  }

  async function handleDropOnSub(areaId: string, targetId: string) {
    const dragged = dragRef.current
    dragRef.current = null
    if (!dragged || dragged.parentId !== areaId || dragged.id === targetId || !companyId) return

    const area = localTree.find(a => a.id === areaId)
    if (!area) return
    const ids = area.children.map(s => s.id)
    const from = ids.indexOf(dragged.id)
    const to = ids.indexOf(targetId)
    if (from === -1 || to === -1) return
    ids.splice(to, 0, ids.splice(from, 1)[0])

    setLocalTree(prev => prev.map(a => {
      if (a.id !== areaId) return a
      const byId = new Map(a.children.map(s => [s.id, s]))
      return { ...a, children: ids.map(id => byId.get(id)).filter((s): s is MenuSubItem => !!s) }
    }))
    await reorderItemsAction(companyId, areaId, ids)
    router.refresh()
  }

  return (
    <>
      {/* Overlay escuro — mobile apenas */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={closeMobile}
        />
      )}

      <aside
        className={cn(
          'flex flex-col h-screen fixed left-0 top-0 z-40 border-r transition-all duration-200 bg-white',
          expanded ? 'w-60' : 'w-60 md:w-16',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
        style={{ borderColor: 'var(--color-bg-surface)' }}
      >
        {/* Logo / nome */}
        <div
          className={cn('flex items-center h-16 border-b', expanded ? 'px-4' : 'px-4 md:px-2')}
          style={{ borderColor: 'var(--color-bg-surface)' }}
        >
          {logoUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt="Logo da empresa"
                className={cn('object-contain', !expanded && 'md:hidden')}
                style={{ maxHeight: 48, maxWidth: 200 }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt="Logo da empresa"
                className={cn('object-contain hidden', !expanded && 'md:block')}
                style={{ maxHeight: 40, maxWidth: 40 }}
              />
            </>
          ) : (
            <>
              <span
                className={cn('font-bold text-base', !expanded && 'md:hidden')}
                style={{ fontFamily: 'Manrope', color: 'var(--color-primary-darker)' }}
              >
                Casa Empresarial
              </span>
              <span
                className={cn('font-bold text-lg hidden', !expanded && 'md:block')}
                style={{ color: 'var(--color-primary-darker)' }}
              >
                CE
              </span>
            </>
          )}
        </div>

        {/* Busca */}
        {useDynamicTree && (
          <div className={cn('flex items-center gap-2 px-3 py-2.5 border-b', !expanded && 'md:justify-center md:px-2')}
            style={{ borderColor: 'var(--color-bg-surface)' }}>
            <span className="text-sm shrink-0" style={{ color: 'var(--color-text-muted)' }}>🔎</span>
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar"
              className={cn('flex-1 min-w-0 text-sm bg-transparent focus:outline-none', !expanded && 'md:hidden')}
              style={{ color: 'var(--color-text-primary)' }}
            />
          </div>
        )}

        {/* Rótulo "Sua casa / N áreas" */}
        {useDynamicTree && (
          <div className={cn('flex items-center justify-between px-3 pt-2 text-[10px] font-bold uppercase tracking-wider', !expanded && 'md:hidden')}
            style={{ color: 'var(--color-text-muted)' }}>
            <span>Sua casa</span>
            <span>{visibleAreas.length} área{visibleAreas.length === 1 ? '' : 's'}</span>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {useDynamicTree ? (
            <>
              <Link
                href={DASHBOARD_ITEM.href}
                onClick={closeMobile}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg mb-1 text-sm transition-colors',
                  pathname === DASHBOARD_ITEM.href ? 'font-semibold' : 'hover:bg-gray-50'
                )}
                style={pathname === DASHBOARD_ITEM.href
                  ? { backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-darker)' }
                  : { color: 'var(--color-text-secondary)' }
                }
              >
                <span className="text-base shrink-0">{DASHBOARD_ITEM.icon}</span>
                <span className={cn('truncate', !expanded && 'md:hidden')}>{DASHBOARD_ITEM.label}</span>
              </Link>

              {searchedAreas.map((area) => {
                const isOpen = searchTerm ? true : !!expandedAreas[area.id]
                const isGroupActive = area.children.some(c => pathname.startsWith(hrefForSubItem(c)))

                return (
                  <div key={area.id} className="mb-0.5">
                    <div
                      draggable={expanded}
                      onDragStart={() => { dragRef.current = { id: area.id, parentId: null } }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDropOnArea(area.id)}
                      onClick={() => toggleArea(area.id)}
                      className="group flex items-center gap-2 px-2 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-gray-50 transition-colors"
                      style={{ color: isGroupActive ? 'var(--color-primary-darker)' : 'var(--color-text-muted)' }}
                      title={!expanded ? area.displayLabel : undefined}
                    >
                      <span className="text-base shrink-0">{area.icon}</span>
                      <span className={cn('flex-1 truncate', !expanded && 'md:hidden')}>{area.displayLabel}</span>
                      {expanded && (
                        <>
                          <ThreeDotMenu
                            items={areaMenuItems(area)}
                            note={area.natureza === 'nativa' ? 'Área fixa do método' : undefined}
                            hoverOnly
                          />
                          <svg
                            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                            className="shrink-0 transition-transform"
                            style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </>
                      )}
                    </div>

                    {isOpen && (
                      <div className={cn('ml-4 pl-3 border-l', !expanded && 'md:hidden')} style={{ borderColor: 'var(--color-bg-surface)' }}>
                        {area.children.map((sub) => {
                          const active = pathname.startsWith(hrefForSubItem(sub))
                          return (
                            <div
                              key={sub.id}
                              draggable
                              onDragStart={(e) => { e.stopPropagation(); dragRef.current = { id: sub.id, parentId: area.id } }}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => { e.stopPropagation(); handleDropOnSub(area.id, sub.id) }}
                              className="group flex items-center gap-1 rounded-lg mb-0.5 transition-colors"
                              style={active
                                ? { backgroundColor: 'var(--color-primary)' }
                                : undefined
                              }
                            >
                              <Link
                                href={hrefForSubItem(sub)}
                                onClick={closeMobile}
                                className="flex-1 min-w-0 flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg hover:bg-gray-50"
                                style={active
                                  ? { color: 'var(--color-primary-darker)', fontWeight: 600 }
                                  : { color: 'var(--color-text-secondary)' }
                                }
                              >
                                {sub.icon && <span className="text-sm shrink-0">{sub.icon}</span>}
                                <span className="truncate">{sub.displayLabel}</span>
                              </Link>
                              <ThreeDotMenu
                                items={subMenuItems(sub)}
                                note={sub.natureza === 'nativa' ? 'Sub-área fixa do método' : undefined}
                                hoverOnly
                              />
                            </div>
                          )
                        })}
                        <button
                          type="button"
                          onClick={() => setItemMenuMode({ kind: 'adicionar', areaId: area.id, areaLabel: area.displayLabel })}
                          className="w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors hover:bg-gray-50"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          + Adicionar
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}

              <button
                type="button"
                onClick={() => setItemMenuMode({ kind: 'nova-area' })}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-1 mt-2 text-sm border border-dashed transition-colors hover:bg-gray-50"
                style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-bg-surface)' }}
                title={!expanded ? 'Nova área' : undefined}
              >
                <span className="text-base shrink-0">+</span>
                <span className={cn('truncate', !expanded && 'md:hidden')}>Nova área</span>
              </button>
            </>
          ) : (
            navItems.map((item) => {
              if (!item.children) {
                const active = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMobile}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg mb-1 text-sm transition-colors',
                      active ? 'font-semibold' : 'hover:bg-gray-50'
                    )}
                    style={active
                      ? { backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-darker)' }
                      : { color: 'var(--color-text-secondary)' }
                    }
                    title={!expanded ? item.label : undefined}
                  >
                    <span className="text-base shrink-0">{item.icon}</span>
                    <span className={cn('truncate', !expanded && 'md:hidden')}>{item.label}</span>
                  </Link>
                )
              }

              const isGroupActive = item.children.some(c => pathname.startsWith(c.href))

              return (
                <div key={item.label} className="mb-1">
                  <div
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium"
                    style={{ color: isGroupActive ? 'var(--color-primary-darker)' : 'var(--color-text-muted)' }}
                    title={!expanded ? item.label : undefined}
                  >
                    <span className="text-base shrink-0">{item.icon}</span>
                    <span className={cn('truncate', !expanded && 'md:hidden')}>{item.label}</span>
                  </div>

                  <div
                    className={cn('ml-4 pl-3 border-l', !expanded && 'md:hidden')}
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
                </div>
              )
            })
          )}
        </nav>

        {/* Avatar — igual ao artefato da Carol: rodapé do menu, não mais no header */}
        {!isColaborador && (
          <SidebarProfileMenu
            companies={companies}
            activeCompanyId={activeCompanyId}
            onSelectCompany={setActiveCompany}
            userName={userName}
            userEmail={userEmail}
            userAvatar={userAvatar}
            role={role}
            myEmployeeId={myEmployeeId}
            expanded={expanded}
          />
        )}

        {/* Toggle — desktop apenas */}
        <button
          onClick={toggleSidebar}
          className="hidden md:block m-3 p-2 rounded-lg text-sm hover:bg-gray-100 transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
          aria-label={expanded ? 'Recolher menu' : 'Expandir menu'}
        >
          {expanded ? '◀' : '▶'}
        </button>

        {/* Fechar — mobile apenas */}
        <button
          onClick={closeMobile}
          className="md:hidden m-3 p-2 rounded-lg text-sm hover:bg-gray-100 transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
          aria-label="Fechar menu"
        >
          ✕ Fechar
        </button>
      </aside>

      {useDynamicTree && (
        <ModalItemMenu
          mode={itemMenuMode}
          onClose={() => setItemMenuMode(null)}
          onCreateArea={handleCreateArea}
          onAddSubItem={handleAddSubItem}
          onRename={handleRename}
          onChangeIcon={handleChangeIcon}
        />
      )}
    </>
  )
}
