'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { AddButton } from '@/components/ui/add-button'
import { StatusBadge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FilterResult, FilterSelect, SearchField } from '@/components/ui/filter-select'
import { Tabs } from '@/components/ui/form-steps'
import { ListEmpty, ListItem } from '@/components/ui/list-item'
import { toast } from '@/lib/toast'
import { custoEmpresaMensal, descontoMensal, descricaoDesconto, valorMensal, DIAS_UTEIS_MES } from '@/lib/beneficios-calculo'
import { iniciais } from '../../funcionarios/components/ficha/ficha-config'
import { deleteBenefitAction } from '../actions'
import { ModalBeneficio } from './modal-beneficio'
import type { CompanyBenefit, EmployeeWithBenefits } from '../queries'

interface Props {
  companyId: string
  benefits: CompanyBenefit[]
  employees: EmployeeWithBenefits[]
  photoUrls: Record<string, string>
}

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** Oferecido, descontado e custo da empresa de uma pessoa, por mês */
function totaisDe(emp: EmployeeWithBenefits, benefits: CompanyBenefit[]) {
  return emp.employee_benefits.reduce((t, eb) => {
    const b = benefits.find((x) => x.id === eb.benefit_id)
    if (!b) return t
    return {
      oferecido: t.oferecido + valorMensal(b, eb.valor_override),
      descontado: t.descontado + descontoMensal(b, eb.valor_override, emp.salario),
      custo: t.custo + custoEmpresaMensal(b, eb.valor_override, emp.salario),
    }
  }, { oferecido: 0, descontado: 0, custo: 0 })
}

function Selo({ children }: { children: React.ReactNode }) {
  return (
    <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
      {children}
    </span>
  )
}

function Avatar({ src, nome }: { src?: string; nome: string }) {
  return (
    <span className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center shrink-0 text-sm font-bold" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt={nome} className="w-full h-full object-cover" /> : iniciais(nome)}
    </span>
  )
}

