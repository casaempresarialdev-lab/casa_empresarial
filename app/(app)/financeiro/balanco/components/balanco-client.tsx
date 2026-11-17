'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BPData, BPLancamento, BPTipo } from '../queries'
import { deleteBPLancamentoAction } from '../actions'
import { ModalBPLancamento } from './modal-bp-lancamento'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { SummaryCard } from '@/components/modules/dashboard/summary-card'
import { ActionMenu } from '@/components/ui/action-menu'
import { AddButton } from '@/components/ui/add-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Icon } from '@/components/ui/icon'
import { toast } from '@/lib/toast'

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

// ── Linhas ────────────────────────────────────────────────────────────────────

function LinhaAuto({ label, valor, color }: { label: string; valor: number; color?: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <span className="text-sm tabular-nums font-medium" style={{ color: color ?? 'var(--color-text-primary)' }}>
        {fmt(valor)}
      </span>
    </div>
  )
}

function LinhaManual({ lancamento, onEdit, onDelete }: { lancamento: BPLancamento; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{lancamento.descricao}</span>
      <div className="flex items-center gap-1">
        <span className="text-sm tabular-nums font-medium" style={{ color: 'var(--color-text-primary)' }}>{fmt(lancamento.valor)}</span>
        <ActionMenu
          label={`Ações de ${lancamento.descricao}`}
          items={[
            { icon: 'pencil', label: 'Editar', onClick: onEdit },
            { icon: 'trash', label: 'Excluir', tone: 'danger', onClick: onDelete },
          ]}
        />
      </div>
    </div>
  )
}

function SubHeader({ titulo }: { titulo: string }) {
  return (
    <div className="px-4 py-2" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
      <span className="text-xs font-bold uppercase" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.08em' }}>{titulo}</span>
    </div>
  )
}

function LinhaSubtotal({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
      <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <span className="text-sm tabular-nums font-bold" style={{ color: 'var(--color-text-primary)' }}>{fmt(valor)}</span>
    </div>
  )
}

function LinhaTotal({ label, valor, destaque }: { label: string; valor: number; destaque?: boolean }) {
  const color = destaque ? (valor >= 0 ? '#15803D' : '#B91C1C') : 'var(--color-text-primary)'
  return (
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{ borderTop: '2px solid var(--color-bg-surface)', backgroundColor: destaque ? (valor >= 0 ? '#DCFCE7' : '#FEE2E2') : 'var(--color-bg-surface)' }}
    >
      <span className="text-sm font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: 'Manrope' }}>= {label}</span>
      <span className="text-base tabular-nums font-bold" style={{ color }}>{fmt(valor)}</span>
    </div>
  )
}

function SecaoTitulo({ titulo }: { titulo: string }) {
  return (
    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-bg-surface)' }}>
      <span className="text-sm font-bold" style={{ color: 'var(--color-primary-darker)', fontFamily: 'Manrope' }}>{titulo}</span>
    </div>
  )
}

