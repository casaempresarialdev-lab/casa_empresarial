'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { SummaryCard } from '@/components/modules/dashboard/summary-card'
import { AddButton } from '@/components/ui/add-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FilterResult, FilterSelect, SearchField } from '@/components/ui/filter-select'
import type { IconName } from '@/components/ui/icon'
import { ListEmpty, ListItem } from '@/components/ui/list-item'
import { toast } from '@/lib/toast'
import { ModalSeguranca } from './modal-seguranca'
import { deleteHealthSafetyAction } from '../actions'
import type { HealthSafetyRecord, EmployeeForSS } from '../queries'

const TIPOS: Record<HealthSafetyRecord['tipo'], { label: string; icon: IconName }> = {
  aso: { label: 'ASO', icon: 'stethoscope' },
  treinamento: { label: 'Treinamento', icon: 'star' },
  epi: { label: 'EPI', icon: 'shield' },
  incidente: { label: 'Incidente', icon: 'info' },
  vacina: { label: 'Vacinação', icon: 'check' },
}

const RESULTADO: Record<string, string> = { apto: 'Apto', apto_com_restricoes: 'Apto com restrições', inapto: 'Inapto' }

const FILTRO_TIPO = [{ value: 'todos', label: 'Todos os tipos' }, ...Object.entries(TIPOS).map(([value, t]) => ({ value, label: t.label }))]
const FILTRO_SITUACAO = [
  { value: 'todas', label: 'Todas as situações' },
  { value: 'vencidos', label: 'Vencidos' },
  { value: 'vencendo', label: 'Vencendo em 30 dias' },
  { value: 'em_dia', label: 'Em dia' },
]

const VENCENDO_DIAS = 30
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
const fmt = (d: string | null) => (d ? d.split('-').reverse().join('/') : null)
const hojeBrasil = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const diasAte = (de: string, ate: string) => Math.round((Date.parse(ate) - Date.parse(de)) / 86400000)

type Situacao = 'vencido' | 'vencendo' | 'em_dia' | 'sem_validade'

function situacao(r: HealthSafetyRecord, hoje: string): Situacao {
  if (!r.data_vencimento) return 'sem_validade'
  const dias = diasAte(hoje, r.data_vencimento)
  return dias < 0 ? 'vencido' : dias <= VENCENDO_DIAS ? 'vencendo' : 'em_dia'
}

function SeloValidade({ r, hoje }: { r: HealthSafetyRecord; hoje: string }) {
  const s = situacao(r, hoje)
  if (s === 'sem_validade') return null
  const dias = diasAte(hoje, r.data_vencimento!)
  const [texto, fundo, cor] = s === 'vencido'
    ? ['Vencido', '#FEE2E2', '#B91C1C']
    : s === 'vencendo'
      ? [dias === 0 ? 'Vence hoje' : `Vence em ${plural(dias, 'dia', 'dias')}`, '#FEF3C7', '#B45309']
      : [`Válido até ${fmt(r.data_vencimento)}`, '#DCFCE7', '#15803D']
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={{ backgroundColor: fundo, color: cor }}>{texto}</span>
}

