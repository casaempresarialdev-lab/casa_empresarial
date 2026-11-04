'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SearchSelect } from '@/components/ui/search-select'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/lib/toast'
import { DURACOES_ENTREVISTA, entrevistaSchema, isoParaCampos, type EntrevistaInput } from '@/lib/validations/admissao'
import {
  adicionarAnotacaoAction, aprovarEntrevistaAction, cancelarEntrevistaAction, definirEsperaAction,
  moverEtapaAction, reprovarAdmissaoAction, salvarEntrevistaAction,
} from '../actions'
import { generateOnboardingTokenAction } from '../../funcionarios/actions'
import { ETAPAS, ETAPA_CARTA, ETAPA_FINAL, ETAPA_INICIAL, isEtapa } from '../etapas'
import { fmtDate, iniciais, maskCpf, tipoLabel } from '../../funcionarios/components/ficha/ficha-config'
import { CartaProposta } from './carta-proposta'
import { ListaAnotacoes, ListaEntrevistas } from './historico-admissao'
import type { Carta, ConfigAdmissao, EmAdmissao, Entrevista, Entrevistador, Historico, OnboardingTokenInfo } from '../queries'

const situacaoLink = (t: OnboardingTokenInfo | undefined): 'none' | 'pending' | 'done' | 'expired' => {
  if (!t) return 'none'
  if (t.used_at) return 'done'
  return new Date(t.expires_at) < new Date() ? 'expired' : 'pending'
}

function Secao({ titulo, children, acao }: { titulo: string; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{titulo}</h3>
        {acao}
      </div>
      {children}
    </section>
  )
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
  historico: Historico
  entrevistadores: Entrevistador[]
  usuarioId: string
  token: OnboardingTokenInfo | undefined
  carta: Carta | undefined
  config: ConfigAdmissao
  empresa: string
  companyId: string
  onClose: () => void
  onFinalizar: () => void
}

