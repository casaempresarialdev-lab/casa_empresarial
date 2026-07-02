'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ModalAliquota } from './modal-aliquota'
import { deleteAliquotaAction, seedDefaultAliquotasAction } from '../actions'
import type { EmployeeEncargo, AliquotaRow } from '../queries'

interface Props {
  employees: EmployeeEncargo[]
  aliquotas: AliquotaRow[]
  companyId: string
}

const FALLBACK_ALIQUOTAS: AliquotaRow[] = [
  { id: '', company_id: '', nome: 'FGTS', percentual: 8.00, ativo: true, ordem: 1, created_at: '' },
  { id: '', company_id: '', nome: 'INSS Patronal', percentual: 20.00, ativo: true, ordem: 2, created_at: '' },
  { id: '', company_id: '', nome: 'RAT/FAP', percentual: 2.00, ativo: true, ordem: 3, created_at: '' },
  { id: '', company_id: '', nome: 'Sistema S', percentual: 5.80, ativo: true, ordem: 4, created_at: '' },
  { id: '', company_id: '', nome: '13º Salário', percentual: 8.33, ativo: true, ordem: 5, created_at: '' },
  { id: '', company_id: '', nome: 'Férias + 1/3', percentual: 11.11, ativo: true, ordem: 6, created_at: '' },
]

const DIAS_UTEIS_MES = 22

function calcFgts(salario: number, aliquotas: AliquotaRow[]): number {
  const fgts = aliquotas.find(a => a.ativo && a.nome.toUpperCase().includes('FGTS'))
  return salario * ((fgts?.percentual ?? 8) / 100)
}

function calcOutrosEncargos(salario: number, aliquotas: AliquotaRow[]): number {
  return aliquotas
    .filter(a => a.ativo && !a.nome.toUpperCase().includes('FGTS'))
    .reduce((s, a) => s + salario * (a.percentual / 100), 0)
}

function calcBeneficios(emp: EmployeeEncargo): number {
  return emp.employee_benefits
    .filter(eb => !eb.benefit.desconta_salario)
    .reduce((sum, eb) => {
      const valor = eb.valor_override ?? eb.benefit.valor
      return sum + (eb.benefit.por_dia_trabalhado ? valor * DIAS_UTEIS_MES : valor)
    }, 0)
}

function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtPct(v: number) {
  return `${v.toFixed(2).replace('.', ',')}%`
}

