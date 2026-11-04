'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { AddButton } from '@/components/ui/add-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Icon } from '@/components/ui/icon'
import { FilterResult, FilterSelect, SearchField } from '@/components/ui/filter-select'
import { toast } from '@/lib/toast'
import { fmtDataHora } from '@/lib/validations/admissao'
import { finalizarAdmissaoAction, moverEtapaAction } from '../actions'
import { ETAPAS, ETAPA_CARTA, ETAPA_FINAL, ETAPA_INICIAL, isEtapa, type EtapaKey } from '../etapas'
import { iniciais } from '../../funcionarios/components/ficha/ficha-config'
import { PainelAdmissao } from './painel-admissao'
import type { Carta, ConfigAdmissao, EmAdmissao, Entrevistador, Historico, OnboardingTokenInfo } from '../queries'

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

function hojeIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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
  entrevistadores: Entrevistador[]
  usuarioId: string
  cartas: Record<string, Carta>
  config: ConfigAdmissao
  empresa: string
}

export function AdmissaoClient({ employees, tokens, photoUrls, companyId, historicos, entrevistadores, usuarioId, cartas, config, empresa }: Props) {
  const router = useRouter()
  // Movimento já mostrado na tela enquanto o servidor confirma
  const [movidos, setMovidos] = useState<Record<string, EtapaKey>>({})
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<EtapaKey | null>(null)
  const [movendo, setMovendo] = useState<string | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)
  const [finalizar, setFinalizar] = useState<EmAdmissao | null>(null)
  const [dataAdmissao, setDataAdmissao] = useState('')
  const [finalizando, setFinalizando] = useState(false)

  const [vagaFiltro, setVagaFiltro] = useState('todas')
  const [busca, setBusca] = useState('')
  const [exibirEspera, setExibirEspera] = useState(false)

  const etapaDe = (e: EmAdmissao): EtapaKey => movidos[e.id] ?? (isEtapa(e.admission_stage) ? e.admission_stage : ETAPA_INICIAL)

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

  function pedirFinalizacao(e: EmAdmissao) {
    setAberto(null)
    setDataAdmissao(e.data_admissao ?? hojeIso())
    setFinalizar(e)
  }

  async function mover(e: EmAdmissao, etapa: EtapaKey) {
    if (etapaDe(e) === etapa) return
    // Da entrevista só se sai com a decisão, que fica no card
    if (etapaDe(e) === ETAPA_INICIAL) {
      setAberto(e.id)
      toast.error('Registre a decisão da entrevista: aprovar ou reprovar.')
      return
    }
    if (etapa === ETAPA_FINAL) { pedirFinalizacao(e); return }
    setMovendo(e.id)
    setMovidos((m) => ({ ...m, [e.id]: etapa }))
    const r = await moverEtapaAction(e.id, companyId, etapa)
    setMovendo(null)
    // A resposta já traz a tela atualizada: o movimento provisório pode sair
    setMovidos((m) => { const n = { ...m }; delete n[e.id]; return n })
    if ('error' in r) toast.error(r.error ?? 'Não foi possível mover.')
  }

  async function confirmarFinalizacao() {
    const e = finalizar
    if (!e) return
    setFinalizando(true)
    const r = await toast.promise(finalizarAdmissaoAction(e.id, companyId, dataAdmissao), {
      loading: 'Finalizando a admissão…',
      success: `${e.nome} entrou na Equipe.`,
      error: 'Não foi possível finalizar.',
    })
    setFinalizando(false)
    if ('error' in r) return
    setFinalizar(null)
    router.refresh()
  }

  const selecionado = employees.find((e) => e.id === aberto) ?? null
  const [agora] = useState(() => Date.now())

  return (
    <>
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
            Admissão
          </h1>
          <Breadcrumb />
        </div>
      </div>

      <div className="app-card p-5 flex flex-col gap-4">
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

        {/* Kanban: etapas fixas, na ordem do fluxo */}
        <div className="overflow-x-auto pb-2 -mx-1 px-1">
          <div className="flex gap-3" style={{ minWidth: `${ETAPAS.length * 252}px` }}>
            {ETAPAS.map((etapa, i) => {
              const cards = visiveis.filter((e) => etapaDe(e) === etapa.key)
              const destacar = sobre === etapa.key
              const final = etapa.key === ETAPA_FINAL
              return (
                <section
                  key={etapa.key}
                  aria-label={etapa.label}
                  className="flex flex-col rounded-xl flex-1 min-w-[240px]"
                  style={{
                    backgroundColor: destacar ? `${etapa.color}14` : 'var(--color-bg-surface)',
                    border: `2px solid ${destacar ? etapa.color : 'transparent'}`,
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
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: etapa.color }} />
                    <h3 className="text-xs font-semibold flex-1" style={{ color: 'var(--color-text-secondary)' }}>{etapa.label}</h3>
                    {!final && (
                      <span className="text-xs rounded-full px-1.5 py-0.5 font-semibold shrink-0" style={{ backgroundColor: `${etapa.color}22`, color: 'var(--color-text-secondary)' }}>
                        {cards.length}
                      </span>
                    )}
                  </header>

                  <div className="flex flex-col gap-2 px-2 pb-3 flex-1 min-h-[96px]">
                    {final && (
                      <p className="text-xs text-center px-2 py-6 rounded-lg border-2 border-dashed" style={{ borderColor: destacar ? etapa.color : 'var(--color-card-border)', color: 'var(--color-text-muted)' }}>
                        Solte aqui para finalizar. A pessoa entra na Equipe.
                      </p>
                    )}
                    {cards.map((e) => {
                      const situacao = situacaoLink(tokens[e.id])
                      // Próxima entrevista marcada (a lista vem da mais recente para a mais antiga)
                      const marcada = historicos[e.id]?.entrevistas.filter((x) => x.status === 'agendada' && Date.parse(x.data_hora) > agora).at(-1)
                      const anterior = i > 0 ? ETAPAS[i - 1] : null
                      const proxima = ETAPAS[i + 1] ?? null
                      const ocupado = movendo === e.id
                      return (
                        <article
                          key={e.id}
                          draggable
                          onDragStart={(ev) => { ev.dataTransfer.setData('empId', e.id); ev.dataTransfer.effectAllowed = 'move'; setArrastando(e.id) }}
                          onDragEnd={() => { setArrastando(null); setSobre(null) }}
                          onClick={() => setAberto(e.id)}
                          className="rounded-lg border bg-white cursor-pointer select-none"
                          style={{
                            borderColor: 'var(--color-card-border)',
                            opacity: arrastando === e.id ? 0.35 : ocupado || e.admissao_em_espera ? 0.65 : 1,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                          }}
                        >
                          <div className="px-3 pt-3 pb-2 flex items-start gap-2">
                            <Avatar src={photoUrls[e.id]} nome={e.nome} size={28} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{e.nome}</p>
                              <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{e.vaga?.titulo ?? e.cargo ?? 'Sem vaga'}</p>
                              <div className="flex flex-wrap gap-1 mt-1 empty:hidden">
                                {e.admissao_em_espera && <span className="text-[11px] font-semibold px-1.5 rounded-full" style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}>Em espera</span>}
                                {marcada && <span className="text-[11px] font-semibold px-1.5 rounded-full" style={{ backgroundColor: '#E0E7FF', color: '#4338CA' }}>{fmtDataHora(marcada.data_hora)}</span>}
                                {etapa.key === ETAPA_CARTA && cartas[e.id]?.status === 'enviada' && (
                                  Date.parse(cartas[e.id].expira_em) < agora
                                    ? <span className="text-[11px] font-semibold px-1.5 rounded-full" style={{ backgroundColor: '#FEE2E2', color: '#B91C1C' }}>Carta expirada</span>
                                    : <span className="text-[11px] font-semibold px-1.5 rounded-full" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>Carta enviada</span>
                                )}
                                {etapa.key === ETAPA_CARTA && cartas[e.id]?.status === 'aceita' && <span className="text-[11px] font-semibold px-1.5 rounded-full" style={{ backgroundColor: '#DCFCE7', color: '#15803D' }}>Carta aceita</span>}
                                {situacao === 'done' && <span className="text-[11px] font-semibold px-1.5 rounded-full" style={{ backgroundColor: '#DCFCE7', color: '#15803D' }}>Dados preenchidos</span>}
                                {situacao === 'pending' && <span className="text-[11px] font-semibold px-1.5 rounded-full" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>Aguardando dados</span>}
                                {situacao === 'expired' && <span className="text-[11px] font-semibold px-1.5 rounded-full" style={{ backgroundColor: '#FEE2E2', color: '#B91C1C' }}>Link expirado</span>}
                              </div>
                            </div>
                          </div>
                          {/* Setas: não abrem o painel */}
                          <div className="border-t px-2 py-1 flex items-center justify-between" style={{ borderColor: 'var(--color-card-border)' }} onClick={(ev) => ev.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => anterior && mover(e, anterior.key)}
                              disabled={!anterior || ocupado}
                              className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-25 transition-colors"
                              style={{ color: 'var(--color-text-muted)' }}
                              aria-label={anterior ? `Voltar para ${anterior.label}` : 'Primeira etapa'}
                              title={anterior?.label}
                            >
                              <Icon name="chevron-left" size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => proxima && mover(e, proxima.key)}
                              disabled={!proxima || ocupado}
                              className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-25 transition-colors"
                              style={{ color: 'var(--color-text-muted)' }}
                              aria-label={proxima ? `Avançar para ${proxima.label}` : 'Última etapa'}
                              title={proxima?.label}
                            >
                              <Icon name="chevron-right" size={14} />
                            </button>
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

      {selecionado && (
        <PainelAdmissao
          key={selecionado.id}
          emp={selecionado}
          historico={historicos[selecionado.id] ?? { entrevistas: [], anotacoes: [] }}
          entrevistadores={entrevistadores}
          usuarioId={usuarioId}
          carta={cartas[selecionado.id]}
          config={config}
          empresa={empresa}
          token={tokens[selecionado.id]}
          companyId={companyId}
          onClose={() => setAberto(null)}
          onFinalizar={() => pedirFinalizacao(selecionado)}
        />
      )}

      <Modal open={!!finalizar} onClose={() => { if (!finalizando) setFinalizar(null) }} title={`Finalizar admissão de ${finalizar?.nome ?? ''}`}>
        <div className="flex flex-col gap-4">
          <Input label="Data de admissão *" type="date" value={dataAdmissao} onChange={(e) => setDataAdmissao(e.target.value)} />
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {finalizar?.tipo_contrato === 'clt'
              ? 'A pessoa entra na Equipe em experiência, com o período e as férias calculados a partir desta data.'
              : 'A pessoa entra na Equipe como ativa.'}
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setFinalizar(null)} disabled={finalizando}>Cancelar</Button>
            <Button type="button" onClick={confirmarFinalizacao} loading={finalizando} disabled={!dataAdmissao}>Finalizar</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
