'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BPData, BPLancamento, BPTipo } from '../queries'
import { deleteBPLancamentoAction } from '../actions'
import { ModalBPLancamento } from './modal-bp-lancamento'

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

// ── ThreeDotMenu ──────────────────────────────────────────────────────────────

function ThreeDotMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  function handleOpen(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const menuH = 88
    const openUp = rect.bottom + menuH + 12 > window.innerHeight - 8
    setPos({
      top: openUp ? rect.top - menuH - 4 : rect.bottom + 4,
      left: rect.right - 160,
    })
    setOpen(true)
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="p-1 rounded hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100 text-base leading-none"
        style={{ color: 'var(--color-text-muted)' }}
        title="Opções"
      >
        ···
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 bg-white border rounded-xl shadow-lg py-1 w-40"
            style={{ top: pos.top, left: pos.left, borderColor: 'var(--color-bg-surface)' }}
          >
            <button
              onClick={() => { setOpen(false); onEdit() }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
              style={{ color: 'var(--color-text-primary)' }}
            >
              ✏️ Editar
            </button>
            <button
              onClick={() => { setOpen(false); onDelete() }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
              style={{ color: 'var(--color-error)' }}
            >
              🗑 Excluir
            </button>
          </div>
        </>
      )}
    </>
  )
}

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

function LinhaManual({
  lancamento,
  onEdit,
  onDelete,
}: {
  lancamento: BPLancamento
  onEdit: () => void
  onDelete: () => Promise<void>
}) {
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!confirm(`Excluir "${lancamento.descricao}"?`)) return
    setLoading(true)
    await onDelete()
    setLoading(false)
  }

  return (
    <div
      className="flex items-center justify-between px-4 py-2 group"
      style={{ opacity: loading ? 0.5 : 1 }}
    >
      <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {lancamento.descricao}
      </span>
      <div className="flex items-center gap-1">
        <span className="text-sm tabular-nums font-medium" style={{ color: 'var(--color-text-primary)' }}>
          {fmt(lancamento.valor)}
        </span>
        <ThreeDotMenu onEdit={onEdit} onDelete={handleDelete} />
      </div>
    </div>
  )
}

function SubHeader({ titulo }: { titulo: string }) {
  return (
    <div className="px-4 py-2" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
      <span
        className="text-xs font-bold uppercase"
        style={{ color: 'var(--color-text-muted)', letterSpacing: '0.08em' }}
      >
        {titulo}
      </span>
    </div>
  )
}

function LinhaSubtotal({ label, valor }: { label: string; valor: number }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-2 border-t"
      style={{ borderColor: 'var(--color-bg-surface)' }}
    >
      <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      <span className="text-sm tabular-nums font-bold" style={{ color: 'var(--color-text-primary)' }}>
        {fmt(valor)}
      </span>
    </div>
  )
}

function LinhaTotal({ label, valor, destaque }: { label: string; valor: number; destaque?: boolean }) {
  const color = destaque ? (valor >= 0 ? '#1E8449' : '#C0392B') : 'var(--color-text-primary)'
  return (
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{
        borderTop: '2px solid var(--color-bg-surface)',
        backgroundColor: destaque
          ? valor >= 0 ? '#F0FFF4' : '#FFF5F5'
          : 'var(--color-bg-surface)',
      }}
    >
      <span className="text-sm font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: 'Manrope' }}>
        = {label}
      </span>
      <span className="text-base tabular-nums font-bold" style={{ color }}>
        {fmt(valor)}
      </span>
    </div>
  )
}

function SecaoTitulo({ titulo }: { titulo: string }) {
  return (
    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-bg-surface)' }}>
      <span className="text-sm font-bold" style={{ color: 'var(--color-primary-darker)', fontFamily: 'Manrope' }}>
        {titulo}
      </span>
    </div>
  )
}

