'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { SummaryCard } from '@/components/modules/dashboard/summary-card'
import { AddButton } from '@/components/ui/add-button'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FilterResult, SearchField } from '@/components/ui/filter-select'
import { Tabs } from '@/components/ui/form-steps'
import { Icon } from '@/components/ui/icon'
import { ListEmpty, ListItem } from '@/components/ui/list-item'
import { toast } from '@/lib/toast'
import { custoEmpresaMensal } from '@/lib/beneficios-calculo'
import { iniciais } from '../../funcionarios/components/ficha/ficha-config'
import { deleteAliquotaAction, seedDefaultAliquotasAction } from '../actions'
import type { EmployeeEncargo, AliquotaRow } from '../queries'
import { ModalAliquota } from './modal-aliquota'

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

const ehFgts = (a: AliquotaRow) => a.nome.toUpperCase().includes('FGTS')

function calcFgts(salario: number, aliquotas: AliquotaRow[]): number {
  const fgts = aliquotas.find(a => a.ativo && ehFgts(a))
  return salario * ((fgts?.percentual ?? 8) / 100)
}

function calcOutrosEncargos(salario: number, aliquotas: AliquotaRow[]): number {
  return aliquotas
    .filter(a => a.ativo && !ehFgts(a))
    .reduce((s, a) => s + salario * (a.percentual / 100), 0)
}

function calcBeneficios(emp: EmployeeEncargo): number {
  return emp.employee_benefits.reduce((sum, eb) => sum + custoEmpresaMensal(eb.benefit, eb.valor_override, emp.salario), 0)
}

function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtPct(v: number) {
  return `${v.toFixed(2).replace('.', ',')}%`
}

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

function Avatar({ nome }: { nome: string }) {
  return (
    <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
      {iniciais(nome)}
    </span>
  )
}

function Valor({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <span className="text-right">
      <span className="block text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{rotulo}</span>
      <span className="block text-sm font-semibold tabular-nums whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{fmtCurrency(valor)}</span>
    </span>
  )
}

