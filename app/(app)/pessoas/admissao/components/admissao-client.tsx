'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { updateEmployeeStatusAction } from '../actions'
import { generateOnboardingTokenAction } from '../../funcionarios/actions'
import type { Employee } from '../../funcionarios/queries'
import type { OnboardingTokenInfo } from '../queries'

interface Props {
  employees: Employee[]
  tokens: Record<string, OnboardingTokenInfo>
  companyId: string
}

const STATUS_CONFIG = {
  admissao:    { label: 'Em admissão', bg: '#FEF9E7', text: '#D4AC0D' },
  experiencia: { label: 'Experiência', bg: '#EBF5FB', text: '#2471A3' },
}

const CHECKLIST = [
  'Contrato de trabalho assinado',
  'CTPS registrada',
  'Exame admissional (ASO)',
  'Ficha de registro preenchida',
  'Declaração de dependentes (IRRF)',
  'Declaração de VT',
  'Dados bancários',
  'Foto 3x4',
  'Comprovante de residência',
  'Cópia do CPF e RG',
]

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

function tokenStatus(t: OnboardingTokenInfo | undefined): 'none' | 'pending' | 'done' | 'expired' {
  if (!t) return 'none'
  if (t.used_at) return 'done'
  if (new Date(t.expires_at) < new Date()) return 'expired'
  return 'pending'
}