// ── CSV Export ──
function buildCustoCsv(employees: EmployeeEncargo[], aliquotas: AliquotaRow[]): string {
  const header = [
    'Funcionário', 'Cargo', 'Salário', 'FGTS (8%)', 'Outros Encargos', 'Total Encargos',
    'Benefícios Patronais', 'Custo Total',
  ].join(';')

  const rows = employees.map(emp => {
    const sal  = emp.salario ?? 0
    const fgts = calcFgts(sal, aliquotas)
    const out  = calcOutrosEncargos(sal, aliquotas)
    const ben  = calcBeneficios(emp)
    return [
      emp.nome,
      emp.cargo ?? '',
      sal.toFixed(2).replace('.', ','),
      fgts.toFixed(2).replace('.', ','),
      out.toFixed(2).replace('.', ','),
      (fgts + out).toFixed(2).replace('.', ','),
      ben.toFixed(2).replace('.', ','),
      (sal + fgts + out + ben).toFixed(2).replace('.', ','),
    ].join(';')
  })

  return [header, ...rows].join('\n')
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function EncargosClient({ employees, aliquotas, companyId }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAliquota, setEditingAliquota] = useState<AliquotaRow | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)

  const usingFallback = aliquotas.length === 0
  const effectiveAliquotas = usingFallback ? FALLBACK_ALIQUOTAS : aliquotas
  const totalPct  = effectiveAliquotas.filter(a => a.ativo).reduce((s, a) => s + a.percentual, 0)
  const fgtsPct   = effectiveAliquotas.find(a => a.ativo && a.nome.toUpperCase().includes('FGTS'))?.percentual ?? 8
  const outrosPct = totalPct - fgtsPct

  const filtered = employees.filter(e =>
    !search || e.nome.toLowerCase().includes(search.toLowerCase())
  )

  const totalFolha      = employees.reduce((s, e) => s + (e.salario ?? 0), 0)
  const totalFgts       = employees.reduce((s, e) => s + calcFgts(e.salario ?? 0, effectiveAliquotas), 0)
  const totalOutrosEnc  = employees.reduce((s, e) => s + calcOutrosEncargos(e.salario ?? 0, effectiveAliquotas), 0)
  const totalEncargos   = totalFgts + totalOutrosEnc
  const totalBeneficios = employees.reduce((s, e) => s + calcBeneficios(e), 0)

  function openAdd() { setEditingAliquota(null); setModalOpen(true) }
  function openEdit(a: AliquotaRow) { setEditingAliquota(a); setModalOpen(true) }

  async function handleDelete(a: AliquotaRow) {
    if (!confirm(`Excluir alíquota "${a.nome}"?`)) return
    setDeletingId(a.id)
    const result = await deleteAliquotaAction(a.id)
    setDeletingId(null)
    if ('error' in result) alert(result.error)
    else router.refresh()
  }

  async function handleSeed() {
    setSeeding(true)
    const result = await seedDefaultAliquotasAction(companyId)
    setSeeding(false)
    if ('error' in result) alert(result.error)
    else router.refresh()
  }

  function handleExportCsv() {
    downloadCsv(buildCustoCsv(employees, effectiveAliquotas), 'custo-funcionarios.csv')
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Encargos Trabalhistas
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Estimativa de custo patronal por funcionário
          </p>
        </div>
        {employees.length > 0 && (
          <Button variant="ghost" onClick={handleExportCsv}>↓ Exportar custo CSV</Button>
        )}
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Total salários</p>
          <p className="text-xl font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>{fmtCurrency(totalFolha)}</p>
        </div>
        <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>FGTS mensal</p>
          <p className="text-xl font-bold mt-1" style={{ color: '#E67E22' }}>{fmtCurrency(totalFgts)}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{fmtPct(fgtsPct)} sobre salário</p>
        </div>
        <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Outros encargos + prov.</p>
          <p className="text-xl font-bold mt-1" style={{ color: '#C0392B' }}>{fmtCurrency(totalOutrosEnc)}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{fmtPct(outrosPct)} sobre salário</p>
        </div>
        <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Custo total empresa</p>
          <p className="text-xl font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>{fmtCurrency(totalFolha + totalEncargos + totalBeneficios)}</p>
        </div>
      </div>

      {/* Gerenciamento de Alíquotas */}
      <div className="p-4 rounded-xl border mb-4" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
              ALÍQUOTAS DE ENCARGOS
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Total ativo: <strong style={{ color: '#C0392B' }}>{fmtPct(totalPct)}</strong> sobre o salário
              {' '}· FGTS: <strong style={{ color: '#E67E22' }}>{fmtPct(fgtsPct)}</strong>
              {' '}· Outros: <strong style={{ color: '#C0392B' }}>{fmtPct(outrosPct)}</strong>
            </p>
          </div>
          <Button size="sm" onClick={openAdd}>Adicionar</Button>
        </div>

        {usingFallback ? (
          <div
            className="p-3 rounded-lg flex items-start justify-between gap-4"
            style={{ backgroundColor: '#FEF9E7', borderLeft: '3px solid #F4D03F' }}
          >
            <div>
              <p className="text-xs font-semibold" style={{ color: '#9A7D0A' }}>
                Usando alíquotas padrão CLT
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#B7950B' }}>
                Os cálculos usam referências CLT. Clique em "Inicializar" para salvar e personalizar as alíquotas desta empresa.
              </p>
            </div>
            <Button size="sm" variant="ghost" loading={seeding} onClick={handleSeed}>
              Inicializar padrões
            </Button>
          </div>
        ) : (
          <div className="rounded-lg overflow-hidden border" style={{ borderColor: 'var(--color-bg-surface)' }}>
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-xs" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
                  <th className="text-left px-3 py-2 font-medium text-xs" style={{ color: 'var(--color-text-secondary)' }}>Nome / Descrição</th>
                  <th className="text-right px-3 py-2 font-medium text-xs" style={{ color: 'var(--color-text-secondary)' }}>Percentual</th>
                  <th className="px-3 py-2 w-24" />
                </tr>
              </thead>
              <tbody>
                {aliquotas.map(a => (
                  <tr key={a.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
                    <td className="px-3 py-2">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: a.ativo ? '#E9F7EF' : '#F4F6F7',
                          color: a.ativo ? '#1E8449' : '#717D7E',
                        }}
                      >
                        {a.ativo ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td className="px-3 py-2" style={{ color: a.ativo ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                      {a.nome}
                      {a.nome.toUpperCase().includes('FGTS') && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#FEF3E7', color: '#E67E22' }}>
                          depósito mensal
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold"
                      style={{ color: a.ativo ? (a.nome.toUpperCase().includes('FGTS') ? '#E67E22' : '#C0392B') : 'var(--color-text-muted)' }}>
                      {fmtPct(a.percentual)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openEdit(a)}
                          className="text-xs px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(a)}
                          disabled={deletingId === a.id}
                          className="text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors"
                          style={{ color: '#C0392B' }}
                        >
                          {deletingId === a.id ? '...' : 'Excluir'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs mt-3" style={{ color: 'var(--color-text-muted)' }}>
          * Estimativa. Valores reais variam conforme RAT/FAP, atividade e regime tributário. FGTS = depósito mensal obrigatório. Demais itens = provisões e contribuições patronais.
        </p>
      </div>

      {/* Busca */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar funcionário..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white', color: 'var(--color-text-primary)' }}
        />
      </div>

      {/* Tabela custo por funcionário */}
      {employees.length === 0 ? (
        <div className="rounded-xl border p-10 text-center" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Nenhum funcionário ativo com salário cadastrado.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
              <tr>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Funcionário</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Salário</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: '#E67E22' }}>
                  FGTS <span style={{ fontWeight: 400, opacity: 0.7 }}>({fmtPct(fgtsPct)})</span>
                </th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: '#C0392B' }}>
                  Outros enc. <span style={{ fontWeight: 400, opacity: 0.7 }}>({fmtPct(outrosPct)})</span>
                </th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: '#8E44AD' }}>Benefícios</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Custo total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(emp => {
                const sal  = emp.salario ?? 0
                const fgts = calcFgts(sal, effectiveAliquotas)
                const out  = calcOutrosEncargos(sal, effectiveAliquotas)
                const ben  = calcBeneficios(emp)
                return (
                  <tr key={emp.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
                    <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>
                      <div className="font-medium">{emp.nome}</div>
                      {emp.cargo && (
                        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{emp.cargo}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--color-text-primary)' }}>
                      {fmtCurrency(sal)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold" style={{ color: '#E67E22' }}>
                      {fmtCurrency(fgts)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold" style={{ color: '#C0392B' }}>
                      {fmtCurrency(out)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold" style={{ color: '#8E44AD' }}>
                      {fmtCurrency(ben)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold" style={{ color: 'var(--color-text-primary)' }}>
                      {fmtCurrency(sal + fgts + out + ben)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot style={{ backgroundColor: 'var(--color-bg-surface)' }}>
              <tr>
                <td colSpan={2} className="px-4 py-3 text-right font-semibold text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  TOTAIS
                </td>
                <td className="px-4 py-3 text-right font-bold text-xs" style={{ color: '#E67E22' }}>
                  {fmtCurrency(totalFgts)}
                </td>
                <td className="px-4 py-3 text-right font-bold text-xs" style={{ color: '#C0392B' }}>
                  {fmtCurrency(totalOutrosEnc)}
                </td>
                <td className="px-4 py-3 text-right font-bold text-xs" style={{ color: '#8E44AD' }}>
                  {fmtCurrency(totalBeneficios)}
                </td>
                <td className="px-4 py-3 text-right font-bold text-xs" style={{ color: 'var(--color-text-primary)' }}>
                  {fmtCurrency(totalFolha + totalEncargos + totalBeneficios)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <ModalAliquota
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        aliquota={editingAliquota}
      />
    </>
  )
}