function VazioPlaceholder() {
  return (
    <div className="px-4 py-1.5">
      <span className="text-xs italic" style={{ color: 'var(--color-text-muted)' }}>Nenhum lançamento</span>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  bpData: BPData
  mes: number
  ano: number
  companyId: string
}

export function BalancoClient({ bpData, mes, ano, companyId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingLancamento, setEditingLancamento] = useState<BPLancamento | null>(null)
  const [defaultTipo, setDefaultTipo] = useState<BPTipo>('ativo_circulante')
  const [excluir, setExcluir] = useState<BPLancamento | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  function navigate(delta: number) {
    let m = mes + delta
    let a = ano
    if (m > 12) { m = 1; a++ }
    if (m < 1) { m = 12; a-- }
    router.push(`/financeiro/balanco?mes=${m}&ano=${a}`)
  }

  function openCreate(tipo: BPTipo) { setEditingLancamento(null); setDefaultTipo(tipo); setModalOpen(true) }
  function openEdit(l: BPLancamento) { setEditingLancamento(l); setDefaultTipo(l.tipo); setModalOpen(true) }

  async function confirmarExclusao() {
    if (!excluir) return
    setExcluindo(true)
    const r = await toast.promise(deleteBPLancamentoAction(excluir.id), {
      loading: `Excluindo ${excluir.descricao}…`,
      success: `${excluir.descricao} excluído.`,
      error: 'Não foi possível excluir o lançamento.',
    })
    setExcluindo(false)
    setExcluir(null)
    if (!('error' in r)) router.refresh()
  }

  const { caixa, contas_receber, contas_pagar, resultado_exercicio, lancamentos } = bpData

  function byTipo(tipo: BPTipo) {
    return lancamentos.filter((l) => l.tipo === tipo)
  }
  function sumTipo(tipo: BPTipo) {
    return byTipo(tipo).reduce((s, l) => s + l.valor, 0)
  }

  const totalAtivoCirculante = caixa + contas_receber + sumTipo('ativo_circulante')
  const totalAtivoNaoCirculante = sumTipo('ativo_nao_circulante')
  const totalAtivo = totalAtivoCirculante + totalAtivoNaoCirculante

  const totalPassivoCirculante = contas_pagar + sumTipo('passivo_circulante')
  const totalPassivoNaoCirculante = sumTipo('passivo_nao_circulante')
  const totalPassivo = totalPassivoCirculante + totalPassivoNaoCirculante

  const totalPL = sumTipo('pl') + resultado_exercicio
  const totalPassivoMaisPL = totalPassivo + totalPL

  const diferenca = totalAtivo - totalPassivoMaisPL
  const equilibrado = Math.abs(diferenca) < 0.01

  const [y, m, d] = new Date(ano, mes, 0).toISOString().split('T')[0].split('-').map(Number)
  const dataBaseLabel = new Date(y, m - 1, d).toLocaleDateString('pt-BR')

  return (
    <>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex flex-1 min-w-0 items-center gap-3">
          <div className="flex-1 min-w-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Balanço Patrimonial</h1>
            <Breadcrumb />
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: 'var(--color-text-secondary)' }} aria-label="Mês anterior">
              <Icon name="chevron-left" size={16} />
            </button>
            <span className="text-sm font-semibold px-2 min-w-[120px] text-center" style={{ color: 'var(--color-text-primary)' }}>{MESES[mes - 1]} {ano}</span>
            <button onClick={() => navigate(1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: 'var(--color-text-secondary)' }} aria-label="Próximo mês">
              <Icon name="chevron-right" size={16} />
            </button>
          </div>
        </div>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Posição em {dataBaseLabel}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <SummaryCard icon="wallet" title="Total Ativo" value={fmt(totalAtivo)} caption="caixa, a receber e bens" />
        <SummaryCard icon="card" title="Total Passivo" value={fmt(totalPassivo)} caption="a pagar e obrigações" delay={60} />
        <SummaryCard icon="dollar" title="Patrimônio Líquido" value={fmt(totalPL)} caption="capital + resultado do exercício" delay={120} />
        <SummaryCard
          icon="check" title="Equilíbrio" value={equilibrado ? 'OK' : fmt(Math.abs(diferenca))} caption={equilibrado ? 'Ativo = Passivo + PL' : 'diferença a ajustar'}
          accent={equilibrado ? undefined : 'red'} delay={180}
        />
      </div>

      {totalAtivo > 0 && equilibrado && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm flex items-center gap-2" style={{ backgroundColor: '#DCFCE7', color: '#15803D' }}>
          <span>✓</span>
          <span>Balanço equilibrado — Ativo = Passivo + PL</span>
        </div>
      )}
      {totalAtivo > 0 && !equilibrado && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm flex items-start gap-2" style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}>
          <span>⚠</span>
          <span>
            Balanço não equilibrado: diferença de <strong>{fmt(Math.abs(diferenca))}</strong>.
            Adicione os lançamentos manuais faltantes (imobilizado, capital social, empréstimos).
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── ATIVO ── */}
        <div className="app-card overflow-hidden">
          <SecaoTitulo titulo="ATIVO" />

          <SubHeader titulo="Ativo Circulante" />
          <LinhaAuto label="Caixa e Equivalentes de Caixa" valor={caixa} />
          <LinhaAuto label="Contas a Receber" valor={contas_receber} />
          {byTipo('ativo_circulante').map((l) => (
            <LinhaManual key={l.id} lancamento={l} onEdit={() => openEdit(l)} onDelete={() => setExcluir(l)} />
          ))}
          <div className="px-4 py-1.5"><AddButton onClick={() => openCreate('ativo_circulante')} label="Adicionar" /></div>
          <LinhaSubtotal label="Total Ativo Circulante" valor={totalAtivoCirculante} />

          <SubHeader titulo="Ativo Não Circulante" />
          {byTipo('ativo_nao_circulante').length === 0
            ? <VazioPlaceholder />
            : byTipo('ativo_nao_circulante').map((l) => (
                <LinhaManual key={l.id} lancamento={l} onEdit={() => openEdit(l)} onDelete={() => setExcluir(l)} />
              ))}
          <div className="px-4 py-1.5"><AddButton onClick={() => openCreate('ativo_nao_circulante')} label="Adicionar" /></div>
          <LinhaSubtotal label="Total Ativo Não Circulante" valor={totalAtivoNaoCirculante} />

          <LinhaTotal label="TOTAL ATIVO" valor={totalAtivo} />
        </div>

        {/* ── PASSIVO + PL ── */}
        <div className="app-card overflow-hidden">
          <SecaoTitulo titulo="PASSIVO" />

          <SubHeader titulo="Passivo Circulante" />
          <LinhaAuto label="Contas a Pagar" valor={contas_pagar} />
          {byTipo('passivo_circulante').map((l) => (
            <LinhaManual key={l.id} lancamento={l} onEdit={() => openEdit(l)} onDelete={() => setExcluir(l)} />
          ))}
          <div className="px-4 py-1.5"><AddButton onClick={() => openCreate('passivo_circulante')} label="Adicionar" /></div>
          <LinhaSubtotal label="Total Passivo Circulante" valor={totalPassivoCirculante} />

          <SubHeader titulo="Passivo Não Circulante" />
          {byTipo('passivo_nao_circulante').length === 0
            ? <VazioPlaceholder />
            : byTipo('passivo_nao_circulante').map((l) => (
                <LinhaManual key={l.id} lancamento={l} onEdit={() => openEdit(l)} onDelete={() => setExcluir(l)} />
              ))}
          <div className="px-4 py-1.5"><AddButton onClick={() => openCreate('passivo_nao_circulante')} label="Adicionar" /></div>
          <LinhaSubtotal label="Total Passivo Não Circulante" valor={totalPassivoNaoCirculante} />

          <LinhaTotal label="TOTAL PASSIVO" valor={totalPassivo} />

          <div className="mt-4 border-t" style={{ borderColor: 'var(--color-bg-surface)' }} />
          <SecaoTitulo titulo="PATRIMÔNIO LÍQUIDO" />

          {byTipo('pl').map((l) => (
            <LinhaManual key={l.id} lancamento={l} onEdit={() => openEdit(l)} onDelete={() => setExcluir(l)} />
          ))}
          <LinhaAuto label="Resultado do Exercício" valor={resultado_exercicio} color={resultado_exercicio >= 0 ? '#15803D' : '#B91C1C'} />
          <div className="px-4 py-1.5"><AddButton onClick={() => openCreate('pl')} label="Adicionar" /></div>
          <LinhaTotal label="TOTAL PL" valor={totalPL} />

          <div className="mt-2" />
          <LinhaTotal label="TOTAL PASSIVO + PL" valor={totalPassivoMaisPL} destaque />
        </div>
      </div>

      <ModalBPLancamento open={modalOpen} onClose={() => setModalOpen(false)} companyId={companyId} lancamento={editingLancamento} defaultTipo={defaultTipo} />

      <ConfirmDialog
        open={!!excluir}
        onClose={() => { if (!excluindo) setExcluir(null) }}
        onConfirm={confirmarExclusao}
        loading={excluindo}
        title="Excluir lançamento"
        confirmLabel="Excluir"
        message={<p>Excluir <strong>{excluir?.descricao}</strong>?</p>}
      />
    </>
  )
}
