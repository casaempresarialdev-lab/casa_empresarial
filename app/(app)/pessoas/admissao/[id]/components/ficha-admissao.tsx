'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SearchSelect } from '@/components/ui/search-select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Accordion } from '@/components/ui/accordion'
import { toast } from '@/lib/toast'
import { DURACOES_ENTREVISTA, entrevistaSchema, fmtDataHora, isoParaCampos, type EntrevistaInput } from '@/lib/validations/admissao'
import {
  aprovarEntrevistaAction, cancelarEntrevistaAction, definirEsperaAction,
  preencherDadosAction, reprovarAdmissaoAction, salvarEntrevistaAction,
} from '../../actions'
import { AutoCadastroForm } from '@/app/auto-cadastro/[token]/components/auto-cadastro-form'
import { generateOnboardingTokenAction } from '../../../funcionarios/actions'
import { ETAPAS, ETAPA_CARTA, ETAPA_EXAME, ETAPA_INICIAL, ETAPA_RESULTADO_EXAME, isEtapa,
  ETAPA_AGUARDAR_CONTABILIDADE, ETAPA_CONTABILIDADE, ETAPA_CONTRATO,
} from '../../etapas'
import { fmtDate, iniciais, maskCpf, tipoLabel } from '../../../funcionarios/components/ficha/ficha-config'
import { CartaProposta } from '../../components/carta-proposta'
import { ListaEntrevistas } from '../../components/historico-admissao'
import { TimelineAdmissao } from './timeline-admissao'
import { ExameAdmissao, quandoExame } from './exame-admissao'
import { ResultadoExame } from './resultado-exame'
import { ContabilidadeAdmissao, ContratoAdmissao } from './contabilidade-admissao'
import type { Employee } from '../../../funcionarios/queries'
import type { CompanyBenefit } from '../../../beneficios/queries'
import type { Company } from '../../../../empresa/queries'
import type { Carta, Clinica, ConfigAdmissao, EmAdmissao, Entrevista, Entrevistador, Exame, Historico, OnboardingTokenInfo } from '../../queries'

const situacaoLink = (t: OnboardingTokenInfo | undefined): 'none' | 'pending' | 'done' | 'expired' => {
  if (!t) return 'none'
  if (t.used_at) return 'done'
  return new Date(t.expires_at) < new Date() ? 'expired' : 'pending'
}

// Marcar ou remarcar a entrevista
function FormEntrevista({ entrevista, entrevistadores, usuarioId, enviando, onSalvar, onCancelar }: {
  entrevista: Entrevista | null
  entrevistadores: Entrevistador[]
  usuarioId: string
  enviando: boolean
  onSalvar: (d: EntrevistaInput) => void
  onCancelar: () => void
}) {
  const inicial = entrevista ? isoParaCampos(entrevista.data_hora) : { data: '', hora: '' }
  const { register, control, handleSubmit, formState: { errors } } = useForm<EntrevistaInput>({
    resolver: zodResolver(entrevistaSchema),
    defaultValues: {
      ...inicial,
      duracao_min: entrevista ? (String(entrevista.duracao_min) as EntrevistaInput['duracao_min']) : '60',
      entrevistador_id: entrevista?.entrevistador_id ?? (entrevistadores.some((e) => e.id === usuarioId) ? usuarioId : ''),
      link_reuniao: entrevista?.link_reuniao ?? '',
    },
  })

  return (
    <form onSubmit={handleSubmit(onSalvar)} noValidate className="flex flex-col gap-3 rounded-xl border p-4" style={{ borderColor: 'var(--color-card-border)', backgroundColor: '#FAFAFA' }}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input label="Data *" type="date" error={errors.data?.message} {...register('data')} />
        <Input label="Hora *" type="time" error={errors.hora?.message} {...register('hora')} />
        <Select label="Duração" options={DURACOES_ENTREVISTA} {...register('duracao_min')} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Controller
          control={control}
          name="entrevistador_id"
          render={({ field }) => (
            <SearchSelect
              label="Entrevistador *"
              options={entrevistadores.map((e) => ({ value: e.id, label: e.nome }))}
              value={field.value}
              onChange={field.onChange}
              placeholder="Pesquisar pelo nome..."
              emptyText="Nenhum usuário da empresa com esse nome."
              error={errors.entrevistador_id?.message}
            />
          )}
        />
        <Input label="Link da entrevista" placeholder="https://..." error={errors.link_reuniao?.message} {...register('link_reuniao')} />
      </div>
      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        O evento entra na agenda do entrevistador, com aviso 30 minutos antes, e o candidato recebe a data, a hora e o link por e-mail.
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancelar} disabled={enviando}>Cancelar</Button>
        <Button type="submit" size="sm" loading={enviando}>{entrevista ? 'Remarcar' : 'Marcar entrevista'}</Button>
      </div>
    </form>
  )
}

