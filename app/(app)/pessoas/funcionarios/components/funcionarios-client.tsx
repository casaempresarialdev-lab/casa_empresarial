'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ModalFuncionario } from './modal-funcionario'
import { ModalViewFuncionario } from './modal-view-funcionario'
import { deleteEmployeeAction } from '../actions'
import type { Employee } from '../queries'
import type { CompanyBenefit } from '../../beneficios/queries'

const TODAY = new Date()
TODAY.setHours(0, 0, 0, 0)

function parseDate(iso: string | null): Date | null {
  if (!iso) return null
  const d = new Date(iso + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}

function diffDays(d: Date): number {
  return Math.ceil((d.getTime() - TODAY.getTime()) / 86400000)
}

type AlertLevel = 'danger' | 'warning' | null

function getFeriasAlert(emp: Employee): AlertLevel {
  const d = parseDate(emp.vcto_ferias)
  if (!d) return null
  const diff = diffDays(d)
  if (diff < 0) return 'danger'
  if (diff <= 30) return 'warning'
  return null
}


const TIPO_CFG: Record<string, { label: string; bg: string; color: string }> = {
  clt:            { label: 'CLT',            bg: '#EBF5FB', color: '#2471A3' },
  pj:             { label: 'PJ',             bg: '#F4F6F7', color: '#566573' },
  estagio:        { label: 'Estágio',        bg: '#FEF9E7', color: '#9A7D0A' },
  menor_aprendiz: { label: 'Menor Aprendiz', bg: '#E9F7EF', color: '#1E8449' },
}

const CONTRATO_CFG: Record<string, { label: string; bg: string; color: string }> = {
  assinado:     { label: 'assinado',     bg: '#E9F7EF', color: '#1E8449' },
  nao_tem:      { label: 'não tem',      bg: '#FDEDEC', color: '#C0392B' },
  nao_assinado: { label: 'não assinado', bg: '#FEF9E7', color: '#9A7D0A' },
}

const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  admissao:    { label: 'Admissão',    bg: '#EBF5FB', color: '#2471A3' },
  experiencia: { label: 'Experiência', bg: '#FEF9E7', color: '#9A7D0A' },
  ativo:       { label: 'Ativo',       bg: '#E9F7EF', color: '#1E8449' },
  ferias:      { label: 'Férias',      bg: '#EAF4FB', color: '#1A5276' },
  afastado:    { label: 'Afastado',    bg: '#F5EEF8', color: '#7D3C98' },
  inativo:     { label: 'Inativo',     bg: '#F4F6F7', color: '#717D7E' },
  demitido:    { label: 'Demitido',    bg: '#FDEDEC', color: '#C0392B' },
}

function ThreeDotMenu({ onView, onEdit, onDelete, loading }: {
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  loading: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const menuRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleOpen() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setOpen((v) => !v)
  }

  return (
    <div>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-lg hover:bg-gray-100 transition-colors"
        style={{ color: 'var(--color-text-muted)' }}
        aria-label="Opções"
      >
        ···
      </button>
      {open && (
        <div
          ref={menuRef}
          className="fixed w-36 rounded-xl border shadow-lg py-1 z-50"
          style={{ backgroundColor: 'white', borderColor: 'var(--color-bg-surface)', top: pos.top, right: pos.right }}
        >
          <button
            type="button"
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onClick={() => { setOpen(false); onView() }}
          >
            Visualizar
          </button>
          <button
            type="button"
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onClick={() => { setOpen(false); onEdit() }}
          >
            Editar
          </button>
          <button
            type="button"
            className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 transition-colors"
            style={{ color: 'var(--color-error)' }}
            onClick={() => { setOpen(false); onDelete() }}
            disabled={loading}
          >
            {loading ? 'Excluindo…' : 'Excluir'}
          </button>
        </div>
      )}
    </div>
  )
}

interface Props {
  employees: Employee[]
  companyId: string
  companyBenefits: CompanyBenefit[]
}

