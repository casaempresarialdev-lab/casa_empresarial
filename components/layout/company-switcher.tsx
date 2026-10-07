'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export type SwitcherCompany = {
  id: string
  razao_social: string
  role?: string
  logo_url?: string | null
  cor_primaria?: string | null
}

interface Props {
  companies: SwitcherCompany[]
  activeCompanyId: string | null
  onSelect: (id: string) => void
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  member: 'Membro',
  accountant: 'Contador',
  colaborador: 'Colaborador',
}

function initialsOf(name: string) {
  return name.trim().slice(0, 2).toUpperCase()
}

function CompanyRow({ company, active, onClick }: { company: SwitcherCompany; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors', active ? '' : 'hover:bg-gray-50')}
      style={active ? { backgroundColor: 'var(--color-primary)' } : undefined}
    >
      {company.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={company.logo_url} alt="" className="w-7 h-7 rounded-md object-cover shrink-0" />
      ) : (
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0 text-white"
          style={{ backgroundColor: company.cor_primaria || '#C19A6B' }}
        >
          {initialsOf(company.razao_social)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{company.razao_social}</p>
        {company.role && (
          <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{ROLE_LABELS[company.role] ?? company.role}</p>
        )}
      </div>
      {active && <span className="text-xs shrink-0" style={{ color: 'var(--color-primary-darker)' }}>✓</span>}
    </button>
  )
}

export function CompanySwitcher({ companies, activeCompanyId, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const active = companies.find(c => c.id === activeCompanyId)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return term ? companies.filter(c => c.razao_social.toLowerCase().includes(term)) : companies
  }, [companies, search])

  const minhas = filtered.filter(c => c.role === 'owner')
  const apoio = filtered.filter(c => c.role !== 'owner')

  if (companies.length <= 1) {
    return (
      <span className="text-sm font-medium truncate max-w-[140px] md:max-w-none" style={{ color: 'var(--color-text-secondary)' }}>
        {active?.razao_social ?? ''}
      </span>
    )
  }

  function handleSelect(id: string) {
    onSelect(id)
    setOpen(false)
    setSearch('')
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 hover:bg-gray-50 transition-colors max-w-[180px] md:max-w-[240px]"
        style={{ borderColor: 'var(--color-bg-surface)' }}
      >
        {active?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={active.logo_url} alt="" className="w-5 h-5 rounded object-cover shrink-0" />
        ) : (
          <div
            className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold shrink-0 text-white"
            style={{ backgroundColor: active?.cor_primaria || '#C19A6B' }}
          >
            {initialsOf(active?.razao_social ?? '?')}
          </div>
        )}
        <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-secondary)' }}>
          {active?.razao_social ?? 'Selecionar empresa'}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          className={cn('shrink-0 transition-transform', open && 'rotate-180')} style={{ color: 'var(--color-text-muted)' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-2 w-72 rounded-xl border shadow-lg z-50 max-h-[70vh] overflow-y-auto"
          style={{ backgroundColor: 'white', borderColor: 'var(--color-bg-surface)' }}
        >
          {companies.length > 6 && (
            <div className="p-2 border-b sticky top-0 bg-white" style={{ borderColor: 'var(--color-bg-surface)' }}>
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar empresa..."
                className="w-full text-sm px-2.5 py-1.5 rounded-lg border"
                style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
              />
            </div>
          )}

          <div className="py-1">
            {minhas.length > 0 && (
              <>
                <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                  Minhas empresas
                </p>
                {minhas.map(c => <CompanyRow key={c.id} company={c} active={c.id === activeCompanyId} onClick={() => handleSelect(c.id)} />)}
              </>
            )}
            {apoio.length > 0 && (
              <>
                <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                  Empresas que apoio
                </p>
                {apoio.map(c => <CompanyRow key={c.id} company={c} active={c.id === activeCompanyId} onClick={() => handleSelect(c.id)} />)}
              </>
            )}
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>Nenhuma empresa encontrada.</p>
            )}
          </div>

          <div className="border-t py-1" style={{ borderColor: 'var(--color-bg-surface)' }}>
            <Link
              href="/empresa?nova=1"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
              style={{ color: 'var(--color-primary-darker)' }}
            >
              <span>+</span> Nova empresa
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
