'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ModalFuncionario } from './modal-funcionario'
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

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function fmtCurrency(v: number | null) {
  if (!v || v === 0) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function diffDays(d: Date): number {
  return Math.ceil((d.getTime() - TODAY.getTime()) / 86400000)
}

type AlertLevel = 'danger' | 'warning' | null

function getRowAlert(emp: Employee): AlertLevel {
  const ferias = parseDate(emp.vcto_ferias)
  const exame = parseDate(emp.exame_periodico)
  const exp2 = parseDate(emp.fim_experiencia_2)
  if (ferias && diffDays(ferias) < 0) return 'danger'
  if (exame && diffDays(exame) < 0) return 'danger'
  if (ferias && diffDays(ferias) <= 30) return 'warning'
  if (exame && diffDays(exame) <= 30) return 'warning'
  if (exp2 && diffDays(exp2) >= 0 && diffDays(exp2) <= 7) return 'warning'
  return null
}

function getFeriasAlert(emp: Employee): AlertLevel {
  const d = parseDate(emp.vcto_ferias)
  if (!d) return null
  const diff = diffDays(d)
  if (diff < 0) return 'danger'
  if (diff <= 30) return 'warning'
  return null
}

function getExameAlert(emp: Employee): AlertLevel {
  const d = parseDate(emp.exame_periodico)
  if (!d) return null
  const diff = diffDays(d)
  if (diff < 0) return 'danger'
  if (diff <= 30) return 'warning'
  return null
}

function getExpAlert(emp: Employee): AlertLevel {
  const d = parseDate(emp.fim_experiencia_2)
  if (!d) return null
  const diff = diffDays(d)
  if (diff >= 0 && diff <= 7) return 'warning'
  return null
}

const CONTRATO_CFG: Record<string, { label: string; bg: string; color: string }> = {
  assinado:     { label: 'assinado',      bg: '#E9F7EF', color: '#1E8449' },
  nao_tem:      { label: 'não tem',       bg: '#FDEDEC', color: '#C0392B' },
  nao_assinado: { label: 'não assinado',  bg: '#FEF9E7', color: '#9A7D0A' },
}

const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  admissao:    { label: 'Admissão',    bg: '#EBF5FB', color: '#2471A3' },
  experiencia: { label: 'Experiência', bg: '#FEF9E7', color: '#9A7D0A' },
  ativo:       { label: 'Ativo',       bg: '#E9F7EF', color: '#1E8449' },
  inativo:     { label: 'Inativo',     bg: '#F4F6F7', color: '#717D7E' },
  demitido:    { label: 'Demitido',    bg: '#FDEDEC', color: '#C0392B' },
}

function AlertIcon({ level }: { level: AlertLevel }) {
  if (!level) return null
  return (
    <span style={{ color: level === 'danger' ? '#C0392B' : '#9A7D0A', fontSize: '0.8rem', marginRight: 3 }}>
      {level === 'danger' ? '⚠' : '△'}
    </span>
  )
}

function DateCell({ iso, alert }: { iso: string | null; alert: AlertLevel }) {
  return (
    <span style={{ color: alert === 'danger' ? '#C0392B' : alert === 'warning' ? '#9A7D0A' : 'inherit' }}>
      {alert && <AlertIcon level={alert} />}
      {fmtDate(iso)}
    </span>
  )
}

interface Props {
  employees: Employee[]
  companyId: string
  companyBenefits: CompanyBenefit[]
}

