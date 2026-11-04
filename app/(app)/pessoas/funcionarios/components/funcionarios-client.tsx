'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ListItem, ListEmpty } from '@/components/ui/list-item'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { AddButton } from '@/components/ui/add-button'
import { MultiSelectFilter, type MultiSelectOption } from '@/components/ui/multi-select-filter'
import { FilterResult, FilterSelect, SearchField } from '@/components/ui/filter-select'
import { toast } from '@/lib/toast'
import { deleteEmployeeAction } from '../actions'
import { ETAPA_FINAL } from '../../admissao/etapas'
import type { Employee } from '../queries'
import { Breadcrumb } from '@/components/layout/breadcrumb'
// Mesmo critério da Documentação: "vencendo" = até 30 dias
const VENCENDO_DIAS = 30

const ATIVOS_STATUS = ['admissao', 'experiencia', 'ativo', 'ferias', 'afastado']
const INATIVOS_STATUS = ['inativo', 'demitido']

const TIPO_LABEL: Record<string, string> = {
  clt: 'CLT',
  pj: 'PJ',
  estagio: 'Estágio',
  menor_aprendiz: 'Menor Aprendiz',
  autonomo: 'Autônomo',
}

const TIPO_FILTER_OPTIONS = [
  { value: 'todos', label: 'Todos os contratos' },
  { value: 'clt', label: 'CLT' },
  { value: 'estagio', label: 'Estágio' },
  { value: 'menor_aprendiz', label: 'Menor Aprendiz' },
  { value: 'pj', label: 'PJ' },
  { value: 'autonomo', label: 'Autônomo' },
]

// Faixas salariais (salário ou valor do serviço)
const FAIXA_OPTIONS: { value: string; label: string; min: number; max: number }[] = [
  { value: 'todas', label: 'Todas as faixas', min: -Infinity, max: Infinity },
  { value: 'ate2', label: 'Até R$ 2.000', min: 0, max: 2000 },
  { value: '2a4', label: 'R$ 2.000 a R$ 4.000', min: 2000.01, max: 4000 },
  { value: '4a8', label: 'R$ 4.000 a R$ 8.000', min: 4000.01, max: 8000 },
  { value: 'acima8', label: 'Acima de R$ 8.000', min: 8000.01, max: Infinity },
  { value: 'sem', label: 'Sem salário informado', min: NaN, max: NaN },
]

const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  admissao:    { label: 'Admissão',    bg: '#DBEAFE', color: '#1D4ED8' },
  experiencia: { label: 'Experiência', bg: '#FEF3C7', color: '#B45309' },
  ativo:       { label: 'Ativo',       bg: '#DCFCE7', color: '#15803D' },
  ferias:      { label: 'Férias',      bg: '#E0F2FE', color: '#0369A1' },
  afastado:    { label: 'Afastado',    bg: '#F3E8FF', color: '#7E22CE' },
  inativo:     { label: 'Inativo',     bg: '#F3F4F6', color: '#6B7280' },
  demitido:    { label: 'Demitido',    bg: '#FEE2E2', color: '#B91C1C' },
}

const CONTRATO_PENDENTE: Record<string, string> = {
  nao_tem: 'Sem contrato',
  nao_assinado: 'Contrato não assinado',
}

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Selo de férias: vencidas / vencendo em até 30 dias
function feriasStatus(vcto: string | null, today: string) {
  if (!vcto) return null
  const dias = Math.round((Date.parse(vcto.split('T')[0]) - Date.parse(today)) / 86400000)
  if (dias < 0) return { label: 'Férias vencidas', bg: '#FEE2E2', color: '#B91C1C' }
  if (dias <= VENCENDO_DIAS) return { label: dias === 0 ? 'Férias vencem hoje' : `Férias vencem em ${dias} ${dias === 1 ? 'dia' : 'dias'}`, bg: '#FEF3C7', color: '#B45309' }
  return null
}

function diasAte(iso: string, today: string) {
  return Math.round((Date.parse(iso.split('T')[0]) - Date.parse(today)) / 86400000)
}

