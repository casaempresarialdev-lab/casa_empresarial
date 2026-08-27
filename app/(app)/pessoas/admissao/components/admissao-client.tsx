'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { updateEmployeeStatusAction, updateAdmissionStageAction } from '../actions'
import { generateOnboardingTokenAction } from '../../funcionarios/actions'
import { ModalGerenciarColunas } from './modal-gerenciar-colunas'
import type { Employee } from '../../funcionarios/queries'
import type { OnboardingTokenInfo, AdmissionStage } from '../queries'

type StageKey = string

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

function getStage(emp: Employee, stages: AdmissionStage[]): StageKey {
  return emp.admission_stage ?? stages[0]?.key ?? ''
}

// ── Card Detail Modal ────────────────────────────────────────────────────────

function CardDetailModal({
  emp,
  token,
  photoUrl,
  onClose,
  onRefresh,
}: {
  emp: Employee
  token: OnboardingTokenInfo | undefined
  photoUrl?: string
  onClose: () => void
  onRefresh: () => void
}) {
  const [advancing, setAdvancing] = useState(false)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [linkUrl, setLinkUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const tStatus = tokenStatus(token)
  const nextStatus = emp.status === 'admissao' ? 'experiencia' : 'ativo'
  const nextLabel = emp.status === 'admissao' ? 'Iniciar experiência' : 'Efetuar contratação'

  async function handleAdvance() {
    const label = nextStatus === 'experiencia' ? 'período de experiência' : 'ativo'
    if (!confirm(`Avançar ${emp.nome} para status "${label}"?`)) return
    setAdvancing(true)
    const result = await updateEmployeeStatusAction(emp.id, nextStatus)
    setAdvancing(false)
    if ('error' in result) alert(result.error)
    else { onRefresh(); onClose() }
  }

  async function handleGenerateLink() {
    setGeneratingLink(true)
    const result = await generateOnboardingTokenAction(emp.id)
    setGeneratingLink(false)
    if ('error' in result || !result.url) { alert(result.error ?? 'Erro ao gerar link.'); return }
    setLinkUrl(result.url!)
    onRefresh()
  }

  async function handleCopy(url: string) {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleWhatsApp(url: string) {
    const phone = emp.telefone?.replace(/\D/g, '') ?? ''
    const nome = emp.nome.split(' ')[0]
    const msg = encodeURIComponent(`Olá ${nome}! Acesse o link abaixo para preencher seus dados de admissão:\n${url}`)
    window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl" style={{ backgroundColor: 'white' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-bg-surface)' }}>
          <div className="flex items-center gap-3">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt={emp.nome} className="w-10 h-10 rounded-full object-cover shrink-0" />
            ) : (
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-darker)' }}
              >
                {emp.nome.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="font-semibold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
                {emp.nome}
              </div>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {emp.cargo ?? 'Sem cargo'}{emp.data_admissao ? ` · ${formatDate(emp.data_admissao)}` : ''}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-sm"
            style={{ color: 'var(--color-text-muted)' }}
          >
            ✕
          </button>
        </div>

        {/* Formulário de auto-cadastro */}
        <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--color-bg-surface)' }}>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            FORMULÁRIO DE AUTO-CADASTRO
          </p>
          {tStatus === 'done' && (
            <p className="text-sm" style={{ color: '#1E8449' }}>
              ✓ Dados preenchidos em {formatDate(token!.used_at!.split('T')[0])}
            </p>
          )}
          {tStatus !== 'done' && !linkUrl && (
            <button
              onClick={handleGenerateLink}
              disabled={generatingLink}
              className="text-sm px-3 py-1.5 rounded-lg border transition-colors hover:bg-gray-50"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-primary-darker)' }}
            >
              {generatingLink ? 'Gerando…' : tStatus === 'pending' ? 'Gerar novo link' : tStatus === 'expired' ? 'Novo link' : 'Gerar link de cadastro'}
            </button>
          )}
          {linkUrl && (
            <div className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: '#EBF5FB' }}>
              <span className="text-xs truncate flex-1" style={{ color: '#2471A3' }}>{linkUrl}</span>
              <button
                onClick={() => handleCopy(linkUrl)}
                className="text-xs px-2 py-1 rounded border shrink-0"
                style={{ borderColor: '#2471A3', color: '#2471A3', backgroundColor: 'white' }}
              >
                {copied ? '✓ Copiado' : 'Copiar'}
              </button>
              {emp.telefone && (
                <button
                  onClick={() => handleWhatsApp(linkUrl)}
                  className="text-xs px-2 py-1 rounded shrink-0"
                  style={{ backgroundColor: '#25D366', color: 'white' }}
                >
                  WhatsApp
                </button>
              )}
            </div>
          )}
          {tStatus === 'expired' && !linkUrl && (
            <p className="text-xs mt-1" style={{ color: '#C0392B' }}>Link anterior expirado</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button loading={advancing} onClick={handleAdvance}>{nextLabel}</Button>
        </div>
      </div>
    </div>
  )
}

