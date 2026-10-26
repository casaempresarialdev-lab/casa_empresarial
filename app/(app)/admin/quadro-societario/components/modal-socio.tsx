'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { createSocioAction, updateSocioAction } from '../actions'
import type { Socio } from '../queries'

const UF_OPTIONS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO',
]

function formatCpf(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

function maskCep(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0,5)}-${d.slice(5)}` : d
}

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  socio: Socio | null
  /** Soma da participação dos outros sócios (limita este sócio a 100% no total) */
  outrasParticipacoes: number
}

const STEPS = ['Dados pessoais', 'Participação', 'Endereço'] as const
const LAST_STEP = STEPS.length - 1

// Indicador de etapas: número (ou ✓ quando concluída) + nome, ligados por uma linha
function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2 mb-6">
      {STEPS.map((label, i) => {
        const done = i < step
        const current = i === step
        return (
          <li key={label} className="flex items-center gap-2 flex-1 last:flex-none">
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors"
              style={done || current
                ? { backgroundColor: 'var(--color-brand)', color: '#fff' }
                : { backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-muted)' }}
            >
              {done ? '✓' : i + 1}
            </span>
            <span
              className="text-sm whitespace-nowrap"
              style={{ color: current ? 'var(--color-text-primary)' : 'var(--color-text-muted)', fontWeight: current ? 600 : 400 }}
            >
              {label}
            </span>
            {i < LAST_STEP && (
              <span className="flex-1 h-px min-w-4" style={{ backgroundColor: done ? 'var(--color-brand)' : 'var(--color-card-border)' }} />
            )}
          </li>
        )
      })}
    </ol>
  )
}

// Na edição as etapas viram abas clicáveis (não precisa passar por todas para salvar)
function Tabs({ step, onSelect }: { step: number; onSelect: (i: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2 mb-6" role="tablist">
      {STEPS.map((label, i) => {
        const active = i === step
        return (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(i)}
            className={`h-9 px-4 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${active ? '' : 'hover:bg-gray-50'}`}
            style={{
              fontFamily: 'Manrope',
              ...(active ? { backgroundColor: 'var(--color-brand)', color: '#fff' } : { color: 'var(--color-sidebar-text)' }),
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

const formatPct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`