// Próximo fim de período de experiência (1º, prorrogação ou data final), de hoje em diante
function proximoFimExperiencia(e: Employee, today: string) {
  const datas = [e.fim_experiencia_1, e.fim_experiencia_2, e.data_experiencia_fim]
    .filter((d): d is string => !!d && diasAte(d, today) >= 0)
    .sort()
  return datas[0] ?? null
}

function formatMoney(v: number | null) {
  return v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : null
}

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ backgroundColor: bg, color }}>
      {label}
    </span>
  )
}

// Foto (ou iniciais) do funcionário, no lugar do ícone do cartão
function Avatar({ src, nome }: { src?: string; nome: string }) {
  return (
    <span
      className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center shrink-0 text-xs font-bold"
      style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={nome} className="w-full h-full object-cover" />
      ) : (
        nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
      )}
    </span>
  )
}

interface Props {
  employees: Employee[]
  photoUrls: Record<string, string>
}

export function FuncionariosClient({ employees, photoUrls }: Props) {
  const router = useRouter()
  const [tipoFiltro, setTipoFiltro] = useState('todos')
  // Status marcados (vazio = todos); padrão: todos os status ativos
  const [statusFiltro, setStatusFiltro] = useState<string[]>(ATIVOS_STATUS)
  const [faixaFiltro, setFaixaFiltro] = useState('todas')
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<Employee | null>(null)

  const today = todayIso()

  // Ativos: já passaram pela última etapa da admissão
  const ativos = employees.filter((e) => ATIVOS_STATUS.includes(e.status) && e.admission_stage === ETAPA_FINAL)
  const inativos = employees.filter((e) => INATIVOS_STATUS.includes(e.status))

  const q = search.toLowerCase()
  const faixa = FAIXA_OPTIONS.find((f) => f.value === faixaFiltro) ?? FAIXA_OPTIONS[0]
  const noFaixa = (e: Employee) => {
    const v = e.salario ?? e.valor_servico
    if (faixa.value === 'todas') return true
    if (faixa.value === 'sem') return v == null
    return v != null && v >= faixa.min && v <= faixa.max
  }
  const mesmos = (a: string[], b: string[]) => a.length === b.length && a.every((v) => b.includes(v))
  const statusPadrao = mesmos(statusFiltro, ATIVOS_STATUS)
  const filtrosAtivos = [search, tipoFiltro !== 'todos', !statusPadrao, faixaFiltro !== 'todas'].filter(Boolean).length
  function limparFiltros() {
    setSearch('')
    setTipoFiltro('todos')
    setStatusFiltro(ATIVOS_STATUS)
    setFaixaFiltro('todas')
  }

  // Resumo do título/subtítulo (sempre sobre os ativos, sem os filtros da lista)
  const porTipo = Object.entries(
    ativos.reduce<Record<string, number>>((acc, e) => {
      const t = e.tipo_contrato ? TIPO_LABEL[e.tipo_contrato] : 'Sem tipo'
      acc[t] = (acc[t] ?? 0) + 1
      return acc
    }, {}),
  ).sort((a, b) => b[1] - a[1])
  const emExperiencia = ativos.filter((e) => e.status === 'experiencia')
  const experienciaTerminando = emExperiencia.filter((e) => {
    const fim = proximoFimExperiencia(e, today)
    return fim && diasAte(fim, today) <= VENCENDO_DIAS
  }).length
  const feriasAlerta = ativos.filter((e) => !!feriasStatus(e.vcto_ferias, today))
  const feriasVencidas = feriasAlerta.filter((e) => diasAte(e.vcto_ferias!, today) < 0).length
  const contratosPendentes = ativos.filter((e) => !!e.status_contrato && !!CONTRATO_PENDENTE[e.status_contrato]).length
  const afastados = ativos.filter((e) => e.status === 'afastado').length
  const deFerias = ativos.filter((e) => e.status === 'ferias').length
  const folhaMensal = ativos.reduce((s, e) => s + (e.salario ?? e.valor_servico ?? 0), 0)

  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

  // Subtítulo: composição da equipe + pendências (em destaque)
  const composicao = [
    porTipo.map(([t, n]) => `${n} ${t}`).join(', '),
    emExperiencia.length > 0 && `${emExperiencia.length} em experiência`,
    deFerias > 0 && `${deFerias} de férias`,
    afastados > 0 && plural(afastados, 'afastado', 'afastados'),
    folhaMensal > 0 && `${formatMoney(folhaMensal)}/mês em salários`,
  ].filter(Boolean) as string[]
  const pendencias = [
    feriasVencidas > 0 && { texto: plural(feriasVencidas, 'férias vencida', 'férias vencidas'), cor: '#B91C1C' },
    feriasAlerta.length - feriasVencidas > 0 && { texto: `${feriasAlerta.length - feriasVencidas} férias vencendo em ${VENCENDO_DIAS} dias`, cor: '#B45309' },
    experienciaTerminando > 0 && { texto: `${plural(experienciaTerminando, 'experiência termina', 'experiências terminam')} em ${VENCENDO_DIAS} dias`, cor: '#B45309' },
    contratosPendentes > 0 && { texto: plural(contratosPendentes, 'contrato pendente', 'contratos pendentes'), cor: '#B45309' },
  ].filter(Boolean) as { texto: string; cor: string }[]

  // Status: caixas agrupadas em Ativos / Inativos, com a contagem de cada um
  const todos = [...ativos, ...inativos]
  const contar = (s: string) => todos.filter((e) => e.status === s).length
  const statusOptions: MultiSelectOption[] = [
    ...ATIVOS_STATUS.map((s) => ({ value: s, label: STATUS_CFG[s].label, count: contar(s), group: 'Ativos' })),
    ...INATIVOS_STATUS.map((s) => ({ value: s, label: STATUS_CFG[s].label, count: contar(s), group: 'Inativos' })),
  ]
  const statusResumo =
    statusFiltro.length === 0 || statusFiltro.length === statusOptions.length ? 'Todos os status'
    : statusPadrao ? 'Ativos'
    : mesmos(statusFiltro, INATIVOS_STATUS) ? 'Inativos'
    : statusFiltro.length === 1 ? STATUS_CFG[statusFiltro[0]].label
    : `${statusFiltro.length} status`

  const rows = todos
    .filter((e) => statusFiltro.length === 0 || statusFiltro.includes(e.status))
    .filter((e) => tipoFiltro === 'todos' || e.tipo_contrato === tipoFiltro)
    .filter(noFaixa)
    .filter((e) => {
      if (!q) return true
      // Pesquisa geral: textos e documentos (CPF/telefone comparados só pelos dígitos)
      const digitos = q.replace(/\D/g, '')
      const textos = [e.nome, e.cargo, e.departamento, e.local_trabalho, e.email, e.matricula, e.servico]
      if (textos.some((t) => (t ?? '').toLowerCase().includes(q))) return true
      return !!digitos && [e.cpf, e.telefone, e.cnpj].some((t) => (t ?? '').replace(/\D/g, '').includes(digitos))
    })

  // Remoção confirmada no modal; o resultado aparece no toast (✓ / ✕)
  async function confirmDelete() {
    const e = confirmTarget
    if (!e) return
    setDeletingId(e.id)
    const result = await toast.promise(deleteEmployeeAction(e.id), {
      loading: `Excluindo ${e.nome}…`,
      success: `${e.nome} foi excluído da equipe.`,
      error: 'Não foi possível excluir o funcionário.',
    })
    setDeletingId(null)
    setConfirmTarget(null)
    if (!('error' in result)) router.refresh()
  }

  return (
    <>
      <div className="mb-6">
        {/* Título e breadcrumb na mesma linha */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
            Funcionários
          </h1>
          <Breadcrumb />
        </div>
      </div>

      <div className="app-card p-5 flex flex-col gap-4">
        {/* Título e subtítulo: tamanho e composição da equipe + pendências */}
        <div>
          {/* Título + "Nova admissão" alinhado à direita */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
              {ativos.length === 0 ? 'Nenhum funcionário ativo' : plural(ativos.length, 'funcionário ativo', 'funcionários ativos')}
              {inativos.length > 0 && (
                <span className="text-sm font-normal ml-2" style={{ fontFamily: 'Inter', color: 'var(--color-text-muted)' }}>
                  + {plural(inativos.length, 'inativo', 'inativos')}
                </span>
              )}
            </h2>
            <AddButton onClick={() => router.push('/pessoas/admissao/novo')} label="Nova admissão" />
          </div>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {composicao.join(' · ') || 'Nenhum funcionário admitido ainda.'}
            {pendencias.map((p) => (
              <span key={p.texto}>
                {' · '}
                <span className="font-semibold" style={{ color: p.cor }}>{p.texto}</span>
              </span>
            ))}
          </p>
        </div>

        {/* Filtros (status, contrato, faixa salarial) + pesquisa geral */}
        <div className="flex flex-wrap items-center gap-2">
          <MultiSelectFilter
            label="Filtrar por status"
            options={statusOptions}
            value={statusFiltro}
            onChange={setStatusFiltro}
            summary={statusResumo}
            highlighted={!statusPadrao}
          />
          <FilterSelect value={tipoFiltro} onChange={setTipoFiltro} label="Filtrar por tipo de contrato" options={TIPO_FILTER_OPTIONS} />
          <FilterSelect value={faixaFiltro} onChange={setFaixaFiltro} label="Filtrar por faixa salarial" options={FAIXA_OPTIONS} />
          <SearchField value={search} onChange={setSearch} placeholder="Pesquisar por nome, cargo, CPF, telefone, e-mail..." />
          {filtrosAtivos > 0 && <FilterResult total={rows.length} onClear={limparFiltros} />}
        </div>

        <ul className="flex flex-col gap-3">
          {rows.length === 0 && (
            <ListEmpty>
              {filtrosAtivos > 0 ? 'Nenhum funcionário encontrado para esse filtro.' : 'Nenhum funcionário ativo cadastrado.'}
            </ListEmpty>
          )}
          {rows.map((emp) => {
            const status = STATUS_CFG[emp.status]
            const inativo = INATIVOS_STATUS.includes(emp.status)
            const ferias = inativo ? null : feriasStatus(emp.vcto_ferias, today)
            const contratoPendente = emp.status_contrato ? CONTRATO_PENDENTE[emp.status_contrato] : null
            const detalhes = [
              emp.cargo || 'Sem cargo informado',
              emp.departamento,
              emp.tipo_contrato ? TIPO_LABEL[emp.tipo_contrato] : null,
              formatMoney(emp.salario ?? emp.valor_servico),
            ]
            return (
              <div key={emp.id} style={{ opacity: inativo ? 0.7 : 1 }}>
                <ListItem
                  media={<Avatar src={photoUrls[emp.id]} nome={emp.nome} />}
                  title={emp.nome}
                  subtitle={detalhes.filter(Boolean).join(' · ')}
                  onClick={() => router.push(`/pessoas/funcionarios/${emp.id}`)}
                  aside={
                    <>
                      {ferias && <span className="hidden md:inline-flex"><Badge {...ferias} /></span>}
                      {contratoPendente && (
                        <span className="hidden md:inline-flex"><Badge label={contratoPendente} bg="#FEF3C7" color="#B45309" /></span>
                      )}
                      {status && <Badge {...status} />}
                    </>
                  }
                  actionsLabel={emp.nome}
                  actions={[
                    { icon: 'eye', label: 'Visualizar', onClick: () => router.push(`/pessoas/funcionarios/${emp.id}`) },
                    { icon: 'pencil', label: 'Editar', onClick: () => router.push(`/pessoas/funcionarios/${emp.id}/editar`) },
                    { icon: 'trash', label: 'Excluir', tone: 'danger', onClick: () => setConfirmTarget(emp), disabled: deletingId === emp.id },
                  ]}
                />
              </div>
            )
          })}
        </ul>
      </div>

      <ConfirmDialog
        open={!!confirmTarget}
        onClose={() => { if (!deletingId) setConfirmTarget(null) }}
        onConfirm={confirmDelete}
        loading={!!deletingId}
        title="Excluir funcionário"
        message={<p>Excluir <strong>{confirmTarget?.nome}</strong>? Esta ação não pode ser desfeita.</p>}
      />
    </>
  )
}