// Benefícios: o que cada funcionário recebe e o catálogo da empresa. Ações dentro da caixa, como nas demais telas.
export function BeneficiosClient({ companyId, benefits, employees, photoUrls }: Props) {
  const router = useRouter()
  const [aba, setAba] = useState(0)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CompanyBenefit | null>(null)
  const [excluir, setExcluir] = useState<CompanyBenefit | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  // Filtros de cada aba
  const [beneficioFiltro, setBeneficioFiltro] = useState('todos')
  const [buscaFuncionario, setBuscaFuncionario] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('todos')
  const [buscaCatalogo, setBuscaCatalogo] = useState('')

  const ativos = benefits.filter((b) => b.ativo)
  const geral = employees.reduce((t, e) => {
    const p = totaisDe(e, ativos)
    return { custo: t.custo + p.custo, descontado: t.descontado + p.descontado }
  }, { custo: 0, descontado: 0 })

  const qFuncionario = buscaFuncionario.toLowerCase()
  const funcionariosVisiveis = employees
    .filter((e) => beneficioFiltro === 'todos' || e.employee_benefits.some((b) => b.benefit_id === beneficioFiltro))
    .filter((e) => !qFuncionario || e.nome.toLowerCase().includes(qFuncionario) || (e.cargo ?? '').toLowerCase().includes(qFuncionario))

  const qCatalogo = buscaCatalogo.toLowerCase()
  const catalogoVisivel = benefits
    .filter((b) => statusFiltro === 'todos' || b.ativo === (statusFiltro === 'ativos'))
    .filter((b) => !qCatalogo || b.nome.toLowerCase().includes(qCatalogo))

  const abrirNovo = () => { setEditing(null); setModalOpen(true) }
  const abrirEdicao = (b: CompanyBenefit) => { setEditing(b); setModalOpen(true) }

  async function confirmarExclusao() {
    const b = excluir
    if (!b) return
    setExcluindo(true)
    const r = await toast.promise(deleteBenefitAction(b.id), {
      loading: `Excluindo ${b.nome}…`,
      success: `Benefício ${b.nome} excluído.`,
      error: 'Não foi possível excluir o benefício.',
    })
    setExcluindo(false)
    setExcluir(null)
    if (!('error' in r)) router.refresh()
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Benefícios</h1>
        <Breadcrumb />
      </div>

      <Tabs labels={['Por funcionário', 'Catálogo']} step={aba} onSelect={setAba} />

      {/* Por funcionário */}
      <div className={aba === 0 ? 'app-card p-5 flex flex-col gap-4' : 'hidden'}>
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            {moeda(geral.custo)} <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>por mês de custo da empresa</span>
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {moeda(geral.descontado)} descontados dos colaboradores · {plural(employees.length, 'funcionário ativo', 'funcionários ativos')} · benefícios por dia com {DIAS_UTEIS_MES} dias úteis
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            value={beneficioFiltro}
            onChange={setBeneficioFiltro}
            label="Filtrar por benefício"
            options={[{ value: 'todos', label: 'Todos os benefícios' }, ...ativos.map((b) => ({ value: b.id, label: b.nome }))]}
          />
          <SearchField value={buscaFuncionario} onChange={setBuscaFuncionario} placeholder="Pesquisar por nome ou cargo..." />
          {(beneficioFiltro !== 'todos' || buscaFuncionario) && (
            <FilterResult total={funcionariosVisiveis.length} onClear={() => { setBeneficioFiltro('todos'); setBuscaFuncionario('') }} />
          )}
        </div>

        <ul className="flex flex-col gap-3">
          {ativos.length === 0
            ? <ListEmpty>Cadastre benefícios na aba Catálogo para vê-los aqui.</ListEmpty>
            : funcionariosVisiveis.length === 0 && <ListEmpty>{employees.length === 0 ? 'Nenhum funcionário ativo.' : 'Nenhum funcionário encontrado.'}</ListEmpty>}
          {ativos.length > 0 && funcionariosVisiveis.map((e) => {
            const nomes = ativos.filter((b) => e.employee_benefits.some((x) => x.benefit_id === b.id)).map((b) => b.nome)
            const totais = totaisDe(e, ativos)
            return (
              <ListItem
                key={e.id}
                media={<Avatar src={photoUrls[e.id]} nome={e.nome} />}
                title={e.nome}
                subtitle={[e.cargo, nomes.length ? nomes.join(', ') : 'Sem benefícios'].filter(Boolean).join(' · ')}
                aside={
                  <span className="flex flex-col items-end">
                    <span className="text-sm font-semibold whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{moeda(totais.oferecido)}</span>
                    {totais.descontado > 0 && <span className="text-xs whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>desconta {moeda(totais.descontado)}</span>}
                  </span>
                }
                onClick={() => router.push(`/pessoas/funcionarios/${e.id}?aba=beneficios`)}
                actionsLabel={e.nome}
                actions={[{ icon: 'eye', label: 'Ver benefícios na ficha', onClick: () => router.push(`/pessoas/funcionarios/${e.id}?aba=beneficios`) }]}
              />
            )
          })}
        </ul>
      </div>

      {/* Catálogo */}
      <div className={aba === 1 ? 'app-card p-5 flex flex-col gap-4' : 'hidden'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm" style={{ color: 'var(--color-sidebar-text)' }}>
            <span className="font-semibold">{plural(ativos.length, 'benefício ativo', 'benefícios ativos')}</span>
            {benefits.length > ativos.length && <span style={{ color: 'var(--color-text-muted)' }}> · {plural(benefits.length - ativos.length, 'inativo', 'inativos')}</span>}
          </p>
          <AddButton onClick={abrirNovo} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            value={statusFiltro}
            onChange={setStatusFiltro}
            label="Filtrar por status"
            options={[{ value: 'todos', label: 'Todos os status' }, { value: 'ativos', label: 'Ativos' }, { value: 'inativos', label: 'Inativos' }]}
          />
          <SearchField value={buscaCatalogo} onChange={setBuscaCatalogo} placeholder="Pesquisar benefício..." />
          {(statusFiltro !== 'todos' || buscaCatalogo) && (
            <FilterResult total={catalogoVisivel.length} onClear={() => { setStatusFiltro('todos'); setBuscaCatalogo('') }} />
          )}
        </div>

        <ul className="flex flex-col gap-3">
          {catalogoVisivel.length === 0 && <ListEmpty>{benefits.length === 0 ? 'Nenhum benefício cadastrado.' : 'Nenhum benefício encontrado.'}</ListEmpty>}
          {catalogoVisivel.map((b) => (
            <div key={b.id} style={{ opacity: b.ativo ? 1 : 0.55 }}>
              <ListItem
                icon="wallet"
                title={b.nome}
                subtitle={`${moeda(b.valor)}${b.por_dia_trabalhado ? ' por dia' : ' por mês'} · ${descricaoDesconto(b)}`}
                aside={
                  <>
                    <Selo>{b.por_dia_trabalhado ? 'Por dia' : 'Mensal fixo'}</Selo>
                    <StatusBadge status={b.ativo ? 'active' : 'inactive'} />
                  </>
                }
                onClick={() => abrirEdicao(b)}
                actionsLabel={b.nome}
                actions={[
                  { icon: 'pencil', label: 'Editar', onClick: () => abrirEdicao(b) },
                  { icon: 'trash', label: 'Excluir', tone: 'danger', onClick: () => setExcluir(b) },
                ]}
              />
            </div>
          ))}
        </ul>
      </div>

      <ModalBeneficio open={modalOpen} onClose={() => setModalOpen(false)} companyId={companyId} benefit={editing} />

      <ConfirmDialog
        open={!!excluir}
        onClose={() => { if (!excluindo) setExcluir(null) }}
        onConfirm={confirmarExclusao}
        loading={excluindo}
        title="Excluir benefício"
        message={<p>Excluir <strong>{excluir?.nome}</strong>? Os vínculos com funcionários também são removidos.</p>}
      />
    </>
  )
}
