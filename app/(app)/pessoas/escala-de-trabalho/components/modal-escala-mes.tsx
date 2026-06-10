'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createMonthlyScheduleAction, deleteSchedulePeriodAction } from '../actions'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  mes: number
  ano: number
  employees: { id: string; nome: string; cargo: string | null }[]
}

const DIAS = [
  { idx: 0, label: 'Dom' },
  { idx: 1, label: 'Seg' },
  { idx: 2, label: 'Ter' },
  { idx: 3, label: 'Qua' },
  { idx: 4, label: 'Qui' },
  { idx: 5, label: 'Sex' },
  { idx: 6, label: 'Sáb' },
]

const TURNOS_PRESET = [
  { value: 'manha',  label: 'Manhã',        inicio: '08:00', fim: '12:00' },
  { value: 'tarde',  label: 'Tarde',         inicio: '13:00', fim: '17:00' },
  { value: 'noite',  label: 'Noite',         inicio: '18:00', fim: '22:00' },
  { value: 'custom', label: 'Personalizado', inicio: '',      fim: ''      },
]

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function pad(n: number) { return String(n).padStart(2, '0') }

export function ModalEscalaMes({ open, onClose, companyId, mes, ano, employees }: Props) {
  const router = useRouter()

  const [employeeId, setEmployeeId]     = useState('')
  const [diasSemana, setDiasSemana]     = useState<number[]>([1, 2, 3, 4, 5])
  const [turno, setTurno]               = useState('manha')
  const [horaInicio, setHoraInicio]     = useState('08:00')
  const [horaFim, setHoraFim]           = useState('12:00')
  const [excluidas, setExcluidas]       = useState<Set<string>>(new Set())
  const [periodoInicio, setPeriodoInicio] = useState('')
  const [periodoFim, setPeriodoFim]     = useState('')
  const [mesesReplicar, setMesesReplicar] = useState(1)
  const [deleteInicio, setDeleteInicio] = useState('')
  const [deleteFim, setDeleteFim]       = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteMsg, setDeleteMsg]       = useState('')
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setEmployeeId('')
    setDiasSemana([1, 2, 3, 4, 5])
    applyPreset('manha')
    setExcluidas(new Set())
    setPeriodoInicio('')
    setPeriodoFim('')
    setMesesReplicar(1)
    setDeleteInicio('')
    setDeleteFim('')
    setDeleteMsg('')
  }, [open])

  function applyPreset(value: string) {
    setTurno(value)
    const preset = TURNOS_PRESET.find(t => t.value === value)
    if (preset) { setHoraInicio(preset.inicio); setHoraFim(preset.fim) }
  }

  function toggleDia(idx: number) {
    setDiasSemana(prev =>
      prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx]
    )
  }

  // Todas as datas candidatas (dias da semana selecionados)
  const todasDatas = useMemo(() => {
    if (diasSemana.length === 0) return []
    const totalDias = new Date(ano, mes, 0).getDate()
    const datas: string[] = []
    for (let d = 1; d <= totalDias; d++) {
      const date = new Date(ano, mes - 1, d)
      if (diasSemana.includes(date.getDay())) {
        datas.push(`${ano}-${pad(mes)}-${pad(d)}`)
      }
    }
    return datas
  }, [diasSemana, mes, ano])

  const incluidas = todasDatas.filter(d => !excluidas.has(d))
  const folgas    = todasDatas.filter(d => excluidas.has(d))

  // Calcula total de turnos considerando replicação (meses extras sem exclusões específicas)
  const totalTurnos = useMemo(() => {
    if (diasSemana.length === 0) return 0
    let count = incluidas.length
    for (let m = 1; m < mesesReplicar; m++) {
      let curMes = mes + m
      let curAno = ano
      while (curMes > 12) { curMes -= 12; curAno++ }
      const totalDias = new Date(curAno, curMes, 0).getDate()
      for (let d = 1; d <= totalDias; d++) {
        const date = new Date(curAno, curMes - 1, d)
        if (diasSemana.includes(date.getDay())) count++
      }
    }
    return count
  }, [incluidas.length, diasSemana, mesesReplicar, mes, ano])

  function toggleExcluida(data: string) {
    setExcluidas(prev => {
      const next = new Set(prev)
      if (next.has(data)) next.delete(data)
      else next.add(data)
      return next
    })
  }

  function aplicarPeriodo() {
    if (!periodoInicio || !periodoFim) return
    const inicio = new Date(periodoInicio + 'T00:00:00')
    const fim    = new Date(periodoFim    + 'T00:00:00')
    if (inicio > fim) return

    setExcluidas(prev => {
      const next = new Set(prev)
      todasDatas.forEach(d => {
        const date = new Date(d + 'T00:00:00')
        if (date >= inicio && date <= fim) next.add(d)
      })
      return next
    })
    setPeriodoInicio('')
    setPeriodoFim('')
  }

  function limparExcluidas() {
    setExcluidas(new Set())
  }

  async function handleDeletePeriod() {
    if (!employeeId) { setDeleteMsg('Selecione um funcionário primeiro.'); return }
    if (!deleteInicio || !deleteFim) { setDeleteMsg('Informe o período completo.'); return }
    if (!confirm(`Apagar todos os turnos de ${deleteInicio} até ${deleteFim}? Esta ação não pode ser desfeita.`)) return

    setDeleteLoading(true)
    setDeleteMsg('')
    const result = await deleteSchedulePeriodAction(companyId, employeeId, deleteInicio, deleteFim)
    setDeleteLoading(false)

    if ('error' in result) {
      setDeleteMsg(result.error ?? 'Erro ao apagar registros.')
    } else {
      setDeleteMsg(`${result.count} turno(s) apagado(s) com sucesso.`)
      setDeleteInicio('')
      setDeleteFim('')
      router.refresh()
    }
  }

  function formatChip(data: string) {
    const [, , d] = data.split('-')
    return `${d}/${pad(mes)}`
  }

  function diaSemanaChip(data: string) {
    const [y, m, d] = data.split('-').map(Number)
    return DIAS[new Date(y, m - 1, d).getDay()].label
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (incluidas.length === 0) { setError('Nenhuma data incluída após aplicar as folgas.'); return }
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('employee_id', employeeId)
    fd.set('mes_ano', `${ano}-${pad(mes)}`)
    fd.set('dias_semana', JSON.stringify(diasSemana))
    fd.set('datas_excluidas', JSON.stringify([...excluidas]))
    fd.set('turno', turno)
    fd.set('hora_inicio', horaInicio)
    fd.set('hora_fim', horaFim)
    fd.set('meses_replicar', String(mesesReplicar))

    const result = await createMonthlyScheduleAction(companyId, fd)
    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro ao gerar escala.'); return }
    router.refresh()
    onClose()
  }

  const labelStyle = { color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 500, marginBottom: 4, display: 'block' }

  return (
    <Modal open={open} onClose={onClose} title={`Escala do Mês — ${MESES[mes - 1]} ${ano}`}>
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Funcionário */}
        <div>
          <label style={labelStyle}>Funcionário *</label>
          <select
            value={employeeId}
            onChange={e => setEmployeeId(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
          >
            <option value="">Selecionar funcionário...</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>{e.nome}{e.cargo ? ` — ${e.cargo}` : ''}</option>
            ))}
          </select>
        </div>

        {/* Dias da semana */}
        <div>
          <label style={labelStyle}>Dias da semana que trabalha *</label>
          <div className="grid grid-cols-7 gap-1">
            {DIAS.map(({ idx, label }) => {
              const active = diasSemana.includes(idx)
              const isWeekend = idx === 0 || idx === 6
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleDia(idx)}
                  className="py-2 rounded-lg text-xs font-semibold border transition-all"
                  style={{
                    backgroundColor: active ? 'var(--color-primary)' : 'white',
                    borderColor: active ? 'var(--color-primary-dark)' : 'var(--color-bg-surface)',
                    color: active ? 'var(--color-primary-darker)' : isWeekend ? '#C0392B' : 'var(--color-text-secondary)',
                    opacity: active ? 1 : 0.7,
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <div className="flex gap-2 mt-2">
            {[
              { label: 'Seg–Sex', val: [1,2,3,4,5] },
              { label: 'Seg–Sáb', val: [1,2,3,4,5,6] },
              { label: 'Todos',   val: [0,1,2,3,4,5,6] },
            ].map(({ label, val }) => (
              <button key={label} type="button" onClick={() => setDiasSemana(val)}
                className="text-xs px-2 py-1 rounded border transition-colors hover:bg-gray-50"
                style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-muted)' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Turno */}
        <div>
          <label style={labelStyle}>Turno</label>
          <div className="grid grid-cols-4 gap-2">
            {TURNOS_PRESET.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => applyPreset(t.value)}
                className="py-2 rounded-lg text-xs font-medium border transition-colors"
                style={{
                  backgroundColor: turno === t.value ? 'var(--color-primary)' : 'white',
                  borderColor: turno === t.value ? 'var(--color-primary-dark)' : 'var(--color-bg-surface)',
                  color: turno === t.value ? 'var(--color-primary-darker)' : 'var(--color-text-secondary)',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Horário */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>Hora início</label>
            <Input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Hora fim</label>
            <Input type="time" value={horaFim} onChange={e => setHoraFim(e.target.value)} />
          </div>
        </div>

        {/* Preview interativo */}
        {todasDatas.length > 0 && (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-bg-surface)' }}>
            {/* Header do preview */}
            <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
              <div className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                DIAS DO MÊS — clique para marcar como folga
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span style={{ color: 'var(--color-primary-darker)' }}>
                  ✓ {incluidas.length} turnos
                </span>
                {folgas.length > 0 && (
                  <span style={{ color: '#C0392B' }}>
                    ✕ {folgas.length} folgas
                  </span>
                )}
                {folgas.length > 0 && (
                  <button type="button" onClick={limparExcluidas}
                    className="text-xs underline" style={{ color: 'var(--color-text-muted)' }}>
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {/* Grid de chips */}
            <div className="p-3 flex flex-wrap gap-1.5">
              {todasDatas.map(data => {
                const isExcluida = excluidas.has(data)
                return (
                  <button
                    key={data}
                    type="button"
                    onClick={() => toggleExcluida(data)}
                    title={isExcluida ? 'Clique para incluir' : 'Clique para marcar como folga'}
                    className="px-2 py-1.5 rounded font-medium transition-all flex flex-col items-center leading-tight"
                    style={{
                      backgroundColor: isExcluida ? '#FDEDEC' : 'var(--color-primary)',
                      color: isExcluida ? '#C0392B' : 'var(--color-primary-darker)',
                      textDecoration: isExcluida ? 'line-through' : 'none',
                      opacity: isExcluida ? 0.75 : 1,
                      minWidth: '2.75rem',
                    }}
                  >
                    <span style={{ fontSize: '0.625rem', opacity: 0.75 }}>{diaSemanaChip(data)}</span>
                    <span style={{ fontSize: '0.7rem' }}>{formatChip(data)}</span>
                  </button>
                )
              })}
            </div>

            {/* Atalho: excluir período */}
            <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                FOLGAS NA GERAÇÃO (exclui dias do lote acima)
              </p>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label style={{ ...labelStyle, marginBottom: 2 }}>De</label>
                  <Input type="date" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)}
                    min={`${ano}-${pad(mes)}-01`}
                    max={`${ano}-${pad(mes)}-${new Date(ano, mes, 0).getDate()}`}
                  />
                </div>
                <div className="flex-1">
                  <label style={{ ...labelStyle, marginBottom: 2 }}>Até</label>
                  <Input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)}
                    min={periodoInicio || `${ano}-${pad(mes)}-01`}
                    max={`${ano}-${pad(mes)}-${new Date(ano, mes, 0).getDate()}`}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={aplicarPeriodo}
                  disabled={!periodoInicio || !periodoFim}
                >
                  Excluir
                </Button>
              </div>
            </div>
          </div>
        )}

        {todasDatas.length === 0 && (
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Selecione ao menos um dia da semana para ver o preview.
            </p>
          </div>
        )}

        {/* Replicar por N meses */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-bg-surface)' }}>
          <div className="px-4 py-3" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>REPLICAR ESCALA POR</p>
          </div>
          <div className="px-4 py-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Este mês', val: 1 },
                { label: '3 meses',  val: 3 },
                { label: '6 meses',  val: 6 },
                { label: '1 ano',    val: 12 },
                { label: '2 anos',   val: 24 },
              ].map(({ label, val }) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setMesesReplicar(val)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                  style={{
                    backgroundColor: mesesReplicar === val ? 'var(--color-primary)' : 'white',
                    borderColor: mesesReplicar === val ? 'var(--color-primary-dark)' : 'var(--color-bg-surface)',
                    color: mesesReplicar === val ? 'var(--color-primary-darker)' : 'var(--color-text-secondary)',
                  }}
                >
                  {label}
                </button>
              ))}
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={mesesReplicar}
                  onChange={e => setMesesReplicar(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
                  className="w-14 px-2 py-1.5 rounded-lg border text-xs text-center"
                  style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                />
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>meses</span>
              </div>
            </div>
            {mesesReplicar > 1 && (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                As folgas específicas se aplicam apenas ao 1º mês. Os seguintes usarão apenas o padrão de dias da semana.
              </p>
            )}
          </div>
        </div>

        {/* Apagar registros existentes */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#FADBD8' }}>
          <div className="px-4 py-3" style={{ backgroundColor: '#FDEDEC' }}>
            <p className="text-xs font-semibold" style={{ color: '#C0392B' }}>APAGAR REGISTROS EXISTENTES</p>
            <p className="text-xs mt-0.5" style={{ color: '#E74C3C' }}>
              Remove turnos já cadastrados no banco para o funcionário selecionado.
            </p>
          </div>
          <div className="px-4 py-3 space-y-3">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label style={{ ...labelStyle, marginBottom: 2 }}>De</label>
                <Input type="date" value={deleteInicio} onChange={e => { setDeleteInicio(e.target.value); setDeleteMsg('') }} />
              </div>
              <div className="flex-1">
                <label style={{ ...labelStyle, marginBottom: 2 }}>Até</label>
                <Input type="date" value={deleteFim} onChange={e => { setDeleteFim(e.target.value); setDeleteMsg('') }}
                  min={deleteInicio || undefined}
                />
              </div>
              <Button
                type="button"
                variant="danger"
                loading={deleteLoading}
                disabled={!employeeId || !deleteInicio || !deleteFim}
                onClick={handleDeletePeriod}
              >
                Apagar
              </Button>
            </div>
            {!employeeId && (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Selecione um funcionário para habilitar.</p>
            )}
            {deleteMsg && (
              <p className="text-xs p-2 rounded" style={{
                backgroundColor: deleteMsg.includes('sucesso') ? '#EAFAF1' : '#FDEDEC',
                color: deleteMsg.includes('sucesso') ? '#1E8449' : '#C0392B',
              }}>{deleteMsg}</p>
            )}
          </div>
        </div>

        {error && (
          <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading} disabled={incluidas.length === 0}>
            {incluidas.length > 0
              ? mesesReplicar > 1
                ? `Gerar ${totalTurnos} turnos (${mesesReplicar} meses)`
                : `Gerar ${incluidas.length} turnos`
              : 'Selecione os dias'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