// ── Kanban Board ─────────────────────────────────────────────────────────────

interface Props {
  employees: Employee[]
  tokens: Record<string, OnboardingTokenInfo>
  companyId: string
  photoUrls: Record<string, string>
  stages: AdmissionStage[]
}

export function AdmissaoClient({ employees, tokens, photoUrls, companyId, stages }: Props) {
  const router = useRouter()

  const [stageMap, setStageMap] = useState<Record<string, StageKey>>(() => {
    const map: Record<string, StageKey> = {}
    for (const emp of employees) map[emp.id] = getStage(emp, stages)
    return map
  })
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<StageKey | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)
  const [manageOpen, setManageOpen] = useState(false)

  const defaultStageKey = stages[0]?.key ?? ''

  function getEmployeesInStage(stageKey: StageKey) {
    return employees.filter(e => (stageMap[e.id] ?? defaultStageKey) === stageKey)
  }

  async function moveToStage(empId: string, newStage: StageKey) {
    const prevStage = stageMap[empId] ?? defaultStageKey
    if (prevStage === newStage) return
    setMovingId(empId)
    setStageMap(prev => ({ ...prev, [empId]: newStage }))
    const result = await updateAdmissionStageAction(empId, newStage)
    setMovingId(null)
    if ('error' in result) {
      setStageMap(prev => ({ ...prev, [empId]: prevStage }))
      alert(result.error)
    }
  }

  function handleDragStart(e: React.DragEvent, empId: string) {
    e.dataTransfer.setData('empId', empId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingId(empId)
  }

  function handleDragEnd() {
    setDraggingId(null)
    setDragOverStage(null)
  }

  function handleDragOver(e: React.DragEvent, stageKey: StageKey) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverStage(stageKey)
  }

  function handleDrop(e: React.DragEvent, stageKey: StageKey) {
    e.preventDefault()
    const empId = e.dataTransfer.getData('empId')
    setDragOverStage(null)
    setDraggingId(null)
    if (empId) moveToStage(empId, stageKey)
  }

  function adjacentStage(current: StageKey, dir: 'prev' | 'next'): StageKey | null {
    const idx = stages.findIndex(s => s.key === current)
    if (dir === 'prev') return idx > 0 ? stages[idx - 1].key : null
    return idx < stages.length - 1 ? stages[idx + 1].key : null
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Admissão
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Arraste os cards entre as etapas ou use as setas ← →
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setManageOpen(true)}>⚙ Gerenciar colunas</Button>
          <Button onClick={() => router.push('/pessoas/admissao/novo')}>+ Adicionar</Button>
        </div>
      </div>

      {/* Kanban */}
      <div className="overflow-x-auto pb-4 -mx-1 px-1">
        <div className="flex gap-3" style={{ minWidth: `${stages.length * 268}px` }}>
          {stages.map((stage, stageIdx) => {
            const colEmps = getEmployeesInStage(stage.key)
            const isOver = dragOverStage === stage.key

            return (
              <div
                key={stage.key}
                className="flex flex-col flex-shrink-0 rounded-xl"
                style={{
                  width: 256,
                  backgroundColor: isOver ? `${stage.color}12` : 'var(--color-bg-surface)',
                  border: `2px solid ${isOver ? stage.color : 'transparent'}`,
                  transition: 'background-color 0.15s, border-color 0.15s',
                }}
                onDragOver={(e) => handleDragOver(e, stage.key)}
                onDragLeave={(e) => {
                  // only clear if leaving the column entirely (not entering a child)
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverStage(null)
                  }
                }}
                onDrop={(e) => handleDrop(e, stage.key)}
              >
                {/* Column header */}
                <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                  <span className="text-xs font-semibold flex-1 truncate" style={{ color: 'var(--color-text-secondary)' }}>
                    {stage.label}
                  </span>
                  <span
                    className="text-xs rounded-full px-1.5 py-0.5 font-semibold shrink-0"
                    style={{ backgroundColor: `${stage.color}22`, color: stage.color }}
                  >
                    {colEmps.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2 px-2 pb-3 flex-1 min-h-[80px]">
                  {colEmps.map(emp => {
                    const tok = tokens[emp.id]
                    const tStatus = tokenStatus(tok)
                    const isDragging = draggingId === emp.id
                    const isMoving = movingId === emp.id
                    const cur = stageMap[emp.id] ?? defaultStageKey
                    const prev = adjacentStage(cur, 'prev')
                    const next = adjacentStage(cur, 'next')

                    return (
                      <div
                        key={emp.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, emp.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => setSelectedEmp(emp)}
                        className="rounded-lg border cursor-pointer select-none"
                        style={{
                          backgroundColor: 'white',
                          borderColor: 'var(--color-bg-surface)',
                          opacity: isDragging ? 0.35 : isMoving ? 0.65 : 1,
                          boxShadow: isDragging
                            ? '0 8px 20px rgba(0,0,0,0.18)'
                            : '0 1px 3px rgba(0,0,0,0.06)',
                          transition: 'opacity 0.15s, box-shadow 0.15s',
                        }}
                      >
                        {/* Card body */}
                        <div className="px-3 pt-3 pb-2">
                          <div className="flex items-start gap-2">
                            {photoUrls[emp.id] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={photoUrls[emp.id]}
                                alt={emp.nome}
                                className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5"
                              />
                            ) : (
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-darker)' }}
                              >
                                {emp.nome.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                                {emp.nome}
                              </div>
                              <div className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                                {emp.cargo ?? 'Sem cargo'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                              {formatDate(emp.data_admissao)}
                            </span>
                            {tStatus === 'done' && (
                              <span className="text-xs font-medium" style={{ color: '#1E8449' }}>✓ Preenchido</span>
                            )}
                            {tStatus === 'pending' && (
                              <span className="text-xs" style={{ color: '#9A7D0A' }}>⏳ Aguardando</span>
                            )}
                            {tStatus === 'expired' && (
                              <span className="text-xs" style={{ color: '#C0392B' }}>Link expirado</span>
                            )}
                          </div>
                        </div>

                        {/* Move arrows — stopPropagation to not open modal */}
                        <div
                          className="border-t px-2 py-1.5 flex items-center justify-between"
                          style={{ borderColor: 'var(--color-bg-surface)' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => prev && moveToStage(emp.id, prev)}
                            disabled={!prev || isMoving}
                            className="w-6 h-6 flex items-center justify-center rounded text-sm hover:bg-gray-100 disabled:opacity-25 transition-colors"
                            style={{ color: 'var(--color-text-muted)' }}
                            title={prev ? stages.find(s => s.key === prev)?.label : undefined}
                          >
                            ←
                          </button>
                          <span className="text-xs tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                            {stageIdx + 1}/{stages.length}
                          </span>
                          <button
                            onClick={() => next && moveToStage(emp.id, next)}
                            disabled={!next || isMoving}
                            className="w-6 h-6 flex items-center justify-center rounded text-sm hover:bg-gray-100 disabled:opacity-25 transition-colors"
                            style={{ color: 'var(--color-text-muted)' }}
                            title={next ? stages.find(s => s.key === next)?.label : undefined}
                          >
                            →
                          </button>
                        </div>
                      </div>
                    )
                  })}

                  {/* Drop placeholder */}
                  {colEmps.length === 0 && isOver && (
                    <div
                      className="rounded-lg border-2 border-dashed h-16 flex items-center justify-center"
                      style={{ borderColor: stage.color }}
                    >
                      <span className="text-xs" style={{ color: stage.color }}>Soltar aqui</span>
                    </div>
                  )}

                  {/* Empty state */}
                  {colEmps.length === 0 && !isOver && (
                    <div className="h-16" />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Empty total state */}
      {employees.length === 0 && (
        <div
          className="rounded-xl border p-10 text-center mt-4"
          style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}
        >
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Nenhum candidato em processo de admissão.
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
            Clique em "+ Adicionar" para iniciar uma admissão.
          </p>
        </div>
      )}

      {/* Card detail modal */}
      {selectedEmp && (
        <CardDetailModal
          emp={selectedEmp}
          token={tokens[selectedEmp.id]}
          photoUrl={photoUrls[selectedEmp.id]}
          onClose={() => setSelectedEmp(null)}
          onRefresh={() => router.refresh()}
        />
      )}

      <ModalGerenciarColunas
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        companyId={companyId}
        stages={stages}
      />
    </>
  )
}