export function FuncionariosClient({ employees, companyId, companyBenefits }: Props) {
  const router = useRouter()
  const [tab, setTab]             = useState<'ativos' | 'inativos'>('ativos')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState<Employee | null>(null)
  const [viewing, setViewing]     = useState<Employee | null>(null)
  const [viewOpen, setViewOpen]   = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const ativos   = employees.filter(e => ['admissao', 'experiencia', 'ativo', 'ferias', 'afastado'].includes(e.status))
  const inativos = employees.filter(e => ['inativo', 'demitido'].includes(e.status))
  const rows     = tab === 'ativos' ? ativos : inativos

  const countByStatus = (s: string) => employees.filter(e => e.status === s).length

  function openView(e: Employee) { setViewing(e); setViewOpen(true) }
  function openEdit(e: Employee) { setEditing(e); setModalOpen(true) }

  function handleEditFromView() {
    if (!viewing) return
    setViewOpen(false)
    setEditing(viewing)
    setModalOpen(true)
  }

  async function handleDelete(e: Employee) {
    if (!confirm(`Excluir ${e.nome}? Esta ação não pode ser desfeita.`)) return
    setDeletingId(e.id)
    const result = await deleteEmployeeAction(e.id)
    setDeletingId(null)
    if ('error' in result) alert(result.error)
    else router.refresh()
  }

  const TAB_BTN = (active: boolean): React.CSSProperties => ({
    padding: '0.5rem 1.25rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: active ? 'var(--color-primary-darker)' : 'var(--color-text-muted)',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid var(--color-primary-darker)' : '2px solid transparent',
  })

  const TH: React.CSSProperties = {
    color: 'var(--color-text-secondary)',
    fontSize: '0.7rem',
    fontWeight: 600,
    padding: '8px 12px',
    whiteSpace: 'nowrap',
    backgroundColor: 'var(--color-bg-surface)',
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Equipe
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Cadastro e acompanhamento da equipe CLT
          </p>
        </div>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {([
          { key: 'admissao',    label: 'Em Admissão'  },
          { key: 'ativo',       label: 'Ativo'         },
          { key: 'ferias',      label: 'Férias'        },
          { key: 'experiencia', label: 'Experiência'   },
          { key: 'afastado',    label: 'Afastado'      },
          { key: 'inativo',     label: 'Inativo'       },
        ] as const).map(({ key, label }) => {
          const cfg   = STATUS_CFG[key]
          const count = countByStatus(key)
          return (
            <div key={key} className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
              <p className="text-2xl font-bold mt-1" style={{ color: count > 0 ? cfg.color : 'var(--color-text-primary)' }}>{count}</p>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs mt-1"
                style={{ backgroundColor: cfg.bg, color: cfg.color, fontSize: '0.62rem' }}>
                {cfg.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: 'var(--color-bg-surface)' }}>
        <button style={TAB_BTN(tab === 'ativos')} onClick={() => setTab('ativos')}>
          Ativos ({ativos.length})
        </button>
        <button style={TAB_BTN(tab === 'inativos')} onClick={() => setTab('inativos')}>
          Inativos ({inativos.length})
        </button>
      </div>

      {/* Tabela */}
      <div className="rounded-b-xl rounded-tr-xl border overflow-x-auto" style={{ borderColor: 'var(--color-bg-surface)', borderTop: 'none', backgroundColor: 'white' }}>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th style={{ ...TH, textAlign: 'left', minWidth: 200 }}>Nome</th>
              <th style={{ ...TH, textAlign: 'left', minWidth: 130 }}>Telefone</th>
              <th style={{ ...TH, textAlign: 'left', minWidth: 180 }}>E-mail</th>
              <th style={{ ...TH, textAlign: 'left', minWidth: 140 }}>Cargo</th>
              <th style={{ ...TH, textAlign: 'right', minWidth: 110 }}>Salário</th>
              <th style={{ ...TH, textAlign: 'center', minWidth: 130 }}>Contrato</th>
              <th style={{ ...TH, minWidth: 70 }} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {tab === 'ativos' ? 'Nenhum funcionário ativo cadastrado.' : 'Nenhum funcionário inativo.'}
                </td>
              </tr>
            )}
            {rows.map((emp, idx) => {
              const tipoCfg     = emp.tipo_contrato ? TIPO_CFG[emp.tipo_contrato] : null
              const contratoCfg = emp.status_contrato ? CONTRATO_CFG[emp.status_contrato] : null
              const statusCfg   = STATUS_CFG[emp.status]
              const rowBg       = idx % 2 === 0 ? 'white' : '#FAFAFA'

              return (
                <tr key={emp.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: rowBg }}>
                  {/* Nome */}
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-xs" style={{ color: 'var(--color-text-primary)' }}>{emp.nome}</p>
                  </td>

                  {/* Telefone */}
                  <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {emp.telefone ?? '—'}
                  </td>

                  {/* E-mail */}
                  <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {emp.email ?? '—'}
                  </td>

                  {/* Cargo */}
                  <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {emp.cargo ?? '—'}
                  </td>

                  {/* Salário */}
                  <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                    {emp.salario != null
                      ? emp.salario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                      : '—'}
                  </td>

                  {/* Tipo + Status Contrato */}
                  <td className="px-3 py-2.5" style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                      {tipoCfg ? (
                        <span style={{ fontSize: '0.62rem', padding: '0.1rem 0.5rem', borderRadius: '999px', backgroundColor: tipoCfg.bg, color: tipoCfg.color, fontWeight: 600 }}>
                          {tipoCfg.label}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>—</span>
                      )}
                      {contratoCfg && (
                        <span style={{ fontSize: '0.58rem', padding: '0.05rem 0.4rem', borderRadius: '999px', backgroundColor: contratoCfg.bg, color: contratoCfg.color, fontWeight: 500 }}>
                          {contratoCfg.label}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Ações */}
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end">
                      <ThreeDotMenu
                        onView={() => openView(emp)}
                        onEdit={() => openEdit(emp)}
                        onDelete={() => handleDelete(emp)}
                        loading={deletingId === emp.id}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ backgroundColor: 'var(--color-bg-surface)', borderTop: '2px solid #E5E7EB' }}>
                <td className="px-3 py-2 text-xs font-bold" colSpan={7} style={{ color: 'var(--color-text-secondary)' }}>
                  {rows.length} {tab === 'ativos' ? 'funcionário' : 'inativo'}{rows.length !== 1 ? 's' : ''}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <ModalViewFuncionario
        open={viewOpen}
        employee={viewing}
        onClose={() => setViewOpen(false)}
        onEdit={handleEditFromView}
        companyBenefits={companyBenefits}
      />

      <ModalFuncionario
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        employee={editing}
        companyBenefits={companyBenefits}
      />
    </>
  )
}
