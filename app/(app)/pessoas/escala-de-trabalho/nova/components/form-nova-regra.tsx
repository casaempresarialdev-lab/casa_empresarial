'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createRuleAction } from '../../actions'
import type { FolgaPattern } from '@/lib/escala/generate'

const DIAS_SEMANA = [
  { idx: 0, label: 'Dom' },
  { idx: 1, label: 'Seg' },
  { idx: 2, label: 'Ter' },
  { idx: 3, label: 'Qua' },
  { idx: 4, label: 'Qui' },
  { idx: 5, label: 'Sex' },
  { idx: 6, label: 'Sáb' },
]

// Calcula a data de referência automaticamente a partir da data de início da regra.
// Para padrões baseados em dia da semana (quinzenal/intervalo_semanas): avança até
// a primeira ocorrência do dia alvo >= data_inicio. Para os demais: usa data_inicio.
function computeDataRef(
  tipo: FolgaPattern['tipo'],
  dia: number,
  dataInicio: string,
): string {
  if (!dataInicio) return ''
  const start = new Date(dataInicio + 'T00:00:00')

  if (tipo === 'quinzenal' || tipo === 'intervalo_semanas') {
    const d = new Date(start)
    while (d.getDay() !== dia) d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  }

  return dataInicio
}

interface Props {
  companyId: string
  employees: { id: string; nome: string; cargo: string | null }[]
}

const lbl: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  marginBottom: '0.25rem',
  display: 'block',
}

const sec: React.CSSProperties = {
  padding: '1rem',
  borderRadius: '0.75rem',
  border: '1px solid var(--color-bg-surface)',
  backgroundColor: '#FAFAFA',
  marginBottom: '0.75rem',
}

const secTitle: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--color-text-muted)',
  marginBottom: '0.75rem',
}

const selectSm: React.CSSProperties = {
  padding: '0.35rem 0.6rem',
  borderRadius: '0.4rem',
  border: '1px solid var(--color-bg-surface)',
  fontSize: '0.8rem',
  backgroundColor: 'white',
  color: 'var(--color-text-primary)',
}