function BotaoAdicionar({ onClick }: { onClick: () => void }) {
  return (
    <div className="px-4 py-1.5">
      <button
        onClick={onClick}
        className="text-xs hover:underline transition-colors"
        style={{ color: 'var(--color-primary-darker)' }}
      >
        + Adicionar
      </button>
    </div>
  )
}

function VazioPlaceholder() {
  return (
    <div className="px-4 py-1.5">
      <span className="text-xs italic" style={{ color: 'var(--color-text-muted)' }}>
        Nenhum lançamento
      </span>
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

  function navigate(delta: number) {
    let m = mes + delta
    let a = ano
    if (m > 12) { m = 1; a++ }
    if (m < 1)  { m = 12; a-- }
    router.push(`/financeiro/balanco?mes=${m}&ano=${a}`)
  }

  function openCreate(tipo: BPTipo) {
    setEditingLancamento(null)
    setDefaultTipo(tipo)
    setModalOpen(true)
  }

  function openEdit(l: BPLancamento) {
    setEditingLancamento(l)
    setDefaultTipo(l.tipo)
    setModalOpen(true)
  }

  async function handleDelete(id: string) {
    await deleteBPLancamentoAction(id)
    router.refresh()
  }

  const { caixa, contas_receber, contas_pagar, resultado_exercicio, lancamentos } = bpData

  function byTipo(tipo: BPTipo) {
    return lancamentos.filter(l => l.tipo === tipo)
  }

  function sumTipo(tipo: BPTipo) {
    return byTipo(tipo).reduce((s, l) => s + l.valor, 0)
  }

  // Ativo
  const totalAtivoCirculante    = caixa + contas_receber + sumTipo('ativo_circulante')
  const totalAtivoNaoCirculante = sumTipo('ativo_nao_circulante')
  const totalAtivo              = totalAtivoCirculante + totalAtivoNaoCirculante

  // Passivo
  const totalPassivoCirculante    = contas_pagar + sumTipo('passivo_circulante')
  const totalPassivoNaoCirculante = sumTipo('passivo_nao_circulante')
  const totalPassivo              = totalPassivoCirculante + totalPassivoNaoCirculante

  // PL
  const totalPL              = sumTipo('pl') + resultado_exercicio
  const totalPassivoMaisPL   = totalPassivo + totalPL

  const diferenca  = totalAtivo - totalPassivoMaisPL
  const equilibrado = Math.abs(diferenca) < 0.01

  // Data-base formatada
  const [y, m, d] = new Date(ano, mes, 0).toISOString().split('T')[0].split('-').map(Number)
  const dataBaseLabel = new Date(y, m - 1, d).toLocaleDateString('pt-BR')

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Balanço Patrimonial
          </h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >◀</button>
            <span
              className="text-sm font-semibold px-2 min-w-[120px] text-center"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {MESES[mes - 1]} {ano}
            </span>
            <button
              onClick={() => navigate(1)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >▶</button>
          </div>
        </div>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Posição em {dataBaseLabel}
        </p>
      </div>

      {/* Banner de equilíbrio */}
      {totalAtivo > 0 && equilibrado && (
        <div
          className="mb-4 px-4 py-3 rounded-xl border text-sm flex items-center gap-2"
          style={{ backgroundColor: '#F0FFF4', borderColor: '#86EFAC', color: '#166534' }}
        >
          <span>✓</span>
          <span>Balanço equilibrado — Ativo = Passivo + PL</span>
        </div>
      )}
      {totalAtivo > 0 && !equilibrado && (
        <div
          className="mb-4 px-4 py-3 rounded-xl border text-sm flex items-start gap-2"
          style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A', color: '#92400E' }}
        >
          <span>⚠</span>
          <span>
            Balanço não equilibrado: diferença de <strong>{fmt(Math.abs(diferenca))}</strong>.
            Adicione os lançamentos manuais faltantes (imobilizado, capital social, empréstimos).
          </span>
        </div>
      )}

      {/* Duas colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── ATIVO ── */}
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}
        >
          <SecaoTitulo titulo="ATIVO" />

          <SubHeader titulo="Ativo Circulante" />
          <LinhaAuto label="Caixa e Equivalentes de Caixa" valor={caixa} />
          <LinhaAuto label="Contas a Receber" valor={contas_receber} />
          {byTipo('ativo_circulante').map(l => (
            <LinhaManual
              key={l.id}
              lancamento={l}
              onEdit={() => openEdit(l)}
              onDelete={() => handleDelete(l.id)}
            />
          ))}
          <BotaoAdicionar onClick={() => openCreate('ativo_circulante')} />
          <LinhaSubtotal label="Total Ativo Circulante" valor={totalAtivoCirculante} />

          <SubHeader titulo="Ativo Não Circulante" />
          {byTipo('ativo_nao_circulante').length === 0
            ? <VazioPlaceholder />
            : byTipo('ativo_nao_circulante').map(l => (
                <LinhaManual
                  key={l.id}
                  lancamento={l}
                  onEdit={() => openEdit(l)}
                  onDelete={() => handleDelete(l.id)}
                />
              ))
          }
          <BotaoAdicionar onClick={() => openCreate('ativo_nao_circulante')} />
          <LinhaSubtotal label="Total Ativo Não Circulante" valor={totalAtivoNaoCirculante} />

          <LinhaTotal label="TOTAL ATIVO" valor={totalAtivo} />
        </div>

        {/* ── PASSIVO + PL ── */}
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}
        >
          <SecaoTitulo titulo="PASSIVO" />

          <SubHeader titulo="Passivo Circulante" />
          <LinhaAuto label="Contas a Pagar" valor={contas_pagar} />
          {byTipo('passivo_circulante').map(l => (
            <LinhaManual
              key={l.id}
              lancamento={l}
              onEdit={() => openEdit(l)}
              onDelete={() => handleDelete(l.id)}
            />
          ))}
          <BotaoAdicionar onClick={() => openCreate('passivo_circulante')} />
          <LinhaSubtotal label="Total Passivo Circulante" valor={totalPassivoCirculante} />

          <SubHeader titulo="Passivo Não Circulante" />
          {byTipo('passivo_nao_circulante').length === 0
            ? <VazioPlaceholder />
            : byTipo('passivo_nao_circulante').map(l => (
                <LinhaManual
                  key={l.id}
                  lancamento={l}
                  onEdit={() => openEdit(l)}
                  onDelete={() => handleDelete(l.id)}
                />
              ))
          }
          <BotaoAdicionar onClick={() => openCreate('passivo_nao_circulante')} />
          <LinhaSubtotal label="Total Passivo Não Circulante" valor={totalPassivoNaoCirculante} />

          <LinhaTotal label="TOTAL PASSIVO" valor={totalPassivo} />

          {/* Patrimônio Líquido — parte inferior da coluna direita */}
          <div className="mt-4 border-t" style={{ borderColor: 'var(--color-bg-surface)' }} />
          <SecaoTitulo titulo="PATRIMÔNIO LÍQUIDO" />

          {byTipo('pl').map(l => (
            <LinhaManual
              key={l.id}
              lancamento={l}
              onEdit={() => openEdit(l)}
              onDelete={() => handleDelete(l.id)}
            />
          ))}
          <LinhaAuto
            label="Resultado do Exercício"
            valor={resultado_exercicio}
            color={resultado_exercicio >= 0 ? '#1E8449' : '#C0392B'}
          />
          <BotaoAdicionar onClick={() => openCreate('pl')} />
          <LinhaTotal label="TOTAL PL" valor={totalPL} />

          <div className="mt-2" />
          <LinhaTotal label="TOTAL PASSIVO + PL" valor={totalPassivoMaisPL} destaque />
        </div>
      </div>

      <ModalBPLancamento
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        lancamento={editingLancamento}
        defaultTipo={defaultTipo}
      />
    </>
  )
}