export function AdmissaoClient({ employees, tokens, companyId }: Props) {
  const router = useRouter()
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [checked, setChecked]         = useState<Record<string, Record<number, boolean>>>({})
  const [updatingId, setUpdatingId]   = useState<string | null>(null)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  // linkPanels: employeeId → URL gerado
  const [linkPanels, setLinkPanels]   = useState<Record<string, string>>({})
  const [copied, setCopied]           = useState<Record<string, boolean>>({})

  function toggleChecked(empId: string, idx: number) {
    setChecked(prev => ({ ...prev, [empId]: { ...prev[empId], [idx]: !prev[empId]?.[idx] } }))
  }

  function getCheckCount(empId: string) {
    return Object.values(checked[empId] ?? {}).filter(Boolean).length
  }

  async function handleAdvance(emp: Employee) {
    const nextStatus = emp.status === 'admissao' ? 'experiencia' : 'ativo'
    const label = nextStatus === 'experiencia' ? 'período de experiência' : 'ativo'
    if (!confirm(`Avançar ${emp.nome} para status "${label}"?`)) return
    setUpdatingId(emp.id)
    const result = await updateEmployeeStatusAction(emp.id, nextStatus)
    setUpdatingId(null)
    if ('error' in result) alert(result.error)
    else router.refresh()
  }

  async function handleGenerateLink(emp: Employee) {
    setGeneratingId(emp.id)
    const result = await generateOnboardingTokenAction(emp.id)
    setGeneratingId(null)
    if ('error' in result || !result.url) { alert(result.error ?? 'Erro ao gerar link.'); return }
    setLinkPanels(p => ({ ...p, [emp.id]: result.url! }))
    router.refresh()
  }

  async function handleCopy(empId: string, url: string) {
    await navigator.clipboard.writeText(url)
    setCopied(p => ({ ...p, [empId]: true }))
    setTimeout(() => setCopied(p => ({ ...p, [empId]: false })), 2000)
  }

  function handleWhatsApp(emp: Employee, url: string) {
    const phone = emp.telefone?.replace(/\D/g, '') ?? ''
    const nome  = emp.nome.split(' ')[0]
    const msg   = encodeURIComponent(`Olá ${nome}! Acesse o link abaixo para preencher seus dados de admissão:\n${url}`)
    window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank')
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Admissão
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Funcionários em processo de admissão ou período de experiência
          </p>
        </div>
        <Button onClick={() => router.push('/pessoas/admissao/novo')}>Adicionar</Button>
      </div>

      {employees.length === 0 && (
        <div className="rounded-xl border p-10 text-center" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Nenhum funcionário em admissão ou período de experiência.
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
            Clique em "Adicionar" para iniciar uma admissão.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {employees.map(emp => {
          const cfg       = STATUS_CONFIG[emp.status as keyof typeof STATUS_CONFIG]
          const checkCount = getCheckCount(emp.id)
          const isExpanded = expandedId === emp.id
          const nextLabel  = emp.status === 'admissao' ? 'Iniciar experiência' : 'Efetuar contratação'
          const token      = tokens[emp.id]
          const status     = tokenStatus(token)
          const panelUrl   = linkPanels[emp.id]

          return (
            <div key={emp.id} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
              {/* Header do card */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-darker)' }}>
                    {emp.nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>{emp.nome}</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {emp.cargo ?? 'Sem cargo'}{emp.data_admissao ? ` · Admitido em ${formatDate(emp.data_admissao)}` : ''}
                    </div>
                    {/* Status do auto-cadastro */}
                    {status === 'done' && (
                      <span className="text-xs" style={{ color: '#1E8449' }}>
                        ✓ Dados preenchidos em {formatDate(token!.used_at!.split('T')[0])}
                      </span>
                    )}
                    {status === 'pending' && !panelUrl && (
                      <span className="text-xs" style={{ color: '#9A7D0A' }}>⏳ Aguardando preenchimento</span>
                    )}
                    {status === 'expired' && (
                      <span className="text-xs" style={{ color: '#C0392B' }}>Link expirado</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {checkCount}/{CHECKLIST.length} docs
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: cfg.bg, color: cfg.text }}>
                    {cfg.label}
                  </span>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : emp.id)}
                    className="text-xs px-3 py-1.5 rounded-lg border transition-colors hover:bg-gray-50"
                    style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}>
                    {isExpanded ? 'Recolher' : 'Checklist'}
                  </button>
                  {/* Botão de link de auto-cadastro */}
                  {status !== 'done' && (
                    <button
                      onClick={() => panelUrl
                        ? setLinkPanels(p => ({ ...p })) // já visível — não faz nada (painel aberto abaixo)
                        : handleGenerateLink(emp)
                      }
                      disabled={generatingId === emp.id || !!panelUrl}
                      className="text-xs px-3 py-1.5 rounded-lg border transition-colors hover:bg-gray-50"
                      style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-primary-darker)', opacity: panelUrl ? 0.5 : 1 }}>
                      {generatingId === emp.id ? '...' : panelUrl ? 'Link gerado ↓' : status === 'pending' ? 'Gerar novo link' : status === 'expired' ? 'Novo link' : 'Enviar link'}
                    </button>
                  )}
                  <Button size="sm" loading={updatingId === emp.id} onClick={() => handleAdvance(emp)}>
                    {nextLabel}
                  </Button>
                </div>
              </div>

              {/* Painel do link de auto-cadastro */}
              {panelUrl && (
                <div className="border-t px-5 py-3 flex items-center gap-3"
                  style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: '#EBF5FB' }}>
                  <span className="text-lg">🔗</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--color-primary-darker)' }}>
                      Link de auto-cadastro — válido por 7 dias
                    </p>
                    <p className="text-xs truncate" style={{ color: '#2471A3' }}>{panelUrl}</p>
                  </div>
                  <button onClick={() => handleCopy(emp.id, panelUrl)}
                    className="text-xs px-3 py-1.5 rounded-lg border flex-shrink-0"
                    style={{ borderColor: '#2471A3', color: '#2471A3', backgroundColor: 'white' }}>
                    {copied[emp.id] ? '✓ Copiado' : 'Copiar'}
                  </button>
                  {emp.telefone && (
                    <button onClick={() => handleWhatsApp(emp, panelUrl)}
                      className="text-xs px-3 py-1.5 rounded-lg flex-shrink-0"
                      style={{ backgroundColor: '#25D366', color: 'white' }}>
                      WhatsApp
                    </button>
                  )}
                  <button onClick={() => setLinkPanels(p => { const n = { ...p }; delete n[emp.id]; return n })}
                    className="text-xs px-2 py-1.5 rounded-lg flex-shrink-0"
                    style={{ color: 'var(--color-text-muted)' }}>
                    ✕
                  </button>
                </div>
              )}

              {/* Checklist expandido */}
              {isExpanded && (
                <div className="border-t px-5 py-4" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'var(--color-bg-surface)' }}>
                  <p className="text-xs font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                    DOCUMENTOS E ETAPAS DE ADMISSÃO
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {CHECKLIST.map((item, idx) => {
                      const done = checked[emp.id]?.[idx] ?? false
                      return (
                        <label key={idx} className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={done} onChange={() => toggleChecked(emp.id, idx)} className="rounded" />
                          <span className="text-xs" style={{
                            color: done ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                            textDecoration: done ? 'line-through' : 'none',
                          }}>
                            {item}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                  {emp.data_experiencia_fim && (
                    <p className="text-xs mt-3" style={{ color: 'var(--color-text-muted)' }}>
                      Fim do período de experiência: {formatDate(emp.data_experiencia_fim)}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