export function FormNovaRegra({ companyId, employees }: Props) {
  const router = useRouter()

  const [employeeId,        setEmployeeId]       = useState('')
  const [dataInicio,        setDataInicio]        = useState('')
  const [dataFim,           setDataFim]           = useState('')
  const [semFim,            setSemFim]            = useState(true)
  const [tipoEscala,        setTipoEscala]        = useState<'semanal' | 'ciclo'>('semanal')
  const [diasFolga,         setDiasFolga]         = useState<number[]>([0, 6])
  const [dataReferencia,    setDataReferencia]    = useState('')
  const [cicloTrabalhoDias, setCicloTrabalhoDias] = useState(1)
  const [cicloFolgaDias,    setCicloFolgaDias]    = useState(2)
  const [horaEntrada,       setHoraEntrada]       = useState('08:00')
  const [horaSaida,         setHoraSaida]         = useState('17:00')
  const [temAlmoco,         setTemAlmoco]         = useState(false)
  const [horaAlmocoInicio,  setHoraAlmocoInicio]  = useState('12:00')
  const [horaAlmocoFim,     setHoraAlmocoFim]     = useState('13:00')
  const [loading,           setLoading]           = useState(false)
  const [error,             setError]             = useState('')

  // Folgas adicionais — seleção única (radio) + valor numérico
  type PTipo = 'intervalo_dias' | 'intervalo_semanas' | 'quinzenal' | 'intervalo_meses' | 'intervalo_anos' | null
  const [pTipo,  setPTipo]  = useState<PTipo>(null)
  const [pValor, setPValor] = useState(1)

  function toggleDiaFolga(idx: number) {
    setDiasFolga(prev =>
      prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx],
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const dia = dataInicio ? new Date(dataInicio + 'T00:00:00').getDay() : 0
    let folga_patterns: FolgaPattern[] = []
    if (tipoEscala === 'semanal' && pTipo) {
      if (pTipo === 'intervalo_dias') {
        folga_patterns = [{ tipo: 'intervalo_dias', intervalo: pValor, data_ref: dataInicio }]
      } else if (pTipo === 'intervalo_semanas') {
        const data_ref = computeDataRef('intervalo_semanas', dia, dataInicio)
        folga_patterns = [{ tipo: 'intervalo_semanas', intervalo: pValor, dia, data_ref }]
      } else if (pTipo === 'quinzenal') {
        const data_ref = computeDataRef('intervalo_semanas', dia, dataInicio)
        folga_patterns = [{ tipo: 'intervalo_semanas', intervalo: pValor * 2, dia, data_ref }]
      } else if (pTipo === 'intervalo_meses') {
        folga_patterns = [{ tipo: 'intervalo_meses', intervalo: pValor, data_ref: dataInicio }]
      } else if (pTipo === 'intervalo_anos') {
        folga_patterns = [{ tipo: 'intervalo_meses', intervalo: pValor * 12, data_ref: dataInicio }]
      }
    }

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
      folga_patterns,
    }

    setLoading(true)
    const result = await createRuleAction(companyId, payload)
    setLoading(false)

    if ('error' in result) { setError(result.error ?? 'Erro desconhecido'); return }
    router.push('/pessoas/escala-de-trabalho')
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          ← Escala de Trabalho
        </button>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
          Adicionar Regra de Escala
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Defina o horário e os dias de trabalho do colaborador
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* Seção 1 — Funcionário */}
        <div style={sec}>
          <p style={secTitle}>Funcionário</p>
          <label style={lbl}>Selecione o funcionário *</label>
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

        {/* Seção 2 — Vigência */}
        <div style={sec}>
          <p style={secTitle}>Vigência</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={lbl}>Data de início *</label>
              <Input type="date" required value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Data de término</label>
              <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} disabled={semFim} />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={semFim} onChange={e => setSemFim(e.target.checked)} />
            Sem data de término (regra ativa indefinidamente)
          </label>
        </div>

        {/* Seção 3 — Horários */}
        <div style={sec}>
          <p style={secTitle}>Horários</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={lbl}>Entrada *</label>
              <Input type="time" required value={horaEntrada} onChange={e => setHoraEntrada(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Saída *</label>
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
                <label style={lbl}>Início do almoço</label>
                <Input type="time" value={horaAlmocoInicio} onChange={e => setHoraAlmocoInicio(e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Fim do almoço</label>
                <Input type="time" value={horaAlmocoFim} onChange={e => setHoraAlmocoFim(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Seção 4 — Folgas */}
        <div style={sec}>
          <p style={secTitle}>Folgas</p>
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
                {t === 'semanal' ? 'Fixa' : 'Personalizado'}
              </button>
            ))}
          </div>

          {tipoEscala === 'semanal' && (
            <>
              <label style={lbl}>Dias de folga</label>
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
                  <label style={lbl}>Dias trabalhados seguidos *</label>
                  <Input
                    type="number"
                    min="1"
                    required
                    value={cicloTrabalhoDias}
                    onChange={e => setCicloTrabalhoDias(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <label style={lbl}>Dias de folga seguidos *</label>
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
                <label style={lbl}>Data do primeiro dia de trabalho *</label>
                <Input type="date" required value={dataReferencia} onChange={e => setDataReferencia(e.target.value)} />
                <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.3rem' }}>
                  Ex: 12x36 → 1 dia trabalhado + 2 dias de folga. 5x2 → 5 + 2.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Seção 5 — Folgas adicionais (apenas semanal) */}
        {tipoEscala === 'semanal' && (
          <div style={sec}>
            <p style={secTitle}>Repetição</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {([
                { tipo: 'intervalo_dias',    label: 'Por dias',    sufixo: 'dia(s)'      },
                { tipo: 'intervalo_semanas', label: 'Por semanas', sufixo: 'semana(s)'   },
                { tipo: 'quinzenal',         label: 'Quinzenal',   sufixo: 'quinzena(s)' },
                { tipo: 'intervalo_meses',   label: 'Mensal',      sufixo: 'mês/meses'   },
                { tipo: 'intervalo_anos',    label: 'Anual',       sufixo: 'ano(s)'      },
              ] as const).map(({ tipo, label, sufixo }) => {
                const ativo = pTipo === tipo
                return (
                  <div
                    key={tipo}
                    style={{
                      padding: '0.6rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: `1px solid ${ativo ? 'var(--color-primary-dark)' : 'var(--color-bg-surface)'}`,
                      backgroundColor: ativo ? 'var(--color-primary)' : 'white',
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, color: ativo ? 'var(--color-primary-darker)' : 'var(--color-text-primary)' }}>
                      <input
                        type="radio"
                        name="pTipo"
                        checked={ativo}
                        onChange={() => { setPTipo(tipo); setPValor(1) }}
                      />
                      {label}
                    </label>
                    {ativo && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-primary-darker)' }}>A cada</span>
                        <input
                          type="number"
                          min="1"
                          value={pValor}
                          onChange={e => setPValor(parseInt(e.target.value) || 1)}
                          style={{ ...selectSm, width: '4rem', textAlign: 'center' }}
                        />
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-primary-darker)' }}>{sufixo}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {error && (
          <p style={{ fontSize: '0.8rem', color: 'var(--color-error)', marginBottom: '0.75rem' }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
          <Button type="button" variant="ghost" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" loading={loading}>Adicionar</Button>
        </div>
      </form>
    </>
  )
}