// Painel do card: dados, entrevista, anotações e as decisões da etapa
export function PainelAdmissao({ emp, historico, entrevistadores, usuarioId, token, carta, config, empresa, companyId, onClose, onFinalizar }: Props) {
  const router = useRouter()
  const [gerando, setGerando] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [reprovando, setReprovando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [processando, setProcessando] = useState(false)
  // null = fechado; 'nova' = marcar; Entrevista = remarcar
  const [formEntrevista, setFormEntrevista] = useState<'nova' | Entrevista | null>(null)
  const [salvandoEntrevista, setSalvandoEntrevista] = useState(false)
  const [cancelar, setCancelar] = useState<Entrevista | null>(null)
  const [nota, setNota] = useState('')
  const [salvandoNota, setSalvandoNota] = useState(false)

  const situacao = situacaoLink(token)
  const emEspera = !!emp.admissao_em_espera
  const atual = isEtapa(emp.admission_stage) ? emp.admission_stage : ETAPA_INICIAL
  const naEntrevista = atual === ETAPA_INICIAL
  const naCarta = atual === ETAPA_CARTA
  const proxima = ETAPAS[ETAPAS.findIndex((e) => e.key === atual) + 1]

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

  async function salvarNota() {
    setSalvandoNota(true)
    const r = await adicionarAnotacaoAction(companyId, emp.id, nota)
    setSalvandoNota(false)
    if ('error' in r) { toast.error(r.error ?? 'Não foi possível salvar a anotação.'); return }
    setNota('')
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
    if ('error' in r) return
    router.refresh()
    onClose()
  }

  async function aprovar() {
    setProcessando(true)
    const r = await toast.promise(aprovarEntrevistaAction(emp.id, companyId), {
      loading: 'Aprovando…',
      success: `${emp.nome} foi aprovado na entrevista.`,
      error: 'Não foi possível aprovar.',
    })
    setProcessando(false)
    if ('error' in r) return
    router.refresh()
    onClose()
  }

  async function avancar() {
    if (!proxima) return
    if (proxima.key === ETAPA_FINAL) { onFinalizar(); return }
    setProcessando(true)
    const r = await moverEtapaAction(emp.id, companyId, proxima.key)
    setProcessando(false)
    if ('error' in r) { toast.error(r.error ?? 'Não foi possível avançar.'); return }
    router.refresh()
    onClose()
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
    router.refresh()
    onClose()
  }

  const dados = [
    emp.vaga ? `Vaga: ${emp.vaga.titulo}` : 'Admissão sem vaga',
    emp.tipo_contrato ? tipoLabel(emp.tipo_contrato) : null,
    emp.cpf ? `CPF ${maskCpf(emp.cpf)}` : null,
    emp.email,
    emp.telefone,
  ].filter(Boolean)

  return (
    <>
      <Modal open onClose={onClose} title={emp.nome} description={ETAPAS.find((e) => e.key === atual)?.label} className="sm:max-w-3xl">
        <div className="flex flex-col gap-6">
          <div className="flex items-start gap-3">
            <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-xs font-bold" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
              {iniciais(emp.nome)}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm break-words" style={{ color: 'var(--color-text-secondary)' }}>{dados.join(' · ')}</p>
              {emEspera && (
                <span className="inline-block mt-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}>Em espera</span>
              )}
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => router.push(`/pessoas/funcionarios/${emp.id}`)}>Ver ficha</Button>
          </div>

          {/* Entrevistas: marcar e remarcar só na etapa; o histórico aparece sempre */}
          {(naEntrevista || historico.entrevistas.length > 0) && (
            <Secao
              titulo="Entrevistas"
              acao={naEntrevista && !formEntrevista && (
                <Button type="button" variant="secondary" size="sm" onClick={() => setFormEntrevista('nova')}>Marcar entrevista</Button>
              )}
            >
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
            </Secao>
          )}

          <Secao titulo="Anotações">
            <div className="flex flex-col gap-2">
              <textarea
                aria-label="Nova anotação"
                rows={3}
                maxLength={5000}
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Como foi a entrevista, pontos fortes, combinados…"
                className="w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
              />
              <div className="flex justify-end">
                <Button type="button" variant="secondary" size="sm" onClick={salvarNota} loading={salvandoNota} disabled={!nota.trim()}>Adicionar anotação</Button>
              </div>
            </div>
            <ListaAnotacoes anotacoes={historico.anotacoes} />
          </Secao>

          {/* Carta proposta: na etapa, ou como registro depois dela */}
          {(naCarta || carta?.status === 'aceita') && (
            <Secao titulo="Carta proposta">
              <CartaProposta emp={emp} carta={carta} config={config} empresa={empresa} companyId={companyId} />
            </Secao>
          )}

          {/* Depois do aceite (ou fora da etapa da carta): o link para preencher os dados */}
          {!naEntrevista && (!naCarta || carta?.status === 'aceita') && (
            <Secao titulo="Preenchimento dos dados">
              {situacao === 'done' ? (
                <p className="text-sm" style={{ color: '#15803D' }}>Dados preenchidos em {fmtDate(token!.used_at)}.</p>
              ) : link ? (
                <div className="rounded-xl border p-3 flex flex-col gap-2" style={{ borderColor: 'var(--color-card-border)', backgroundColor: 'var(--color-brand-light)' }}>
                  <p className="text-xs break-all" style={{ color: 'var(--color-text-secondary)' }}>{link}</p>
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => copiarLink(link)}>Copiar link</Button>
                    {emp.telefone && <Button type="button" size="sm" style={{ backgroundColor: '#25D366' }} onClick={() => enviarWhatsApp(link)}>Enviar por WhatsApp</Button>}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="secondary" size="sm" onClick={gerarLink} loading={gerando}>
                    {situacao === 'none' ? 'Gerar link de preenchimento' : 'Gerar novo link'}
                  </Button>
                  {situacao === 'pending' && <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Aguardando o preenchimento.</span>}
                  {situacao === 'expired' && <span className="text-xs" style={{ color: '#B91C1C' }}>O link anterior expirou.</span>}
                </div>
              )}
            </Secao>
          )}

          {reprovando ? (
            <div className="flex flex-col gap-3 rounded-xl border p-4" style={{ borderColor: '#FCA5A5' }}>
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
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setReprovando(false)} disabled={processando}>Voltar</Button>
                <Button type="button" variant="danger" size="sm" onClick={reprovar} loading={processando}>Confirmar reprovação</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4" style={{ borderColor: 'var(--color-card-border)' }}>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="ghost" onClick={() => setReprovando(true)} disabled={processando} style={{ color: '#B91C1C' }}>Reprovar</Button>
                <Button type="button" variant="secondary" onClick={alternarEspera} disabled={processando}>{emEspera ? 'Retomar' : 'Deixar em espera'}</Button>
              </div>
              {naEntrevista ? (
                <Button type="button" onClick={aprovar} loading={processando}>Aprovar entrevista</Button>
              ) : naCarta && carta?.status !== 'aceita' ? (
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Avança quando o candidato aceitar a carta.</span>
              ) : proxima && (
                <Button type="button" onClick={avancar} loading={processando}>
                  {proxima.key === ETAPA_FINAL ? 'Finalizar admissão' : `Avançar: ${proxima.label}`}
                </Button>
              )}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!cancelar}
        onClose={() => { if (!processando) setCancelar(null) }}
        onConfirm={confirmarCancelamento}
        loading={processando}
        confirmLabel="Cancelar entrevista"
        title="Cancelar entrevista"
        message={<p>Cancelar a entrevista? O evento sai da agenda de {cancelar?.entrevistador_nome} e o candidato é avisado por e-mail.</p>}
      />
    </>
  )
}
