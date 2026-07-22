'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createRuleAction, updateRuleAction } from '../actions'
import type { ScheduleRule, FolgaPattern } from '@/lib/escala/generate'

const DIAS_SEMANA = [
  { idx: 0, label: 'Dom' },
  { idx: 1, label: 'Seg' },
  { idx: 2, label: 'Ter' },
  { idx: 3, label: 'Qua' },
  { idx: 4, label: 'Qui' },
  { idx: 5, label: 'Sex' },
  { idx: 6, label: 'Sáb' },
]

const PATTERN_TIPOS = [
  { value: 'quinzenal',          label: 'Quinzenal (a cada 2 semanas)' },
  { value: 'intervalo_dias',     label: 'A cada N dias' },
  { value: 'intervalo_semanas',  label: 'A cada N semanas' },
  { value: 'intervalo_meses',    label: 'A cada N meses' },
]

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  employees: { id: string; nome: string; cargo: string | null }[]
  rule?: ScheduleRule | null
}

function emptyPattern(): FolgaPattern {
  return { tipo: 'quinzenal', dia: 0, data_ref: '' }
}

export function ModalRegraEscala({ open, onClose, companyId, employees, rule }: Props) {
  const router  = useRouter()
  const isEdit  = !!rule

  const [employeeId,         setEmployeeId]         = useState('')
  const [dataInicio,         setDataInicio]          = useState('')
  const [dataFim,            setDataFim]             = useState('')
  const [semFim,             setSemFim]              = useState(true)
  const [tipoEscala,         setTipoEscala]          = useState<'semanal' | 'ciclo'>('semanal')
  const [diasFolga,          setDiasFolga]           = useState<number[]>([0, 6])
  const [dataReferencia,     setDataReferencia]      = useState('')
  const [cicloTrabalhoDias,  setCicloTrabalhoDias]   = useState(1)
  const [cicloFolgaDias,     setCicloFolgaDias]      = useState(2)
  const [horaEntrada,        setHoraEntrada]         = useState('08:00')
  const [horaSaida,          setHoraSaida]           = useState('17:00')
  const [temAlmoco,          setTemAlmoco]           = useState(false)
  const [horaAlmocoInicio,   setHoraAlmocoInicio]    = useState('12:00')
  const [horaAlmocoFim,      setHoraAlmocoFim]       = useState('13:00')
  const [folgaPatterns,      setFolgaPatterns]       = useState<FolgaPattern[]>([])
  const [loading,            setLoading]             = useState(false)
  const [error,              setError]               = useState('')

  useEffect(() => {
    if (!open) return
    if (rule) {
      setEmployeeId(rule.employee_id)
      setDataInicio(rule.data_inicio)
      setDataFim(rule.data_fim ?? '')
      setSemFim(!rule.data_fim)
      setTipoEscala(rule.tipo_escala)
      setDiasFolga(rule.dias_folga ?? [])
      setDataReferencia(rule.data_referencia ?? '')
      setCicloTrabalhoDias(rule.ciclo_trabalho_dias ?? 1)
      setCicloFolgaDias(rule.ciclo_folga_dias ?? 2)
      setHoraEntrada(rule.hora_entrada)
      setHoraSaida(rule.hora_saida)
      setTemAlmoco(!!(rule.hora_almoco_inicio))
      setHoraAlmocoInicio(rule.hora_almoco_inicio ?? '12:00')
      setHoraAlmocoFim(rule.hora_almoco_fim ?? '13:00')
      setFolgaPatterns(rule.folga_patterns ?? [])
    } else {
      setEmployeeId('')
      setDataInicio('')
      setDataFim('')
      setSemFim(true)
      setTipoEscala('semanal')
      setDiasFolga([0, 6])
      setDataReferencia('')
      setCicloTrabalhoDias(1)
      setCicloFolgaDias(2)
      setHoraEntrada('08:00')
      setHoraSaida('17:00')
      setTemAlmoco(false)
      setHoraAlmocoInicio('12:00')
      setHoraAlmocoFim('13:00')
      setFolgaPatterns([])
    }
    setError('')
  }, [open, rule])

  function toggleDiaFolga(idx: number) {
    setDiasFolga(prev =>
      prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx],
    )
  }

  function addPattern() {
    setFolgaPatterns(prev => [...prev, emptyPattern()])
  }

  function removePattern(i: number) {
    setFolgaPatterns(prev => prev.filter((_, idx) => idx !== i))
  }

  function updatePattern(i: number, patch: Partial<FolgaPattern>) {
    setFolgaPatterns(prev =>
      prev.map((p, idx) => (idx === i ? { ...p, ...patch } as FolgaPattern : p)),
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const payload = {
      employee_id:         employeeId,
      data_inicio:         dataInicio,
      data_fim:            semFim ? null : (dataFim || null),
      hora_entrada:        horaEntrada,
      hora_saida:          horaSaida,
      hora_almoco_inicio:  temAlmoco ? horaAlmocoInicio : null,
      hora_almoco_fim:     temAlmoco ? horaAlmocoFim    : null,
      tipo_escala:         tipoEscala,
      dias_folga:          tipoEscala === 'semanal' ? diasFolga : [],
      data_referencia:     tipoEscala === 'ciclo' ? dataReferencia : null,
      ciclo_trabalho_dias: tipoEscala === 'ciclo' ? cicloTrabalhoDias : null,
      ciclo_folga_dias:    tipoEscala === 'ciclo' ? cicloFolgaDias    : null,
      folga_patterns:      tipoEscala === 'semanal' ? folgaPatterns : [],
    }

    setLoading(true)
    const result = isEdit
      ? await updateRuleAction(rule!.id, companyId, payload)
      : await createRuleAction(companyId, payload)
    setLoading(false)

    if ('error' in result) { setError(result.error ?? 'Erro desconhecido'); return }
    router.refresh()
    onClose()
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    marginBottom: '0.25rem',
    display: 'block',
  }

  const sectionStyle: React.CSSProperties = {
    padding: '1rem',
    borderRadius: '0.75rem',
    border: '1px solid var(--color-bg-surface)',
    backgroundColor: '#FAFAFA',
    marginBottom: '0.75rem',
  }

  const sectionTitle: React.CSSProperties = {
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--color-text-muted)',
    marginBottom: '0.75rem',
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Regra de Escala' : 'Adicionar Regra de Escala'}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>

        {/* Seção 1 — Funcionário */}
        {!isEdit && (
          <div style={sectionStyle}>
            <p style={sectionTitle}>Funcionário</p>
            <label style={labelStyle}>Selecione o funcionário</label>
            <select
              required
              value={employeeId}
              onChange={e => setEmployeeId(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--color-bg-surface)', fontSize: '0.875rem', backgroundColor: 'white', color: 'var(--color-text-primary)' }}
            >
              <option value="">Selecione...</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.nome}{emp.cargo ? ` — ${emp.cargo}` : ''}</option>
              ))}
            </select>
          </div>
        )}

        {/* Seção 2 — Vigência */}
        <div style={sectionStyle}>
          <p style={sectionTitle}>Vigência</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Data de início *</label>
              <Input type="date" required value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Data de término</label>
              <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} disabled={semFim} />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={semFim} onChange={e => setSemFim(e.target.checked)} />
            Sem data de término (regra ativa indefinidamente)
          </label>
        </div>

        {/* Seção 3 — Tipo de escala */}
        <div style={sectionStyle}>
          <p style={sectionTitle}>Tipo de escala</p>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
            {(['semanal', 'ciclo'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTipoEscala(t)}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  borderRadius: '0.5rem',
                  border: '1px solid',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  borderColor: tipoEscala === t ? 'var(--color-primary-dark)' : 'var(--color-bg-surface)',
                  backgroundColor: tipoEscala === t ? 'var(--color-primary)' : 'white',
                  color: tipoEscala === t ? 'var(--color-primary-darker)' : 'var(--color-text-secondary)',
                }}
              >
                {t === 'semanal' ? 'Semanal' : 'Ciclo rotativo'}
              </button>
            ))}
          </div>

          {tipoEscala === 'semanal' && (
            <>
              <label style={labelStyle}>Dias de folga</label>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {DIAS_SEMANA.map(d => {
                  const active = diasFolga.includes(d.idx)
                  return (
                    <button
                      key={d.idx}
                      type="button"
                      onClick={() => toggleDiaFolga(d.idx)}
                      style={{
                        padding: '0.3rem 0.75rem',
                        borderRadius: '999px',
                        border: '1px solid',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        borderColor: active ? '#C0392B' : 'var(--color-bg-surface)',
                        backgroundColor: active ? '#FDEDEC' : 'white',
                        color: active ? '#C0392B' : 'var(--color-text-secondary)',
                      }}
                    >
                      {d.label}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {tipoEscala === 'ciclo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Dias trabalhados seguidos *</label>
                  <Input
                    type="number"
                    min="1"
                    required
                    value={cicloTrabalhoDias}
                    onChange={e => setCicloTrabalhoDias(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Dias de folga seguidos *</label>
                  <Input
                    type="number"
                    min="1"
                    required
                    value={cicloFolgaDias}
                    onChange={e => setCicloFolgaDias(parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Data do primeiro dia de trabalho *</label>
                <Input type="date" required value={dataReferencia} onChange={e => setDataReferencia(e.target.value)} />
                <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.3rem' }}>
                  Ex: 12x36 → 1 dia trabalhado + 2 dias de folga. 5x2 → 5 + 2.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Seção 4 — Horários */}
        <div style={sectionStyle}>
          <p style={sectionTitle}>Horários</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Entrada *</label>
              <Input type="time" required value={horaEntrada} onChange={e => setHoraEntrada(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Saída *</label>
              <Input type="time" required value={horaSaida} onChange={e => setHoraSaida(e.target.value)} />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-secondary)', cursor: 'pointer', marginBottom: '0.5rem' }}>
            <input type="checkbox" checked={temAlmoco} onChange={e => setTemAlmoco(e.target.checked)} />
            Tem intervalo de almoço
          </label>
          {temAlmoco && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={labelStyle}>Início do almoço</label>
                <Input type="time" value={horaAlmocoInicio} onChange={e => setHoraAlmocoInicio(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Fim do almoço</label>
                <Input type="time" value={horaAlmocoFim} onChange={e => setHoraAlmocoFim(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Seção 5 — Folgas adicionais (apenas semanal) */}
        {tipoEscala === 'semanal' && (
          <div style={sectionStyle}>
            <p style={sectionTitle}>Folgas adicionais</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
              Para folgas que não seguem um dia fixo da semana (quinzenal, a cada N dias, etc.).
            </p>

            {folgaPatterns.map((p, i) => (
              <div key={i} style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--color-bg-surface)', backgroundColor: 'white', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={labelStyle}>Padrão {i + 1}</label>
                  <button type="button" onClick={() => removePattern(i)} style={{ fontSize: '0.75rem', color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer' }}>Remover</button>
                </div>
                <select
                  value={p.tipo}
                  onChange={e => updatePattern(i, { tipo: e.target.value as FolgaPattern['tipo'] })}
                  style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '0.4rem', border: '1px solid var(--color-bg-surface)', fontSize: '0.8rem', marginBottom: '0.5rem', backgroundColor: 'white', color: 'var(--color-text-primary)' }}
                >
                  {PATTERN_TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {(p.tipo === 'quinzenal' || p.tipo === 'intervalo_semanas') && (
                    <div>
                      <label style={labelStyle}>Dia da semana</label>
                      <select
                        value={(p as { dia: number }).dia}
                        onChange={e => updatePattern(i, { dia: parseInt(e.target.value) } as Partial<FolgaPattern>)}
                        style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '0.4rem', border: '1px solid var(--color-bg-surface)', fontSize: '0.8rem', backgroundColor: 'white', color: 'var(--color-text-primary)' }}
                      >
                        {DIAS_SEMANA.map(d => <option key={d.idx} value={d.idx}>{d.label}</option>)}
                      </select>
                    </div>
                  )}
                  {(p.tipo === 'intervalo_dias' || p.tipo === 'intervalo_semanas' || p.tipo === 'intervalo_meses') && (
                    <div>
                      <label style={labelStyle}>
                        {p.tipo === 'intervalo_dias' ? 'A cada (dias)' : p.tipo === 'intervalo_semanas' ? 'A cada (semanas)' : 'A cada (meses)'}
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={(p as { intervalo: number }).intervalo ?? 1}
                        onChange={e => updatePattern(i, { intervalo: parseInt(e.target.value) } as Partial<FolgaPattern>)}
                      />
                    </div>
                  )}
                  <div>
                    <label style={labelStyle}>Data de referência</label>
                    <Input
                      type="date"
                      value={(p as { data_ref: string }).data_ref ?? ''}
                      onChange={e => updatePattern(i, { data_ref: e.target.value } as Partial<FolgaPattern>)}
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addPattern}
              style={{ fontSize: '0.8rem', color: 'var(--color-primary-darker)', background: 'none', border: '1px dashed var(--color-primary-dark)', borderRadius: '0.5rem', padding: '0.4rem 0.75rem', cursor: 'pointer', width: '100%' }}
            >
              + Adicionar padrão de folga
            </button>
          </div>
        )}

        {error && (
          <p style={{ fontSize: '0.8rem', color: 'var(--color-error)', marginBottom: '0.5rem' }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{isEdit ? 'Salvar' : 'Adicionar'}</Button>
        </div>
      </form>
    </Modal>
  )
}
