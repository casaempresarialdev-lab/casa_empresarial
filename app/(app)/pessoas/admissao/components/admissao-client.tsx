'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { AddButton } from '@/components/ui/add-button'
import { FilterResult, FilterSelect, SearchField } from '@/components/ui/filter-select'
import { toast } from '@/lib/toast'
import { fmtDataHora } from '@/lib/validations/admissao'
import { moverEtapaAction } from '../actions'
import { ETAPA_CARTA, ETAPA_EXAME, ETAPA_FINAL, ETAPA_INICIAL, ETAPA_RESULTADO_EXAME,
  ETAPA_AGUARDAR_CONTABILIDADE, ETAPA_CONTABILIDADE, ETAPA_CONTRATO, indiceEtapa, type Etapa,
} from '../etapas'
import { iniciais } from '../../funcionarios/components/ficha/ficha-config'
import type { Carta, EmAdmissao, Exame, Historico, OnboardingTokenInfo } from '../queries'

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

function situacaoLink(t: OnboardingTokenInfo | undefined): 'none' | 'pending' | 'done' | 'expired' {
  if (!t) return 'none'
  if (t.used_at) return 'done'
  return new Date(t.expires_at) < new Date() ? 'expired' : 'pending'
}

function Avatar({ src, nome, size }: { src?: string; nome: string; size: number }) {
  return (
    <span
      className="rounded-full overflow-hidden flex items-center justify-center shrink-0 text-xs font-bold"
      style={{ width: size, height: size, backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={nome} className="w-full h-full object-cover" />
      ) : iniciais(nome)}
    </span>
  )
}

// ── Kanban ───────────────────────────────────────────────────────────────────

interface Props {
  employees: EmAdmissao[]
  tokens: Record<string, OnboardingTokenInfo>
  companyId: string
  photoUrls: Record<string, string>
  historicos: Record<string, Historico>
  cartas: Record<string, Carta>
  exames: Record<string, Exame[]>
  /** Etapas da empresa, na ordem (inclui as inativas) */
  etapas: Etapa[]
}