export function FuncionariosClient({ employees, companyId, companyBenefits }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'ativos' | 'inativos'>('ativos')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const ativos = employees.filter(e => ['admissao', 'experiencia', 'ativo'].includes(e.status))
  const inativos = employees.filter(e => ['inativo', 'demitido'].includes(e.status))
  const rows = tab === 'ativos' ? ativos : inativos

  const folhaBruta = ativos.reduce((s, e) => s + (e.salario ?? 0), 0)
  const custoEstimado = ativos.reduce((s, e) => {
    const sal = e.salario ?? 0
    const peric = e.tem_periculosidade ? sal * 0.3 : 0
    return s + sal + peric + e.vale_alimentacao_valor + e.vale_transporte_valor
  }, 0)
  const alertasFerias = ativos.filter(e => getFeriasAlert(e) !== null).length
  const alertasExame = ativos.filter(e => getExameAlert(e) !== null).length

  const totSalario = rows.reduce((s, e) => s + (e.salario ?? 0), 0)
  const totPericul = rows.reduce((s, e) => s + (e.tem_periculosidade ? (e.salario ?? 0) * 0.3 : 0), 0)
  const totVA = rows.reduce((s, e) => s + e.vale_alimentacao_valor, 0)
  const totVT = rows.reduce((s, e) => s + e.vale_transporte_valor, 0)
  const totCusto = rows.reduce((s, e) => {
    const sal = e.salario ?? 0
    const peric = e.tem_periculosidade ? sal * 0.3 : 0
    return s + sal + peric + e.vale_alimentacao_valor + e.vale_transporte_valor
  }, 0)

  function openEdit(e: Employee) { setEditing(e); setModalOpen(true) }
  function openAdd() { setEditing(null); setModalOpen(true) }

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

  const GRP: React.CSSProperties = { color: 'var(--color-text-secondary)', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', textAlign: 'center', padding: '4px 8px' }
  const COL: React.CSSProperties = { color: 'var(--color-text-secondary)', fontSize: '0.7rem', fontWeight: 500, padding: '4px 8px', whiteSpace: 'nowrap' }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Controle de Funcionários
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Cadastro e acompanhamento da equipe CLT
          </p>
        </div>
        <Button onClick={openAdd}>+ Novo funcionário</Button>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Funcionários ativos</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>{ativos.length}</p>
          {inativos.length > 0 && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              + {inativos.length} inativo{inativos.length > 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Folha bruta</p>
          <p className="text-xl font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>
            {folhaBruta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Sal. bruto dos ativos</p>
        </div>
        <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Custo estimado</p>
          <p className="text-xl font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>
            {custoEstimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Inclui pericul. + benefícios</p>
        </div>
        <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>Alertas</p>
          <div className="flex flex-col gap-1">
            {alertasFerias > 0 ? (
              <span className="text-sm font-bold" style={{ color: '#C0392B' }}>⚠ {alertasFerias} férias</span>
            ) : (
              <span className="text-xs" style={{ color: '#1E8449' }}>✓ Férias ok</span>
            )}
            {alertasExame > 0 ? (
              <span className="text-sm font-bold" style={{ color: '#9A7D0A' }}>△ {alertasExame} exame{alertasExame > 1 ? 's' : ''}</span>
            ) : (
              <span className="text-xs" style={{ color: '#1E8449' }}>✓ Exames ok</span>
            )}
          </div>
        </div>
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

      {/* Tabela com duplo cabeçalho */}
      <div className="rounded-b-xl rounded-tr-xl border overflow-x-auto" style={{ borderColor: 'var(--color-bg-surface)', borderTop: 'none', backgroundColor: 'white' }}>
        <table className="w-full text-sm" style={{ minWidth: 960 }}>
          <thead>
            {/* Linha 1 — grupos */}
            <tr style={{ backgroundColor: 'var(--color-bg-surface)' }}>
              <th colSpan={3} />
              <th colSpan={2} style={{ ...GRP, borderLeft: '2px solid #E5E7EB' }}>Remuneração</th>
              <th colSpan={2} style={{ ...GRP, borderLeft: '2px solid #E5E7EB' }}>Benefícios</th>
              <th style={{ ...GRP, borderLeft: '2px solid #E5E7EB' }}>Custo Est.</th>
              <th colSpan={3} style={{ ...GRP, borderLeft: '2px solid #E5E7EB' }}>Datas Críticas</th>
              <th style={{ ...GRP, borderLeft: '2px solid #E5E7EB' }}>Contrato</th>
              <th />
            </tr>
            {/* Linha 2 — colunas */}
            <tr style={{ backgroundColor: 'var(--color-bg-surface)' }}>
              <th style={{ ...COL, textAlign: 'left', minWidth: 170, position: 'sticky', left: 0, backgroundColor: 'var(--color-bg-surface)', zIndex: 2 }}>Nome</th>
              <th style={{ ...COL, textAlign: 'left', minWidth: 110 }}>Cargo</th>
              <th style={{ ...COL, textAlign: 'left', minWidth: 100 }}>Local</th>
              <th style={{ ...COL, textAlign: 'right', minWidth: 80, borderLeft: '2px solid #E5E7EB' }}>Salário</th>
              <th style={{ ...COL, textAlign: 'right', minWidth: 70 }}>Pericul.</th>
              <th style={{ ...COL, textAlign: 'right', minWidth: 70, borderLeft: '2px solid #E5E7EB' }}>VA</th>
              <th style={{ ...COL, textAlign: 'right', minWidth: 70 }}>VT</th>
              <th style={{ ...COL, textAlign: 'right', minWidth: 84, borderLeft: '2px solid #E5E7EB' }}>Custo Total</th>
              <th style={{ ...COL, textAlign: 'right', minWidth: 78, borderLeft: '2px solid #E5E7EB' }}>Admissão</th>
              <th style={{ ...COL, textAlign: 'right', minWidth: 78 }}>Vcto Férias</th>
              <th style={{ ...COL, textAlign: 'right', minWidth: 78 }}>Exame</th>
              <th style={{ ...COL, textAlign: 'center', minWidth: 90, borderLeft: '2px solid #E5E7EB' }}>Status</th>
              <th style={{ minWidth: 90 }} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={13} className="text-center py-12 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {tab === 'ativos' ? 'Nenhum funcionário ativo cadastrado.' : 'Nenhum funcionário inativo.'}
                </td>
              </tr>
            )}
            {rows.map((emp, idx) => {
              const alert = getRowAlert(emp)
              const feriasAlert = getFeriasAlert(emp)
              const exameAlert = getExameAlert(emp)
              const expAlert = getExpAlert(emp)
              const sal = emp.salario ?? 0
              const pericul = emp.tem_periculosidade ? Math.round(sal * 0.3 * 100) / 100 : 0
              const custo = sal + pericul + emp.vale_alimentacao_valor + emp.vale_transporte_valor
              const contrato = emp.status_contrato ? CONTRATO_CFG[emp.status_contrato] : null
              const statusCfg = STATUS_CFG[emp.status]
              const rowBg = alert === 'danger' ? '#FEF2F2' : alert === 'warning' ? '#FFFBEB' : idx % 2 === 0 ? 'white' : '#FAFAFA'

              return (
                <tr key={emp.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: rowBg }}>
                  <td className="px-3 py-2.5" style={{ position: 'sticky', left: 0, backgroundColor: rowBg, zIndex: 1 }}>
                    <div className="flex items-start gap-1">
                      {alert && <AlertIcon level={alert} />}
                      <div>
                        <p className="font-medium text-xs" style={{ color: 'var(--color-text-primary)' }}>{emp.nome}</p>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs mt-0.5"
                          style={{ backgroundColor: statusCfg.bg, color: statusCfg.color, fontSize: '0.65rem' }}>
                          {statusCfg.label}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{emp.cargo ?? '—'}</td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>{emp.local_trabalho ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right text-xs font-medium" style={{ color: 'var(--color-text-primary)', borderLeft: '2px solid #F3F4F6' }}>
                    {fmtCurrency(sal)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs" style={{ color: pericul > 0 ? '#8E44AD' : 'var(--color-text-muted)' }}>
                    {pericul > 0 ? fmtCurrency(pericul) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs" style={{ color: 'var(--color-text-secondary)', borderLeft: '2px solid #F3F4F6' }}>
                    {fmtCurrency(emp.vale_alimentacao_valor)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {fmtCurrency(emp.vale_transporte_valor)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs font-semibold" style={{ color: '#1E8449', borderLeft: '2px solid #F3F4F6' }}>
                    {fmtCurrency(custo)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs" style={{ borderLeft: '2px solid #F3F4F6' }}>
                    <DateCell iso={emp.data_admissao} alert={expAlert} />
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs">
                    <DateCell iso={emp.vcto_ferias} alert={feriasAlert} />
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs">
                    <DateCell iso={emp.exame_periodico} alert={exameAlert} />
                  </td>
                  <td className="px-3 py-2.5 text-center" style={{ borderLeft: '2px solid #F3F4F6' }}>
                    {contrato ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: contrato.bg, color: contrato.color, fontSize: '0.65rem' }}>
                        {contrato.label}
                      </span>
                    ) : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(emp)}>Editar</Button>
                      <Button variant="danger" size="sm" loading={deletingId === emp.id} onClick={() => handleDelete(emp)}>✕</Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ backgroundColor: 'var(--color-bg-surface)', borderTop: '2px solid #E5E7EB' }}>
                <td className="px-3 py-2 text-xs font-bold" style={{ color: 'var(--color-text-secondary)', position: 'sticky', left: 0, backgroundColor: 'var(--color-bg-surface)', zIndex: 1 }}>
                  TOTAL — {rows.length} {tab === 'ativos' ? 'ativo' : 'inativo'}{rows.length !== 1 ? 's' : ''}
                </td>
                <td colSpan={2} />
                <td className="px-3 py-2 text-right text-xs font-bold" style={{ color: 'var(--color-text-primary)', borderLeft: '2px solid #E5E7EB' }}>
                  {fmtCurrency(totSalario)}
                </td>
                <td className="px-3 py-2 text-right text-xs font-bold" style={{ color: totPericul > 0 ? '#8E44AD' : 'var(--color-text-muted)' }}>
                  {totPericul > 0 ? fmtCurrency(totPericul) : '—'}
                </td>
                <td className="px-3 py-2 text-right text-xs font-bold" style={{ color: 'var(--color-text-secondary)', borderLeft: '2px solid #E5E7EB' }}>
                  {fmtCurrency(totVA)}
                </td>
                <td className="px-3 py-2 text-right text-xs font-bold" style={{ color: 'var(--color-text-secondary)' }}>
                  {fmtCurrency(totVT)}
                </td>
                <td className="px-3 py-2 text-right text-xs font-bold" style={{ color: '#1E8449', borderLeft: '2px solid #E5E7EB' }}>
                  {fmtCurrency(totCusto)}
                </td>
                <td colSpan={5} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-6 mt-3 px-1">
        <span className="text-xs" style={{ color: '#C0392B' }}>⚠ Férias vencidas ou exame vencido</span>
        <span className="text-xs" style={{ color: '#9A7D0A' }}>△ Atenção — prazo ≤ 30 dias</span>
        <span className="text-xs" style={{ color: '#9A7D0A' }}>△ Fim de experiência em ≤ 7 dias</span>
      </div>

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
