'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { ListItem, ListEmpty } from '@/components/ui/list-item'
import { AddButton } from '@/components/ui/add-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FilterResult, FilterSelect, SearchField } from '@/components/ui/filter-select'
import { toast } from '@/lib/toast'
import { alterarStatusVagaAction, encerrarVagaAction } from '../actions'
import type { Vaga } from '../queries'
import { TIPO_OPTIONS, fmtDate, tipoLabel } from '../../funcionarios/components/ficha/ficha-config'
import { Selo, VAGA_STATUS, linkPublico } from './vaga-config'

interface Props {
  vagas: Vaga[]
  companyId: string
  /** Erro ao ler as vagas (ex.: migration ainda não aplicada) */
  erro: string | null
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

const SITUACAO_OPTIONS = [
  { value: 'ativas', label: 'Abertas e pausadas' },
  { value: 'aberta', label: 'Abertas' },
  { value: 'pausada', label: 'Pausadas' },
  { value: 'encerrada', label: 'Encerradas' },
  { value: 'todas', label: 'Todas as situações' },
]
const CONTRATO_OPTIONS = [{ value: 'todos', label: 'Todos os contratos' }, ...TIPO_OPTIONS]

export function VagasClient({ vagas, companyId, erro }: Props) {
  const router = useRouter()
  const [situacao, setSituacao] = useState('ativas')
  const [contrato, setContrato] = useState('todos')
  const [busca, setBusca] = useState('')
  const [encerrar, setEncerrar] = useState<Vaga | null>(null)
  const [processando, setProcessando] = useState(false)

  const abertas = vagas.filter((v) => v.status === 'aberta').length
  const pausadas = vagas.filter((v) => v.status === 'pausada').length
  const novas = vagas.reduce((s, v) => s + v.novas, 0)
  const subtitulo = [
    pausadas ? plural(pausadas, 'pausada', 'pausadas') : null,
    novas ? `${plural(novas, 'candidatura nova', 'candidaturas novas')} para avaliar` : 'Nenhuma candidatura nova para avaliar',
  ].filter(Boolean).join(' · ')

  const filtrando = situacao !== 'ativas' || contrato !== 'todos' || !!busca
  const q = busca.toLowerCase()
  const linhas = vagas
    .filter((v) => (situacao === 'ativas' ? v.status !== 'encerrada' : situacao === 'todas' || v.status === situacao))
    .filter((v) => contrato === 'todos' || v.tipo_contrato === contrato)
    .filter((v) => !q || [v.titulo, v.cargo, v.departamento, v.local_trabalho].some((t) => (t ?? '').toLowerCase().includes(q)))

  async function copiar(v: Vaga) {
    await navigator.clipboard.writeText(linkPublico(v.token))
    toast('Link de candidatura copiado.')
  }

  async function alterarStatus(v: Vaga, status: 'aberta' | 'pausada') {
    const r = await toast.promise(alterarStatusVagaAction(v.id, companyId, status), {
      loading: status === 'aberta' ? 'Reabrindo a vaga…' : 'Pausando a vaga…',
      success: status === 'aberta' ? `${v.titulo}: recebendo candidaturas de novo.` : `${v.titulo}: o link deixou de aceitar candidaturas.`,
      error: 'Não foi possível alterar a vaga.',
    })
    if (!('error' in r)) router.refresh()
  }

  async function confirmarEncerrar() {
    const v = encerrar
    if (!v) return
    setProcessando(true)
    const r = await toast.promise(encerrarVagaAction(v.id, companyId), {
      loading: 'Encerrando a vaga…',
      success: (res) => {
        const enviados = 'enviados' in res ? res.enviados ?? 0 : 0
        return enviados ? `${v.titulo} foi encerrada. ${plural(enviados, 'candidato avisado', 'candidatos avisados')}.` : `${v.titulo} foi encerrada.`
      },
      error: 'Não foi possível encerrar a vaga.',
    })
    setProcessando(false)
    setEncerrar(null)
    if ('error' in r) return
    if (r.falhas) toast.error(`O aviso não foi enviado para ${plural(r.falhas, 'candidato', 'candidatos')}.`)
    router.refresh()
  }

  return (
    <>
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
            Vagas
          </h1>
          <Breadcrumb />
        </div>
      </div>

      <div className="app-card p-5 flex flex-col gap-4">
        {erro ? (
          <p className="text-sm p-4 rounded-lg" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
            As vagas ainda não estão disponíveis: {erro}
          </p>
        ) : (
          <>
            {/* Título e subtítulo + "Nova vaga" à direita */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
                  {abertas === 0 ? 'Nenhuma vaga aberta' : plural(abertas, 'vaga aberta', 'vagas abertas')}
                </h2>
                <AddButton onClick={() => router.push('/pessoas/vagas/nova')} label="Nova vaga" />
              </div>
              <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{subtitulo}</p>
            </div>

            {/* Filtros + pesquisa */}
            <div className="flex flex-wrap items-center gap-2">
              <FilterSelect value={situacao} onChange={setSituacao} label="Filtrar por situação" options={SITUACAO_OPTIONS} />
              <FilterSelect value={contrato} onChange={setContrato} label="Filtrar por forma de contratação" options={CONTRATO_OPTIONS} />
              <SearchField value={busca} onChange={setBusca} placeholder="Pesquisar por título, cargo, departamento ou local..." />
              {filtrando && <FilterResult total={linhas.length} onClear={() => { setSituacao('ativas'); setContrato('todos'); setBusca('') }} />}
            </div>

            <ul className="flex flex-col gap-3">
              {linhas.length === 0 && (
                <ListEmpty>{vagas.length === 0 ? 'Nenhuma vaga criada ainda.' : 'Nenhuma vaga encontrada para esse filtro.'}</ListEmpty>
              )}
              {linhas.map((v) => (
                <div key={v.id} style={{ opacity: v.status === 'encerrada' ? 0.7 : 1 }}>
                <ListItem
                  icon="briefcase"
                  title={v.titulo}
                  subtitle={[
                    tipoLabel(v.tipo_contrato),
                    v.cargo,
                    v.local_trabalho,
                    plural(v.posicoes, 'posição', 'posições'),
                    v.status === 'encerrada' && v.encerrada_em
                      ? `Encerrada em ${fmtDate(v.encerrada_em)}`
                      : v.data_limite ? `Até ${fmtDate(v.data_limite)}` : null,
                  ].filter(Boolean).join(' · ')}
                  onClick={() => router.push(`/pessoas/vagas/${v.id}`)}
                  aside={
                    <>
                      <span className="hidden sm:inline text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        {plural(v.total, 'candidatura', 'candidaturas')}
                      </span>
                      {v.novas > 0 && <Selo cfg={{ label: plural(v.novas, 'nova', 'novas'), bg: '#DBEAFE', color: '#1D4ED8' }} />}
                      <Selo cfg={VAGA_STATUS[v.status]} />
                    </>
                  }
                  actionsLabel={v.titulo}
                  actions={[
                    { icon: 'users', label: 'Ver candidaturas', onClick: () => router.push(`/pessoas/vagas/${v.id}`) },
                    ...(v.status === 'encerrada' ? [] : [
                      { icon: 'share' as const, label: 'Copiar link', onClick: () => copiar(v) },
                      v.status === 'aberta'
                        ? { icon: 'minimize' as const, label: 'Pausar', onClick: () => alterarStatus(v, 'pausada') }
                        : { icon: 'maximize' as const, label: 'Reabrir', onClick: () => alterarStatus(v, 'aberta') },
                      { icon: 'pencil' as const, label: 'Editar', onClick: () => router.push(`/pessoas/vagas/${v.id}?aba=dados`) },
                      { icon: 'lock' as const, label: 'Encerrar', tone: 'danger' as const, onClick: () => setEncerrar(v) },
                    ]),
                  ]}
                />
                </div>
              ))}
            </ul>
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!encerrar}
        onClose={() => { if (!processando) setEncerrar(null) }}
        onConfirm={confirmarEncerrar}
        loading={processando}
        confirmLabel="Encerrar vaga"
        title="Encerrar vaga"
        message={
          <p>
            Encerrar <strong>{encerrar?.titulo}</strong>? O link deixa de aceitar candidaturas e a vaga não poderá ser reaberta. Ela continua disponível no filtro &quot;Encerradas&quot;.
            {encerrar?.novas ? <> {plural(encerrar.novas, 'candidato em avaliação recebe', 'candidatos em avaliação recebem')} um aviso por e-mail.</> : null}
          </p>
        }
      />
    </>
  )
}