interface Props {
  emp: EmAdmissao
  fotoUrl: string | null
  historico: Historico
  entrevistadores: Entrevistador[]
  usuarioId: string
  token: OnboardingTokenInfo | undefined
  carta: Carta | undefined
  config: ConfigAdmissao
  clinicas: Clinica[]
  exames: Exame[]
  /** Cadastro completo (com os benefícios), para a ficha em PDF da contabilidade e o contrato */
  fichaCompleta: Employee
  company: Company | null
  benefits: CompanyBenefit[]
  empresa: string
  companyId: string
}

// Ficha de admissão. À esquerda, as etapas em sanfona: só aparecem a atual e as que já têm dados.
// À direita, as anotações e os eventos do processo em uma linha do tempo.
export function FichaAdmissao({ emp, fotoUrl, historico, entrevistadores, usuarioId, token, carta, config, clinicas, exames, fichaCompleta, company, benefits, empresa, companyId }: Props) {
  const router = useRouter()
  const [gerando, setGerando] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [reprovando, setReprovando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [processando, setProcessando] = useState(false)
  // Preenchimento dos dados pelo painel (mesmo formulário do candidato)
  const [preenchendo, setPreenchendo] = useState(false)
  // null = fechado; 'nova' = marcar; Entrevista = remarcar
  const [formEntrevista, setFormEntrevista] = useState<'nova' | Entrevista | null>(null)
  const [salvandoEntrevista, setSalvandoEntrevista] = useState(false)
  const [cancelar, setCancelar] = useState<Entrevista | null>(null)

  const situacao = situacaoLink(token)
  const emEspera = !!emp.admissao_em_espera
  const atual = isEtapa(emp.admission_stage) ? emp.admission_stage : ETAPA_INICIAL
  const idxAtual = ETAPAS.findIndex((e) => e.key === atual)
  const naEntrevista = atual === ETAPA_INICIAL
  const naCarta = atual === ETAPA_CARTA
  const noExame = atual === ETAPA_EXAME
  const noResultado = atual === ETAPA_RESULTADO_EXAME
  const naContabilidade = atual === ETAPA_CONTABILIDADE
  const aguardandoContabilidade = atual === ETAPA_AGUARDAR_CONTABILIDADE
  const naAssinatura = atual === ETAPA_CONTRATO
  const idxContabilidade = ETAPAS.findIndex((e) => e.key === ETAPA_CONTABILIDADE)
  const cartaAceita = carta?.status === 'aceita'

  const idxCarta = ETAPAS.findIndex((e) => e.key === ETAPA_CARTA)
  const agora = useState(() => Date.now())[0]
  const entrevistaMarcada = historico.entrevistas.filter((e) => e.status === 'agendada' && Date.parse(e.data_hora) > agora).at(-1)

  // Sanfona: a etapa atual começa aberta e as demais fechadas, até a pessoa abrir ou fechar alguma
  const [alternadas, setAlternadas] = useState<Record<string, boolean>>({})
  const secaoAtual = naEntrevista ? 'entrevista' : naCarta ? 'carta' : noExame ? 'exame'
    : naContabilidade || aguardandoContabilidade ? 'contabilidade' : naAssinatura ? 'contrato' : atual
  const estaAberta = (id: string) => alternadas[id] ?? (id === secaoAtual || (id === 'dados' && naCarta && cartaAceita))
  const alternar = (id: string) => setAlternadas((a) => ({ ...a, [id]: !estaAberta(id) }))
  const seloAtual = <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>Etapa atual</span>

  // Resumos com a seção fechada
  const resumoEntrevista = entrevistaMarcada
    ? `Marcada para ${fmtDataHora(entrevistaMarcada.data_hora)}`
    : historico.entrevistas.length ? `${historico.entrevistas.length} no histórico` : 'Ainda não marcada'
  const resumoCarta = cartaAceita ? `Aceita em ${fmtDataHora(carta!.respondida_em!)}` : carta ? `Enviada em ${fmtDataHora(carta.created_at)}` : 'Ainda não enviada'
  const resumoDados = idxAtual > idxCarta ? 'Dados preenchidos' : situacao === 'done' ? `Preenchidos em ${fmtDate(token!.used_at)}` : situacao === 'pending' ? 'Aguardando o preenchimento' : situacao === 'expired' ? 'O link expirou' : 'Link ainda não gerado'

  const resumoContabilidade = fichaCompleta.admissao_contabilidade_retorno_em
    ? `Retorno em ${fmtDataHora(fichaCompleta.admissao_contabilidade_retorno_em)}`
    : fichaCompleta.admissao_contabilidade_enviada_em ? `Enviada em ${fmtDataHora(fichaCompleta.admissao_contabilidade_enviada_em)}` : 'Ficha ainda não enviada'

  const exameAtual = exames.find((e) => e.status !== 'substituido')
  const resumoExame = !exameAtual ? 'Ainda não encaminhado'
    : exameAtual.status === 'realizado' ? `Realizado na ${exameAtual.clinica_nome}`
    : `${exameAtual.clinica_nome} · ${quandoExame(exameAtual)}`

  const voltarAoKanban = () => router.push('/pessoas/admissao')

  async function gerarLink() {
    setGerando(true)
    const r = await generateOnboardingTokenAction(emp.id)
    setGerando(false)
    if (r.error || !r.url) { toast.error(r.error ?? 'Não foi possível gerar o link.'); return }
    setLink(r.url)
    router.refresh()
  }

  async function copiarLink(url: string) {
    await navigator.clipboard.writeText(url)
    toast('Link copiado.')
  }

  function enviarWhatsApp(url: string) {
    const fone = emp.telefone?.replace(/\D/g, '') ?? ''
    const msg = encodeURIComponent(`Olá, ${emp.nome.split(' ')[0]}! Acesse o link abaixo para preencher seus dados de admissão:\n${url}`)
    window.open(`https://wa.me/55${fone}?text=${msg}`, '_blank')
  }

  async function salvarEntrevista(d: EntrevistaInput) {
    const remarcando = formEntrevista && formEntrevista !== 'nova' ? formEntrevista : null
    setSalvandoEntrevista(true)
    const r = await toast.promise(salvarEntrevistaAction(companyId, emp.id, remarcando?.id ?? null, d), {
      loading: remarcando ? 'Remarcando a entrevista…' : 'Marcando a entrevista…',
      success: (res) => {
        const avisado = 'candidatoAvisado' in res && res.candidatoAvisado
        return `Entrevista ${remarcando ? 'remarcada' : 'marcada'}${avisado ? ' e candidato avisado por e-mail' : ''}.`
      },
      error: 'Não foi possível salvar a entrevista.',
    })
    setSalvandoEntrevista(false)
    if ('error' in r) return
    if (!r.candidatoAvisado) toast.error('O e-mail para o candidato não foi enviado. Avise por outro meio.')
    setFormEntrevista(null)
    router.refresh()
  }

  async function confirmarCancelamento() {
    const e = cancelar
    if (!e) return
    setProcessando(true)
    const r = await toast.promise(cancelarEntrevistaAction(companyId, e.id), {
      loading: 'Cancelando a entrevista…',
      success: 'Entrevista cancelada e retirada da agenda.',
      error: 'Não foi possível cancelar.',
    })
    setProcessando(false)
    setCancelar(null)
    if ('error' in r) return
    if (!r.candidatoAvisado) toast.error('O e-mail para o candidato não foi enviado. Avise por outro meio.')
    router.refresh()
  }

  async function alternarEspera() {
    setProcessando(true)
    const r = await toast.promise(definirEsperaAction(emp.id, companyId, !emEspera), {
      loading: emEspera ? 'Retomando…' : 'Deixando em espera…',
      success: emEspera ? `${emp.nome} voltou para o kanban.` : `${emp.nome} ficou em espera.`,
      error: 'Não foi possível alterar.',
    })
    setProcessando(false)
    if (!('error' in r)) router.refresh()
  }

  async function aprovar() {
    setProcessando(true)
    const r = await toast.promise(aprovarEntrevistaAction(emp.id, companyId), {
      loading: 'Aprovando…',
      success: `${emp.nome} foi aprovado na entrevista.`,
      error: 'Não foi possível aprovar.',
    })
    setProcessando(false)
    if (!('error' in r)) router.refresh()
  }

  async function reprovar() {
    setProcessando(true)
    const r = await toast.promise(reprovarAdmissaoAction(emp.id, companyId, motivo), {
      loading: `Reprovando ${emp.nome}…`,
      success: emp.vaga ? `${emp.nome} voltou para a vaga como reprovado.` : `${emp.nome} saiu do processo.`,
      error: 'Não foi possível reprovar.',
    })
    setProcessando(false)
    if ('error' in r) return
    if (r.avisoFalhou) toast.error('O e-mail de reprovação não foi enviado. Avise o candidato por outro meio.')
    voltarAoKanban()
  }

  const dados = [
    emp.vaga ? `Vaga: ${emp.vaga.titulo}` : 'Admissão sem vaga',
    emp.tipo_contrato ? tipoLabel(emp.tipo_contrato) : null,
    emp.cpf ? `CPF ${maskCpf(emp.cpf)}` : null,
    emp.email,
    emp.telefone,
  ].filter(Boolean)

  // Reprovação: aberta pelo botão do topo, vale em qualquer etapa
  const formReprovacao = reprovando && (
    <div className="flex flex-col gap-3 rounded-xl border p-4 basis-full" style={{ borderColor: '#FCA5A5' }}>
      <div className="flex flex-col gap-1">
        <label htmlFor="motivo-reprovacao" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Motivo (opcional)</label>
        <textarea
          id="motivo-reprovacao"
          rows={2}
          maxLength={1000}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
          style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
        />
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {emp.vaga
            ? 'A candidatura volta para a vaga como reprovada, com o histórico. O cadastro em admissão e seus arquivos são excluídos.'
            : 'Sem vaga: o cadastro, o histórico e os arquivos são excluídos.'}
          {config.reprovacao_notificar && emp.email && <strong> O candidato recebe o e-mail de reprovação das Configurações.</strong>}
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => setReprovando(false)} disabled={processando}>Voltar</Button>
        <Button type="button" variant="danger" size="sm" onClick={reprovar} loading={processando}>Confirmar reprovação</Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={voltarAoKanban}
        className="flex items-center gap-1.5 text-sm"
        style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        ← Admissão
      </button>

      {/* Título e breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
          Ficha de admissão
        </h1>
        <Breadcrumb current={emp.nome} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
        <div className="flex flex-col gap-4 min-w-0">
          {/* Quem é + acesso aos dados cadastrais */}
          <div className="app-card p-5 flex flex-wrap items-center gap-4">
            <span
              className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center shrink-0 text-base font-bold"
              style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {fotoUrl ? <img src={fotoUrl} alt={emp.nome} className="w-full h-full object-cover" /> : iniciais(emp.nome)}
            </span>
            <div className="flex-1 min-w-[220px]">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{emp.nome}</h2>
                {emEspera && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}>Em espera</span>
                )}
              </div>
              <p className="text-sm mt-0.5 break-words" style={{ color: 'var(--color-text-muted)' }}>{dados.join(' · ')}</p>
            </div>
            <Button type="button" variant="secondary" onClick={() => router.push(`/pessoas/funcionarios/${emp.id}`)}>Dados cadastrais</Button>
            {/* Decisões que valem em qualquer etapa */}
            <div className="basis-full flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: 'var(--color-card-border)' }}>
              <Button type="button" variant="ghost" size="sm" onClick={() => setReprovando(true)} disabled={processando || reprovando} style={{ color: '#B91C1C' }}>Reprovar candidato</Button>
              <Button type="button" variant="secondary" size="sm" onClick={alternarEspera} disabled={processando}>{emEspera ? 'Retomar' : 'Deixar candidato em espera'}</Button>
            </div>
            {formReprovacao}
          </div>

          {/* 1. Entrevista */}
          {(naEntrevista || historico.entrevistas.length > 0) && (
            <Accordion titulo="Entrevista" resumo={resumoEntrevista} selo={naEntrevista && seloAtual} aberto={estaAberta('entrevista')} onAlternar={() => alternar('entrevista')}>
              <div className="flex flex-col gap-3">
                {naEntrevista && !formEntrevista && (
                  <div className="flex justify-end">
                    <Button type="button" variant="secondary" size="sm" onClick={() => setFormEntrevista('nova')}>Marcar entrevista</Button>
                  </div>
                )}
                {formEntrevista && (
                  <FormEntrevista
                    key={formEntrevista === 'nova' ? 'nova' : formEntrevista.id}
                    entrevista={formEntrevista === 'nova' ? null : formEntrevista}
                    entrevistadores={entrevistadores}
                    usuarioId={usuarioId}
                    enviando={salvandoEntrevista}
                    onSalvar={salvarEntrevista}
                    onCancelar={() => setFormEntrevista(null)}
                  />
                )}
                <ListaEntrevistas
                  entrevistas={historico.entrevistas}
                  acoes={naEntrevista ? (e) => (
                    <span className="flex gap-1">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setFormEntrevista(e)}>Remarcar</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setCancelar(e)} style={{ color: '#B91C1C' }}>Cancelar</Button>
                    </span>
                  ) : undefined}
                />
                {naEntrevista && (
                  <div className="flex justify-end border-t pt-4" style={{ borderColor: 'var(--color-card-border)' }}>
                    <Button type="button" onClick={aprovar} loading={processando}>Aprovar candidato</Button>
                  </div>
                )}
              </div>
            </Accordion>
          )}

          {/* 2. Carta proposta */}
          {(naCarta || !!carta) && (
            <Accordion titulo="Carta proposta" resumo={resumoCarta} selo={naCarta && seloAtual} aberto={estaAberta('carta')} onAlternar={() => alternar('carta')}>
              <div className="flex flex-col gap-3">
                <CartaProposta emp={emp} carta={carta} config={config} empresa={empresa} companyId={companyId} />
              </div>
            </Accordion>
          )}

          {/* Preenchimento dos dados: depois do aceite */}
          {(cartaAceita || !!token || idxAtual > idxCarta) && (
            <Accordion titulo="Preenchimento dos dados" resumo={resumoDados} aberto={estaAberta('dados')} onAlternar={() => alternar('dados')}>
              {idxAtual > idxCarta || situacao === 'done' ? (
                <p className="text-sm" style={{ color: '#15803D' }}>
                  {situacao === 'done' ? `Dados preenchidos pelo candidato em ${fmtDate(token!.used_at)}.` : 'Dados preenchidos.'} Para alterar, use &quot;Dados cadastrais&quot;.
                </p>
              ) : preenchendo ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Preencher no painel</p>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setPreenchendo(false)}>Cancelar</Button>
                  </div>
                  <AutoCadastroForm
                    semCartao
                    enviar={(fd) => preencherDadosAction(companyId, emp.id, fd)}
                    onConcluido={() => { setPreenchendo(false); toast('Dados salvos. O candidato seguiu para "Encaminhar para exame".'); router.refresh() }}
                    employeeName={emp.nome}
                    companyName={empresa}
                    tipoContrato={emp.tipo_contrato}
                    docsExistentes={[
                      emp.doc_cpf_path ? 'cpf' : null,
                      emp.doc_ctps_path ? 'ctps' : null,
                      emp.doc_comprovante_residencia_path ? 'comprovante_residencia' : null,
                    ].filter((d): d is string => !!d)}
                    inicial={{
                      cpf: emp.cpf ?? '',
                      rg: emp.rg ?? '',
                      nascimento: emp.nascimento ?? '',
                      telefone: emp.telefone ?? '',
                      email: emp.email ?? '',
                      grau_instrucao: emp.grau_instrucao ?? '',
                      dependentes: String(emp.dependentes ?? 0),
                      pis_pasep: emp.pis_pasep ?? '',
                      serie_ctps: emp.serie_ctps ?? '',
                      certificado_reservista: emp.certificado_reservista ?? '',
                      dados_bancarios: emp.dados_bancarios ?? '',
                    }}
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    O candidato preenche pelo link, ou você preenche aqui. Ao concluir, ele segue para &quot;Encaminhar para exame&quot;.
                  </p>
                  {link && (
                    <div className="rounded-xl border p-3 flex flex-col gap-2" style={{ borderColor: 'var(--color-card-border)', backgroundColor: 'var(--color-brand-light)' }}>
                      <p className="text-xs break-all" style={{ color: 'var(--color-text-secondary)' }}>{link}</p>
                      <div className="flex gap-2">
                        <Button type="button" variant="secondary" size="sm" onClick={() => copiarLink(link)}>Copiar link</Button>
                        {emp.telefone && <Button type="button" size="sm" style={{ backgroundColor: '#25D366' }} onClick={() => enviarWhatsApp(link)}>Enviar por WhatsApp</Button>}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {!link && (
                      <Button type="button" variant="secondary" size="sm" onClick={gerarLink} loading={gerando}>
                        {situacao === 'none' ? 'Gerar link de preenchimento' : 'Gerar novo link'}
                      </Button>
                    )}
                    <Button type="button" size="sm" onClick={() => setPreenchendo(true)}>Preencher no painel</Button>
                    {situacao === 'pending' && <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>O link enviado aguarda o preenchimento.</span>}
                    {situacao === 'expired' && <span className="text-xs" style={{ color: '#B91C1C' }}>O link anterior expirou.</span>}
                  </div>
                </div>
              )}
            </Accordion>
          )}

          {/* Exame admissional: na etapa e, depois, como histórico */}
          {(noExame || exames.length > 0) && (
            <Accordion titulo="Exame admissional" resumo={resumoExame} selo={noExame && seloAtual} aberto={estaAberta('exame')} onAlternar={() => alternar('exame')}>
              <ExameAdmissao exames={exames} clinicas={clinicas} config={config} temEmail={!!emp.email} naEtapa={noExame || noResultado} companyId={companyId} employeeId={emp.id} />
            </Accordion>
          )}

          {/* Etapas seguintes: só a atual aparece, até terem dados próprios */}
          {noResultado && (
            <Accordion titulo="Resultado do exame" selo={seloAtual} aberto={estaAberta(atual)} onAlternar={() => alternar(atual)}>
              <ResultadoExame
                exame={exames.find((e) => e.status === 'encaminhado')}
                config={config}
                temEmail={!!emp.email}
                temVaga={!!emp.vaga}
                companyId={companyId}
                employeeId={emp.id}
                onReprovado={voltarAoKanban}
              />
            </Accordion>
          )}

          {/* Contabilidade (externa): na etapa de envio, aguardando o retorno e, depois, como consulta */}
          {idxAtual >= idxContabilidade && (
            <Accordion
              titulo="Contabilidade"
              resumo={resumoContabilidade}
              selo={(naContabilidade || aguardandoContabilidade) && seloAtual}
              aberto={estaAberta('contabilidade')}
              onAlternar={() => alternar('contabilidade')}
            >
              <ContabilidadeAdmissao
                employee={fichaCompleta}
                company={company}
                benefits={benefits}
                fotoUrl={fotoUrl}
                etapa={naContabilidade ? 'envio' : aguardandoContabilidade ? 'aguardando' : 'concluida'}
                companyId={companyId}
              />
            </Accordion>
          )}

          {naAssinatura && (
            <Accordion titulo="Assinar contrato" selo={seloAtual} aberto={estaAberta('contrato')} onAlternar={() => alternar('contrato')}>
              <ContratoAdmissao employee={fichaCompleta} dataInicio={carta?.data_inicio ?? null} companyId={companyId} onFinalizado={voltarAoKanban} />
            </Accordion>
          )}
        </div>

        <TimelineAdmissao
          anotacoes={historico.anotacoes}
          iniciadaEm={emp.created_at}
          employeeId={emp.id}
          companyId={companyId}
        />
      </div>

      <ConfirmDialog
        open={!!cancelar}
        onClose={() => { if (!processando) setCancelar(null) }}
        onConfirm={confirmarCancelamento}
        loading={processando}
        confirmLabel="Cancelar entrevista"
        title="Cancelar entrevista"
        message={<p>Cancelar a entrevista? O evento sai da agenda de {cancelar?.entrevistador_nome} e o candidato é avisado por e-mail.</p>}
      />
    </div>
  )
}