// Segurança e saúde do trabalho: ASOs, treinamentos, EPIs, incidentes e vacinas, com o controle de validade
export function SegurancaClient({ records, employees, companyId }: { records: HealthSafetyRecord[]; employees: EmployeeForSS[]; companyId: string }) {
  const router = useRouter()
  const hoje = hojeBrasil()
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<HealthSafetyRecord | null>(null)
  const [excluir, setExcluir] = useState<HealthSafetyRecord | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [tipo, setTipo] = useState('todos')
  const [sit, setSit] = useState('todas')
  const [busca, setBusca] = useState('')

  const vencidos = records.filter((r) => situacao(r, hoje) === 'vencido').length
  const vencendo = records.filter((r) => situacao(r, hoje) === 'vencendo').length
  const ano = hoje.slice(0, 4)
  const incidentesAno = records.filter((r) => r.tipo === 'incidente' && r.data?.startsWith(ano)).length

  const q = busca.trim().toLowerCase()
  const visiveis = records
    .filter((r) => tipo === 'todos' || r.tipo === tipo)
    .filter((r) => {
      if (sit === 'todas') return true
      const s = situacao(r, hoje)
      return sit === 'vencidos' ? s === 'vencido' : sit === 'vencendo' ? s === 'vencendo' : s === 'em_dia'
    })
    .filter((r) => !q || r.titulo.toLowerCase().includes(q) || (r.employee?.nome ?? '').toLowerCase().includes(q))

  function abrirNovo() { setEditando(null); setModalOpen(true) }
  function abrirEdicao(r: HealthSafetyRecord) { setEditando(r); setModalOpen(true) }

  async function confirmarExclusao() {
    if (!excluir) return
    setExcluindo(true)
    try {
      await toast.promise(deleteHealthSafetyAction(excluir.id), { loading: 'Excluindo…', success: 'Registro excluído.', error: 'Não foi possível excluir.' })
      router.refresh()
    } catch {
      // A mensagem de erro já apareceu
    }
    setExcluindo(false)
    setExcluir(null)
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Segurança e Saúde</h1>
        <Breadcrumb />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <SummaryCard icon="shield" title="Registros" value={records.length} caption={plural(records.filter((r) => r.tipo === 'aso').length, 'ASO', 'ASOs')} />
        <SummaryCard icon="alarm" title="Vencidos" value={vencidos} caption="renovar o quanto antes" accent={vencidos ? 'red' : undefined} delay={60} />
        <SummaryCard icon="calendar" title="Vencendo em 30 dias" value={vencendo} caption="programar a renovação" accent={vencendo ? 'yellow' : undefined} delay={120} />
        <SummaryCard icon="info" title={`Incidentes em ${ano}`} value={incidentesAno} caption="registrados no ano" accent={incidentesAno ? 'yellow' : undefined} delay={180} />
      </div>

      <div className="app-card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold" style={{ color: 'var(--color-sidebar-text)' }}>
            {records.length === 0 ? 'Nenhum registro ainda' : plural(records.length, 'registro', 'registros')}
          </p>
          <AddButton onClick={abrirNovo} label="Novo registro" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect value={tipo} onChange={setTipo} label="Filtrar por tipo" options={FILTRO_TIPO} />
          <FilterSelect value={sit} onChange={setSit} label="Filtrar por situação" options={FILTRO_SITUACAO} />
          <SearchField value={busca} onChange={setBusca} placeholder="Pesquisar por título ou funcionário..." />
          {(tipo !== 'todos' || sit !== 'todas' || busca) && <FilterResult total={visiveis.length} onClear={() => { setTipo('todos'); setSit('todas'); setBusca('') }} />}
        </div>

        <ul className="flex flex-col gap-3">
          {visiveis.length === 0 && (
            <ListEmpty>{records.length === 0 ? 'Registre os ASOs, treinamentos, EPIs, incidentes e vacinas da equipe para acompanhar as validades.' : 'Nenhum registro encontrado.'}</ListEmpty>
          )}
          {visiveis.map((r) => {
            const t = TIPOS[r.tipo] ?? { label: r.tipo, icon: 'file' as IconName }
            return (
              <ListItem
                key={r.id}
                icon={t.icon}
                title={r.titulo}
                subtitle={[t.label, r.employee?.nome ?? 'Empresa', fmt(r.data), r.resultado ? RESULTADO[r.resultado] ?? r.resultado : null, r.observacao].filter(Boolean).join(' · ')}
                aside={<SeloValidade r={r} hoje={hoje} />}
                onClick={() => abrirEdicao(r)}
                actionsLabel={r.titulo}
                actions={[
                  { icon: 'pencil', label: 'Editar', onClick: () => abrirEdicao(r) },
                  { icon: 'trash', label: 'Excluir', tone: 'danger', onClick: () => setExcluir(r) },
                ]}
              />
            )
          })}
        </ul>
      </div>

      <ModalSeguranca open={modalOpen} onClose={() => setModalOpen(false)} companyId={companyId} record={editando} employees={employees} />

      <ConfirmDialog
        open={!!excluir}
        onClose={() => { if (!excluindo) setExcluir(null) }}
        onConfirm={confirmarExclusao}
        loading={excluindo}
        title="Excluir registro"
        message={<p>Excluir <strong>{excluir?.titulo}</strong>{excluir?.employee ? ` de ${excluir.employee.nome}` : ''}?</p>}
      />
    </>
  )
}