export function ModalSocio({ open, onClose, companyId, socio, outrasParticipacoes }: Props) {
  const router = useRouter()
  const isEditing = !!socio
  const disponivel = Math.max(0, Math.round((100 - outrasParticipacoes) * 100) / 100)

  const formRef = useRef<HTMLFormElement>(null)
  const [step, setStep] = useState(0)
  // Campos destacados com borda vermelha (o aviso vai no toast)
  const [invalid, setInvalid] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [cpf, setCpf] = useState('')
  const [administrador, setAdministrador] = useState(false)
  const [cep, setCep] = useState('')
  const [uf, setUf] = useState('')
  const [cidade, setCidade] = useState('')
  const [logradouro, setLogradouro] = useState('')
  const [bairro, setBairro] = useState('')
  const [cepLoading, setCepLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setCpf(socio?.cpf ? formatCpf(socio.cpf) : '')
      setAdministrador(socio?.administrador ?? false)
      setCep(socio?.cep ? maskCep(socio.cep) : '')
      setUf(socio?.uf ?? '')
      setCidade(socio?.cidade ?? '')
      setLogradouro(socio?.logradouro ?? '')
      setBairro(socio?.bairro ?? '')
      setInvalid(new Set())
      setStep(0)
    }
  }, [open, socio])

  const field = (name: string) => (formRef.current?.elements.namedItem(name) as HTMLInputElement | null)?.value ?? ''

  // Campos obrigatórios de cada etapa
  const REQUIRED: Record<number, string[]> = { 0: ['nome'], 1: [], 2: [] }

  type Problem = { step: number; fields: string[]; message: string }

  // Valida uma etapa: obrigatórios preenchidos e participação dentro do que ainda está disponível
  function validateStep(current: number): Problem | null {
    const vazios = REQUIRED[current].filter((name) => !field(name).trim())
    if (vazios.length) return { step: current, fields: vazios, message: 'Preencha todos os campos obrigatórios.' }
    if (current === 1) {
      const raw = field('participacao')
      const pct = raw ? Number(raw) : null
      if (pct !== null && (Number.isNaN(pct) || pct < 0)) {
        return { step: 1, fields: ['participacao'], message: 'Informe uma participação válida.' }
      }
      if (pct !== null && pct > disponivel + 1e-9) {
        return {
          step: 1,
          fields: ['participacao'],
          message: `A participação total não pode passar de 100%. Disponível para este sócio: ${formatPct(disponivel)}.`,
        }
      }
    }
    return null
  }

  // Primeira etapa com problema (para levar a pessoa até ela)
  function validateAll(): Problem | null {
    for (let i = 0; i <= LAST_STEP; i++) {
      const problem = validateStep(i)
      if (problem) return problem
    }
    return null
  }

  // Destaca os campos com problema e avisa via toast (✕)
  function reportProblem(problem: Problem) {
    setInvalid(new Set(problem.fields))
    setStep(problem.step)
    toast.error(problem.message)
  }

  // Ao digitar, o campo deixa de ficar destacado
  function clearInvalid(name: string) {
    setInvalid((prev) => {
      if (!prev.has(name)) return prev
      const next = new Set(prev)
      next.delete(name)
      return next
    })
  }

  function goNext() {
    const problem = validateStep(step)
    if (problem) { reportProblem(problem); return }
    setInvalid(new Set())
    setStep((s) => Math.min(LAST_STEP, s + 1))
  }

  function goBack() {
    setStep((s) => Math.max(0, s - 1))
  }

  async function handleCepBlur() {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) return
    setCepLoading(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const json = await res.json()
      if (!json.erro) {
        setLogradouro(json.logradouro || '')
        setBairro(json.bairro || '')
        setCidade(json.localidade || '')
        setUf(json.uf || '')
      }
    } catch { /* usuário preenche manualmente */ }
    finally { setCepLoading(false) }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // Cadastro: Enter nas etapas intermediárias avança em vez de salvar. Edição: salva de qualquer aba.
    if (!isEditing && step < LAST_STEP) { goNext(); return }
    const problem = validateAll()
    if (problem) { reportProblem(problem); return }
    setInvalid(new Set())
    setLoading(true)

    const fd = new FormData(e.currentTarget)
    fd.set('cpf', cpf)
    fd.set('administrador', String(administrador))

    // Resultado do servidor no toast (✓ / ✕); com erro, o modal continua aberto
    const nome = fd.get('nome') as string
    const result = await toast.promise(
      isEditing ? updateSocioAction(socio!.id, fd) : createSocioAction(companyId, fd),
      {
        loading: isEditing ? 'Salvando alterações…' : 'Cadastrando sócio…',
        success: isEditing ? `Dados de ${nome} atualizados.` : `${nome} foi adicionado ao quadro societário.`,
        error: 'Não foi possível salvar o sócio.',
      },
    )

    setLoading(false)
    if (!('error' in result)) {
      onClose()
      router.refresh()
    }
  }

  const fieldCls = 'h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]'
  const fieldSty = { borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }
  const labelSty = { color: 'var(--color-text-secondary)' }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Editar sócio' : 'Novo sócio'}
      className="sm:max-w-2xl"
    >
      {isEditing
        ? <Tabs step={step} onSelect={(i) => setStep(i)} />
        : <Stepper step={step} />}

      {/* Todas as etapas ficam no mesmo formulário (só escondidas), para não perder o que foi digitado */}
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">

        {/* ── 1. Dados pessoais ── */}
        <div className={step === 0 ? 'flex flex-col gap-4' : 'hidden'}>
          <Input
            label="Nome *"
            name="nome"
            defaultValue={socio?.nome ?? ''}
            placeholder="Nome completo"
            invalid={invalid.has('nome')}
            onChange={() => clearInvalid('nome')}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="CPF"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
            />
            <Input
              label="Telefone"
              name="telefone"
              defaultValue={socio?.telefone ?? ''}
              placeholder="(00) 00000-0000"
            />
          </div>
          <Input
            label="E-mail"
            name="email"
            type="email"
            defaultValue={socio?.email ?? ''}
            placeholder="email@exemplo.com"
          />
        </div>

        {/* ── 2. Participação, cargo e administrador ── */}
        <div className={step === 1 ? 'flex flex-col gap-4' : 'hidden'}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <Input
                label="Participação (%)"
                name="participacao"
                type="number"
                min="0"
                max={disponivel}
                step="0.01"
                defaultValue={socio?.participacao ?? ''}
                placeholder="0,00"
                invalid={invalid.has('participacao')}
                onChange={() => clearInvalid('participacao')}
              />
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Disponível para este sócio: <strong>{formatPct(disponivel)}</strong>
              </p>
            </div>
            <Input
              label="Cargo"
              name="cargo"
              defaultValue={socio?.cargo ?? ''}
              placeholder="Ex: Diretor"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setAdministrador((v) => !v)}
              className={`relative w-10 h-6 rounded-full transition-colors ${administrador ? 'bg-[var(--color-brand)]' : 'bg-gray-200'}`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${administrador ? 'translate-x-5' : 'translate-x-1'}`}
              />
            </div>
            <span className="text-sm font-medium" style={labelSty}>
              Sócio Administrador
            </span>
          </label>
        </div>

        {/* ── 3. Endereço ── */}
        <div className={step === 2 ? 'flex flex-col gap-4' : 'hidden'}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium" style={labelSty}>CEP</label>
                {cepLoading && <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Buscando...</span>}
              </div>
              <input
                name="cep"
                type="text"
                placeholder="00000-000"
                inputMode="numeric"
                maxLength={9}
                value={cep}
                onChange={(e) => setCep(maskCep(e.target.value))}
                onBlur={handleCepBlur}
                className={fieldCls}
                style={fieldSty}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={labelSty}>UF</label>
              <select name="uf" value={uf} onChange={(e) => setUf(e.target.value)} className={fieldCls} style={fieldSty}>
                <option value="">UF</option>
                {UF_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={labelSty}>Cidade</label>
              <input
                name="cidade"
                type="text"
                placeholder="Cidade"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                className={fieldCls}
                style={fieldSty}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="text-sm font-medium" style={labelSty}>Logradouro</label>
              <input
                name="logradouro"
                type="text"
                placeholder="Rua, Avenida, etc."
                value={logradouro}
                onChange={(e) => setLogradouro(e.target.value)}
                className={fieldCls}
                style={fieldSty}
              />
            </div>
            <Input label="Número" name="numero" defaultValue={socio?.numero ?? ''} placeholder="Número" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={labelSty}>Bairro</label>
              <input
                name="bairro"
                type="text"
                placeholder="Bairro"
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                className={fieldCls}
                style={fieldSty}
              />
            </div>
            <Input label="Complemento" name="complemento" defaultValue={socio?.complemento ?? ''} placeholder="Apto, sala..." />
          </div>
        </div>


        <div className="flex items-center justify-between gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={isEditing || step === 0 ? onClose : goBack}>
            {isEditing || step === 0 ? 'Cancelar' : 'Voltar'}
          </Button>
          {!isEditing && step < LAST_STEP ? (
            <Button key="next" type="button" onClick={goNext}>Avançar</Button>
          ) : (
            <Button key="submit" type="submit" loading={loading}>{isEditing ? 'Salvar' : 'Adicionar'}</Button>
          )}
        </div>
      </form>
    </Modal>
  )
}