export function AdmissaoClient({ employees, tokens, photoUrls, companyId, historicos, cartas, exames, etapas }: Props) {
  const router = useRouter()
  // Movimento já mostrado na tela enquanto o servidor confirma
  const [movidos, setMovidos] = useState<Record<string, string>>({})
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)
  const [movendo, setMovendo] = useState<string | null>(null)

  const [vagaFiltro, setVagaFiltro] = useState('todas')
  const [busca, setBusca] = useState('')
  const [exibirEspera, setExibirEspera] = useState(false)

  const etapaDe = (e: EmAdmissao): string =>
    movidos[e.id] ?? (e.admission_stage && indiceEtapa(etapas, e.admission_stage) >= 0 ? e.admission_stage : ETAPA_INICIAL)

  // Colunas: as etapas ativas; uma inativa só aparece enquanto ainda tiver alguém nela
  const colunas = etapas.filter((x) => x.ativo || employees.some((e) => etapaDe(e) === x.key))

  const emEspera = employees.filter((e) => e.admissao_em_espera).length
  const vagas = [...new Map(employees.filter((e) => e.vaga).map((e) => [e.vaga!.id, e.vaga!.titulo])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
  const opcoesVaga = [
    { value: 'todas', label: 'Todas as vagas' },
    ...vagas.map(([value, label]) => ({ value, label })),
    { value: 'sem', label: 'Sem vaga' },
  ]

  const filtrando = vagaFiltro !== 'todas' || !!busca
  const q = busca.toLowerCase()
  const visiveis = employees
    .filter((e) => exibirEspera || !e.admissao_em_espera)
    .filter((e) => vagaFiltro === 'todas' || (vagaFiltro === 'sem' ? !e.vaga : e.vaga?.id === vagaFiltro))
    .filter((e) => !q || e.nome.toLowerCase().includes(q) || (e.cargo ?? '').toLowerCase().includes(q) || (e.vaga?.titulo ?? '').toLowerCase().includes(q))

  async function mover(e: EmAdmissao, etapa: string) {
    if (etapaDe(e) === etapa) return
    if (!etapas.find((x) => x.key === etapa)?.ativo) {
      toast.error('Esta etapa está inativa nas configurações.')
      return
    }
    // Para frente (ou saindo da entrevista, que pede a decisão), cada etapa avança pela ação dela:
    // abre a ficha, já com a etapa atual aberta, para registrar a ação
    const avancando = indiceEtapa(etapas, etapa) > indiceEtapa(etapas, etapaDe(e))
    if (avancando || etapaDe(e) === ETAPA_INICIAL) {
      router.push(`/pessoas/admissao/${e.id}`)
      return
    }
    // Para trás, o card muda de etapa direto
    setMovendo(e.id)
    setMovidos((m) => ({ ...m, [e.id]: etapa }))
    const r = await moverEtapaAction(e.id, companyId, etapa)
    setMovendo(null)
    // A resposta já traz a tela atualizada: o movimento provisório pode sair
    setMovidos((m) => { const n = { ...m }; delete n[e.id]; return n })
    if ('error' in r) toast.error(r.error ?? 'Não foi possível mover.')
  }

  const [agora] = useState(() => Date.now())

  return (
    <>
      {/* Ocupa a tela toda na vertical: altura da janela menos o espaçamento da área de conteúdo (ver app/(app)/layout.tsx) */}
      <div className="flex flex-col min-h-[calc(100dvh-5.5rem)] md:min-h-[calc(100dvh-3rem)]">
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
            Admissão
          </h1>
          <Breadcrumb />
        </div>
      </div>

      <div className="app-card p-5 flex flex-col gap-4 flex-1">
        {/* Título e subtítulo + "Nova admissão" à direita */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
              {employees.length === 0 ? 'Nenhuma admissão em andamento' : plural(employees.length, 'admissão em andamento', 'admissões em andamento')}
            </h2>
            <AddButton onClick={() => router.push('/pessoas/admissao/novo')} label="Nova admissão" />
          </div>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {employees.length === 0
              ? 'Inicie uma admissão a partir das candidaturas de uma vaga, ou diretamente em "Nova admissão".'
              : emEspera ? plural(emEspera, 'em espera', 'em espera') : 'Ninguém em espera'}
          </p>
        </div>

        {/* Filtros + pesquisa */}
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect value={vagaFiltro} onChange={setVagaFiltro} label="Filtrar por vaga" options={opcoesVaga} />
          <label className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border text-sm cursor-pointer select-none" style={{ borderColor: exibirEspera ? 'var(--color-brand)' : 'var(--color-card-border)', backgroundColor: exibirEspera ? 'var(--color-brand-light)' : 'white', color: exibirEspera ? 'var(--color-brand)' : 'var(--color-text-primary)', fontWeight: exibirEspera ? 600 : 400 }}>
            <input type="checkbox" className="w-4 h-4" style={{ accentColor: 'var(--color-brand)' }} checked={exibirEspera} onChange={(e) => setExibirEspera(e.target.checked)} />
            Exibir em espera{emEspera ? ` (${emEspera})` : ''}
          </label>
          <SearchField value={busca} onChange={setBusca} placeholder="Pesquisar por nome, cargo ou vaga..." />
          {filtrando && <FilterResult total={visiveis.length} onClear={() => { setVagaFiltro('todas'); setBusca('') }} />}
        </div>

        {/* Kanban: etapas da empresa, na ordem do fluxo */}
        <div className="overflow-x-auto pb-2 -mx-1 px-1 flex-1 flex flex-col">
          <div className="flex gap-3 flex-1" style={{ minWidth: `${colunas.length * 252}px` }}>
            {colunas.map((etapa) => {
              const cards = visiveis.filter((e) => etapaDe(e) === etapa.key)
              const destacar = sobre === etapa.key
              const final = etapa.key === ETAPA_FINAL
              return (
                <section
                  key={etapa.key}
                  aria-label={etapa.label}
                  className="flex flex-col rounded-xl flex-1 min-w-[240px]"
                  style={{
                    // Cor primária bem transparente; mais forte ao arrastar um card por cima
                    backgroundColor: `color-mix(in srgb, var(--color-brand) ${destacar ? 20 : 10}%, transparent)`,
                    border: `2px solid ${destacar ? 'var(--color-brand)' : 'transparent'}`,
                    transition: 'background-color 0.15s, border-color 0.15s',
                  }}
                  onDragOver={(ev) => { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; setSobre(etapa.key) }}
                  onDragLeave={(ev) => { if (!ev.currentTarget.contains(ev.relatedTarget as Node)) setSobre(null) }}
                  onDrop={(ev) => {
                    ev.preventDefault()
                    setSobre(null)
                    setArrastando(null)
                    const alvo = employees.find((x) => x.id === ev.dataTransfer.getData('empId'))
                    if (alvo) mover(alvo, etapa.key)
                  }}
                >
                  <header className="flex items-center gap-2 px-3 pt-3 pb-2">
                    <h3 className="text-xs font-bold flex-1" style={{ color: 'var(--color-brand)' }}>
                      {etapa.label}
                      {!etapa.ativo && <span className="ml-1.5 font-semibold" style={{ color: 'var(--color-text-muted)' }}>· inativa</span>}
                    </h3>
                    {!final && (
                      <span className="text-xs rounded-full px-1.5 py-0.5 font-semibold shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--color-brand) 15%, transparent)', color: 'var(--color-brand)' }}>
                        {cards.length}
                      </span>
                    )}
                  </header>

                  <div className="flex flex-col gap-2 px-2 pb-3 flex-1 min-h-[96px]">
                    {final && (
                      <p className="text-xs text-center px-2 py-6 rounded-lg border-2 border-dashed" style={{ borderColor: destacar ? 'var(--color-brand)' : 'color-mix(in srgb, var(--color-brand) 35%, transparent)', color: 'var(--color-text-muted)' }}>
                        A admissão termina ao concluir a última etapa na ficha. A pessoa entra na Equipe.
                      </p>
                    )}
                    {cards.map((e) => {
                      const situacao = situacaoLink(tokens[e.id])
                      // Próxima entrevista marcada (a lista vem da mais recente para a mais antiga)
                      const marcada = historicos[e.id]?.entrevistas.filter((x) => x.status === 'agendada' && Date.parse(x.data_hora) > agora).at(-1)
                      const realizada = historicos[e.id]?.entrevistas.some((x) => x.status === 'agendada' && Date.parse(x.data_hora) <= agora)
                      const ocupado = movendo === e.id
                      return (
                        <article
                          key={e.id}
                          draggable
                          onDragStart={(ev) => { ev.dataTransfer.setData('empId', e.id); ev.dataTransfer.effectAllowed = 'move'; setArrastando(e.id) }}
                          onDragEnd={() => { setArrastando(null); setSobre(null) }}
                          onClick={() => router.push(`/pessoas/admissao/${e.id}`)}
                          className="rounded-lg border bg-white cursor-pointer select-none min-h-24"
                          style={{
                            borderColor: 'var(--color-card-border)',
                            opacity: arrastando === e.id ? 0.35 : ocupado || e.admissao_em_espera ? 0.65 : 1,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                          }}
                        >
                          <div className="p-3 flex flex-col gap-2">
                            {/* Vaga e foto (à direita) na mesma linha; o nome embaixo, com a largura toda do card */}
                            <div className="flex items-center gap-2">
                              <p className="text-xs truncate flex-1 min-w-0" style={{ color: 'var(--color-text-muted)' }}>{e.vaga?.titulo ?? e.cargo ?? 'Sem vaga'}</p>
                              <Avatar src={photoUrls[e.id]} nome={e.nome} size={28} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{e.nome}</p>
                              <div className="flex flex-wrap gap-1 mt-3 empty:hidden">
                                {e.admissao_em_espera && <span className="text-[11px] font-semibold px-1.5 rounded-full" style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}>Em espera</span>}
                                {/* Situação da entrevista; o texto pode quebrar em duas linhas, por isso o canto menos arredondado */}
                                {etapa.key === ETAPA_INICIAL && (
                                  marcada
                                    ? <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>Entrevista marcada para {fmtDataHora(marcada.data_hora)}</span>
                                    : realizada
                                      ? <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: '#DCFCE7', color: '#15803D' }}>Entrevista realizada</span>
                                      : <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}>Entrevista ainda não marcada</span>
                                )}
                                {etapa.key === ETAPA_CARTA && cartas[e.id]?.status === 'enviada' && (
                                  Date.parse(cartas[e.id].expira_em) < agora
                                    ? <span className="text-[11px] font-semibold px-1.5 rounded-full" style={{ backgroundColor: '#FEE2E2', color: '#B91C1C' }}>Carta expirada</span>
                                    : <span className="text-[11px] font-semibold px-1.5 rounded-full" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>Carta enviada</span>
                                )}
                                {etapa.key === ETAPA_CARTA && cartas[e.id]?.status === 'aceita' && <span className="text-[11px] font-semibold px-1.5 rounded-full" style={{ backgroundColor: '#DCFCE7', color: '#15803D' }}>Carta aceita</span>}
                                {etapa.key === ETAPA_EXAME && <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}>Exame ainda não encaminhado</span>}
                                {etapa.key === ETAPA_RESULTADO_EXAME && (() => {
                                  const exame = exames[e.id]?.find((x) => x.status === 'encaminhado')
                                  if (!exame) return <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}>Aguardando resultado</span>
                                  if (!exame.data_hora || Date.parse(exame.data_hora) <= agora) return <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}>Aguardando resultado</span>
                                  return exame.data_hora
                                    ? <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>Exame marcado para {fmtDataHora(exame.data_hora)}</span>
                                    : <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>Encaminhado à {exame.clinica_nome}</span>
                                })()}
                                {etapa.key === ETAPA_CONTABILIDADE && <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}>Ficha ainda não enviada</span>}
                                {etapa.key === ETAPA_AGUARDAR_CONTABILIDADE && e.admissao_contabilidade_enviada_em && <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>Enviada em {fmtDataHora(e.admissao_contabilidade_enviada_em).split(' às ')[0]}</span>}
                                {etapa.key === ETAPA_CONTRATO && <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}>Aguardando contrato assinado</span>}
                                {!etapa.padrao && <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: '#F3F4F6', color: '#4B5563' }}>Controle interno</span>}
                                {etapa.key === ETAPA_CARTA && situacao === 'done' && <span className="text-[11px] font-semibold px-1.5 rounded-full" style={{ backgroundColor: '#DCFCE7', color: '#15803D' }}>Dados preenchidos</span>}
                                {etapa.key === ETAPA_CARTA && situacao === 'pending' && <span className="text-[11px] font-semibold px-1.5 rounded-full" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>Aguardando dados</span>}
                                {etapa.key === ETAPA_CARTA && situacao === 'expired' && <span className="text-[11px] font-semibold px-1.5 rounded-full" style={{ backgroundColor: '#FEE2E2', color: '#B91C1C' }}>Link expirado</span>}
                              </div>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      </div>
      </div>
    </>
  )
}