// Encargos: custo de cada funcionário para a empresa e as alíquotas usadas no cálculo. Ações dentro da caixa, como nas demais telas.
export function EncargosClient({ employees, aliquotas, companyId }: Props) {
  const router = useRouter()
  const [aba, setAba] = useState(0)
  const [busca, setBusca] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AliquotaRow | null>(null)
  const [excluir, setExcluir] = useState<AliquotaRow | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const usingFallback = aliquotas.length === 0
  const effectiveAliquotas = usingFallback ? FALLBACK_ALIQUOTAS : aliquotas
  const ativas = effectiveAliquotas.filter(a => a.ativo)
  const totalPct  = ativas.reduce((s, a) => s + a.percentual, 0)
  const fgtsPct   = ativas.find(ehFgts)?.percentual ?? 8
  const outrosPct = totalPct - fgtsPct

  const q = busca.toLowerCase()
  const visiveis = employees.filter(e => !q || e.nome.toLowerCase().includes(q) || (e.cargo ?? '').toLowerCase().includes(q))

  const totalFolha      = employees.reduce((s, e) => s + (e.salario ?? 0), 0)
  const totalFgts       = employees.reduce((s, e) => s + calcFgts(e.salario ?? 0, effectiveAliquotas), 0)
  const totalOutrosEnc  = employees.reduce((s, e) => s + calcOutrosEncargos(e.salario ?? 0, effectiveAliquotas), 0)
  const totalBeneficios = employees.reduce((s, e) => s + calcBeneficios(e), 0)

  const abrirNovo = () => { setEditing(null); setModalOpen(true) }
  const abrirEdicao = (a: AliquotaRow) => { setEditing(a); setModalOpen(true) }

  async function confirmarExclusao() {
    const a = excluir
    if (!a) return
    setExcluindo(true)
    const r = await toast.promise(deleteAliquotaAction(a.id), {
      loading: `Excluindo ${a.nome}…`,
      success: `Alíquota ${a.nome} excluída.`,
      error: 'Não foi possível excluir a alíquota.',
    })
    setExcluindo(false)
    setExcluir(null)
    if (!('error' in r)) router.refresh()
  }

  async function inicializar() {
    setSeeding(true)
    const r = await toast.promise(seedDefaultAliquotasAction(companyId), {
      loading: 'Salvando as alíquotas padrão…',
      success: 'Alíquotas padrão salvas.',
      error: 'Não foi possível salvar as alíquotas.',
    })
    setSeeding(false)
    if (!('error' in r)) router.refresh()
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Encargos Trabalhistas</h1>
        <Breadcrumb />
      </div>

      <Tabs labels={['Custo por funcionário', 'Alíquotas']} step={aba} onSelect={setAba} />

      {aba === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4 mb-6">
          <SummaryCard icon="users" title="Total de salários" value={fmtCurrency(totalFolha)} caption={`${employees.length} ${employees.length === 1 ? 'funcionário ativo' : 'funcionários ativos'}`} />
          <SummaryCard icon="wallet" title="FGTS mensal" value={fmtCurrency(totalFgts)} caption={`${fmtPct(fgtsPct)} sobre o salário`} delay={60} />
          <SummaryCard icon="file" title="Outros encargos e provisões" value={fmtCurrency(totalOutrosEnc)} caption={`${fmtPct(outrosPct)} sobre o salário`} delay={120} />
          <SummaryCard icon="dollar" title="Custo total da empresa" value={fmtCurrency(totalFolha + totalFgts + totalOutrosEnc + totalBeneficios)} caption={`Inclui ${fmtCurrency(totalBeneficios)} de benefícios`} delay={180} />
        </div>
      )}

      {/* Custo por funcionário */}
      <div className={aba === 0 ? 'app-card p-5 flex flex-col gap-4' : 'hidden'}>
        <div className="flex flex-wrap items-center gap-2">
          <SearchField value={busca} onChange={setBusca} placeholder="Pesquisar por nome ou cargo..." />
          {busca && <FilterResult total={visiveis.length} onClear={() => setBusca('')} />}
          {employees.length > 0 && (
            <button
              type="button"
              onClick={() => downloadCsv(buildCustoCsv(employees, effectiveAliquotas), 'custo-funcionarios.csv')}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-medium transition-colors hover:bg-gray-50 shrink-0"
              style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-secondary)' }}
            >
              <Icon name="download" size={16} /> Exportar CSV
            </button>
          )}
        </div>

        <ul className="flex flex-col gap-3">
          {visiveis.length === 0 && <ListEmpty>{employees.length === 0 ? 'Nenhum funcionário ativo com salário cadastrado.' : 'Nenhum funcionário encontrado.'}</ListEmpty>}
          {visiveis.map(e => {
            const sal  = e.salario ?? 0
            const fgts = calcFgts(sal, effectiveAliquotas)
            const out  = calcOutrosEncargos(sal, effectiveAliquotas)
            const ben  = calcBeneficios(e)
            const abrirFicha = () => router.push(`/pessoas/funcionarios/${e.id}`)
            return (
              <ListItem
                key={e.id}
                media={<Avatar nome={e.nome} />}
                title={e.nome}
                subtitle={
                  <>
                    <span className="xl:hidden">Salário {fmtCurrency(sal)} · FGTS {fmtCurrency(fgts)} · Outros {fmtCurrency(out)} · Benefícios {fmtCurrency(ben)}</span>
                    <span className="hidden xl:inline">{e.cargo ?? 'Sem cargo informado'}</span>
                  </>
                }
                aside={
                  <>
                    <span className="hidden xl:grid grid-cols-4 gap-4 w-[28rem]">
                      <Valor rotulo="Salário" valor={sal} />
                      <Valor rotulo="FGTS" valor={fgts} />
                      <Valor rotulo="Outros encargos" valor={out} />
                      <Valor rotulo="Benefícios" valor={ben} />
                    </span>
                    <span className="xl:w-28 text-right">
                      <span className="block text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Custo total</span>
                      <span className="block font-bold tabular-nums whitespace-nowrap" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>{fmtCurrency(sal + fgts + out + ben)}</span>
                    </span>
                  </>
                }
                onClick={abrirFicha}
                actionsLabel={e.nome}
                actions={[{ icon: 'eye', label: 'Ver ficha', onClick: abrirFicha }]}
              />
            )
          })}
        </ul>

        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Estimativa. Os valores reais variam conforme RAT/FAP, atividade e regime tributário.
        </p>
      </div>

      {/* Alíquotas */}
      <div className={aba === 1 ? 'app-card p-5 flex flex-col gap-4' : 'hidden'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
              {fmtPct(totalPct)} <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>sobre o salário</span>
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              FGTS {fmtPct(fgtsPct)} · outros encargos {fmtPct(outrosPct)} · {ativas.length} {ativas.length === 1 ? 'alíquota ativa' : 'alíquotas ativas'}
            </p>
          </div>
          <AddButton onClick={abrirNovo} />
        </div>

        {usingFallback && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ backgroundColor: 'var(--color-brand-light)' }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Usando as alíquotas padrão CLT</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>Salve os padrões para poder editar os percentuais desta empresa.</p>
            </div>
            <Button type="button" size="sm" loading={seeding} onClick={inicializar}>Salvar padrões</Button>
          </div>
        )}

        <ul className="flex flex-col gap-3">
          {usingFallback
            ? FALLBACK_ALIQUOTAS.map(a => (
                <li key={a.nome} className="flex items-center justify-between gap-4 rounded-xl border bg-white px-4 py-3.5" style={{ borderColor: 'var(--color-card-border)' }}>
                  <span className="font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{a.nome}</span>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{fmtPct(a.percentual)}</span>
                </li>
              ))
            : aliquotas.map(a => (
                <div key={a.id} style={{ opacity: a.ativo ? 1 : 0.55 }}>
                  <ListItem
                    icon="file"
                    title={a.nome}
                    subtitle={ehFgts(a) ? 'Depósito mensal' : 'Calculado sobre o salário bruto'}
                    aside={
                      <>
                        <span className="text-sm font-semibold tabular-nums whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{fmtPct(a.percentual)}</span>
                        <StatusBadge status={a.ativo ? 'active' : 'inactive'} />
                      </>
                    }
                    onClick={() => abrirEdicao(a)}
                    actionsLabel={a.nome}
                    actions={[
                      { icon: 'pencil', label: 'Editar', onClick: () => abrirEdicao(a) },
                      { icon: 'trash', label: 'Excluir', tone: 'danger', onClick: () => setExcluir(a) },
                    ]}
                  />
                </div>
              ))}
        </ul>
      </div>

      <ModalAliquota open={modalOpen} onClose={() => setModalOpen(false)} companyId={companyId} aliquota={editing} />

      <ConfirmDialog
        open={!!excluir}
        onClose={() => { if (!excluindo) setExcluir(null) }}
        onConfirm={confirmarExclusao}
        loading={excluindo}
        title="Excluir alíquota"
        confirmLabel="Excluir"
        message={<p>Excluir a alíquota <strong>{excluir?.nome}</strong>? Ela deixa de entrar no cálculo dos encargos.</p>}
      />
    </>
  )
}
