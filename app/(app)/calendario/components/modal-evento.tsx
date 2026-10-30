'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import {
  ANTECEDENCIAS, UNIDADES, DIAS_SEMANA_CURTO, DIAS_SEMANA_NOME, SEM_REPETICAO,
  duracaoEntre, horaFimDe, formatarDuracao, descreverRepeticao, rotulosAtalhos, regraDoAtalho, atalhoDaRegra, mesmaRegra,
  eventoFormSchema, type EventoFormData, type Regra, type DataBase,
} from '@/lib/validations/evento'
import { criarEventoAction, atualizarEventoAction, type Escopo } from '../actions'
import type { Evento, Pessoa, StatusConvite } from '../queries'
import { Avatar, STATUS_CONVITE } from './avatar'
import { BuscaPessoas } from './busca-pessoas'

interface Props {
  open: boolean
  onClose: () => void
  evento: Evento | null
  /** Data já escolhida no calendário (novo evento) */
  dataInicial?: Date
  /** Hora já escolhida (duplo clique num horário da visão semanal) */
  horaInicial?: number | null
}

const pad = (n: number) => String(n).padStart(2, '0')
const paraData = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const paraHora = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/** Dia da semana, dia do mês e mês da data do evento (YYYY-MM-DD) */
const dataBase = (data: string): DataBase => {
  const d = new Date(`${data}T12:00:00`)
  return { diaSemana: d.getDay(), diaMes: d.getDate(), mes: d.getMonth() }
}

/** Data final sugerida quando a repetição termina numa data: 3 meses depois do início */
const tresMesesDepois = (data: string) => {
  const [a, m, d] = data.split('-').map(Number)
  return paraData(new Date(a, m - 1 + 3, d))
}

type CamposRepeticao = Pick<EventoFormData, 'repeticao' | 'intervalo' | 'unidade' | 'dias_semana' | 'termina' | 'recorrencia_ate' | 'ocorrencias'>

/** Regra do formulário: um atalho ou o painel personalizado */
function regraDoForm(d: CamposRepeticao, b: DataBase): Regra {
  if (d.repeticao !== 'personalizado') return regraDoAtalho(d.repeticao, b)
  return {
    recorrencia: d.unidade,
    intervalo: Math.max(1, Number(d.intervalo) || 1),
    dias_semana: d.unidade === 'semanal' ? [...d.dias_semana].sort((x, y) => x - y) : null,
    recorrencia_ate: d.termina === 'em' && d.recorrencia_ate ? d.recorrencia_ate : null,
    ocorrencias: d.termina === 'apos' ? Math.max(1, Number(d.ocorrencias) || 1) : null,
  }
}

function valoresIniciais(l: Evento | null, dataInicial?: Date, horaInicial?: number | null): EventoFormData {
  if (l) {
    const d = new Date(l.data_hora)
    const data = paraData(d)
    const regra: Regra = { recorrencia: l.recorrencia, intervalo: l.intervalo ?? 1, dias_semana: l.dias_semana, recorrencia_ate: l.recorrencia_ate, ocorrencias: l.ocorrencias }
    return {
      titulo: l.titulo, descricao: l.descricao ?? '', data, hora: paraHora(d), hora_fim: horaFimDe(paraHora(d), l.duracao_min),
      notificar: l.notificar, antecedencia_min: l.antecedencia_min, notificar_email: l.notificar_email,
      local: l.local ?? '', link_reuniao: l.link_reuniao ?? '',
      repeticao: atalhoDaRegra(regra, dataBase(data)),
      intervalo: l.intervalo ?? 1,
      unidade: l.recorrencia ?? 'semanal',
      dias_semana: l.dias_semana?.length ? [...l.dias_semana] : [d.getDay()],
      termina: l.ocorrencias ? 'apos' : l.recorrencia_ate ? 'em' : 'nunca',
      recorrencia_ate: l.recorrencia_ate ?? tresMesesDepois(data),
      ocorrencias: l.ocorrencias ?? 13,
    }
  }
  // Novo: no dia escolhido no calendário (ou hoje), na hora escolhida ou na próxima hora cheia, com 1h de duração
  const agora = new Date()
  const d = dataInicial ? new Date(dataInicial) : new Date()
  d.setHours(horaInicial ?? agora.getHours() + 1, 0, 0, 0)
  return {
    titulo: '', descricao: '', data: paraData(d), hora: paraHora(d), hora_fim: horaFimDe(paraHora(d), 60),
    notificar: true, antecedencia_min: 15, notificar_email: false,
    local: '', link_reuniao: '',
    repeticao: 'nenhuma', intervalo: 1, unidade: 'semanal', dias_semana: [d.getDay()],
    termina: 'nunca', recorrencia_ate: tresMesesDepois(paraData(d)), ocorrencias: 13,
  }
}

// Pede permissão para as notificações do navegador (aparecem mesmo com o sistema em segundo plano)
function pedirPermissaoNavegador() {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => null)
  }
}

type Convidado = Pessoa & { status?: StatusConvite }

export function ModalEvento({ open, onClose, evento, dataInicial, horaInicial }: Props) {
  const router = useRouter()
  const isEditing = !!evento
  const naSerie = !!evento?.serie_id
  const [convidados, setConvidados] = useState<Convidado[]>([])
  const [escopo, setEscopo] = useState<Escopo>('este')

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } =
    useForm<EventoFormData>({ resolver: zodResolver(eventoFormSchema), defaultValues: valoresIniciais(evento, dataInicial, horaInicial) })

  useEffect(() => {
    if (!open) return
    reset(valoresIniciais(evento, dataInicial, horaInicial))
    setConvidados(evento?.participantes ?? [])
    setEscopo('este')
  }, [open, evento, dataInicial, horaInicial, reset])

  const notificar = watch('notificar')
  const data = watch('data')
  const hora = watch('hora')
  const horaFim = watch('hora_fim')
  const repeticao = watch('repeticao')
  const intervalo = watch('intervalo')
  const unidade = watch('unidade')
  const diasSemana = watch('dias_semana')
  const termina = watch('termina')
  const recorrenciaAte = watch('recorrencia_ate')
  const ocorrencias = watch('ocorrencias')

  // Duração calculada do início ao término (término antes do início = dia seguinte)
  const horarioOk = /^\d{2}:\d{2}$/.test(hora ?? '') && /^\d{2}:\d{2}$/.test(horaFim ?? '') && hora !== horaFim
  const duracao = horarioOk ? duracaoEntre(hora, horaFim) : null
  const viraDia = horarioOk && horaFim < hora

  // Repetição: atalhos com a data do evento; ao editar, se a regra mudou, a nova vale a partir deste evento
  const base = dataBase(data || paraData(new Date()))
  const regraForm = regraDoForm({ repeticao, intervalo, unidade, dias_semana: diasSemana ?? [], termina, recorrencia_ate: recorrenciaAte, ocorrencias }, base)
  const regraEvento: Regra = evento
    ? { recorrencia: evento.recorrencia, intervalo: evento.intervalo ?? 1, dias_semana: evento.dias_semana, recorrencia_ate: evento.recorrencia_ate, ocorrencias: evento.ocorrencias }
    : SEM_REPETICAO
  const mudouRegra = isEditing && !mesmaRegra(regraForm, regraEvento)
  const resumoRepeticao = descreverRepeticao(regraForm, base)
  const n = Math.max(1, Number(intervalo) || 1)

  function alternarDia(dia: number) {
    const atual = diasSemana ?? []
    setValue('dias_semana', atual.includes(dia) ? atual.filter((x) => x !== dia) : [...atual, dia].sort(), { shouldDirty: true, shouldValidate: true })
  }

  // Abrir "Personalizar…" a partir de um atalho já começa com a regra dele (como no Google)
  function aoTrocarRepeticao(nova: string) {
    if (nova !== 'personalizado' || repeticao === 'personalizado' || repeticao === 'nenhuma') return
    const r = regraDoAtalho(repeticao, base)
    if (r.recorrencia) setValue('unidade', r.recorrencia)
    setValue('intervalo', 1)
    if (r.dias_semana) setValue('dias_semana', r.dias_semana)
    setValue('termina', 'nunca')
  }

  async function onSubmit(d: EventoFormData) {
    // Data e hora no fuso do usuário → ISO; duração do início ao término
    const dataHora = new Date(`${d.data}T${d.hora}:00`)
    const regra = regraDoForm(d, dataBase(d.data))
    const payload = {
      titulo: d.titulo,
      descricao: d.descricao,
      data_hora: dataHora.toISOString(),
      duracao_min: duracaoEntre(d.hora, d.hora_fim),
      notificar: d.notificar,
      antecedencia_min: Number(d.antecedencia_min),
      notificar_email: d.notificar_email,
      local: d.local,
      link_reuniao: d.link_reuniao,
      recorrencia: regra.recorrencia ?? 'nenhuma' as const,
      intervalo: regra.intervalo,
      dias_semana: regra.dias_semana ?? undefined,
      recorrencia_ate: regra.recorrencia_ate ?? undefined,
      ocorrencias: regra.ocorrencias ?? undefined,
      convidados: convidados.map((c) => c.email),
    }
    type Resultado = { error?: string; success?: boolean; ocorrencias?: number; atualizados?: number; mudouRegra?: boolean; convites?: { enviados: number; falhas: number } }
    const acao: Promise<Resultado> = isEditing ? atualizarEventoAction(evento!.id, payload, escopo) : criarEventoAction(payload)
    const r = await toast.promise(acao, {
      loading: 'Salvando evento…',
      success: (res) => {
        if (res.mudouRegra) return res.ocorrencias ? 'Evento atualizado. A nova repetição vale a partir deste evento.' : 'Evento atualizado. Ele não se repete mais.'
        if ((res.atualizados ?? 0) > 1) return `${res.atualizados} eventos da série atualizados.`
        if ((res.ocorrencias ?? 0) > 1) return 'Evento criado com repetição.'
        return isEditing ? 'Evento atualizado.' : 'Evento criado.'
      },
      error: 'Não foi possível salvar o evento.',
    })
    if (r.error) return
    // O evento está salvo; avisa se algum convite não saiu por e-mail (o convidado vê o evento no calendário mesmo assim)
    if (r.convites?.falhas) toast.error(`${r.convites.falhas} convite(s) não puderam ser enviados por e-mail. Os convidados veem o evento no calendário.`)
    if (d.notificar) pedirPermissaoNavegador()
    onClose()
    router.refresh()
  }

  const labelSty = { color: 'var(--color-text-secondary)' }
  const fieldCls = 'h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] disabled:opacity-50 disabled:cursor-not-allowed'
  const fieldSty = { borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }
  const caixa = 'rounded-xl border p-4 flex flex-col gap-3'
  const caixaSty = { borderColor: 'var(--color-bg-surface)' }
  const tituloCaixa = (icon: 'calendar' | 'users' | 'bell' | 'external', texto: string) => (
    <p className="flex items-center gap-2 text-sm font-semibold" style={labelSty}>
      <span style={{ color: 'var(--color-brand)' }}><Icon name={icon} size={16} /></span>
      {texto}
    </p>
  )
  const erroCampo = (msg?: string) => msg && <p className="text-xs" style={{ color: 'var(--color-error)' }}>{msg}</p>

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? 'Editar evento' : 'Novo evento'} className="sm:max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input label="Título *" placeholder="Ex.: Pagar o aluguel, Reunião com o contador" autoFocus error={errors.titulo?.message} {...register('titulo')} />

        {/* Quando: data, início e término (a duração é calculada) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <Input label="Data *" type="date" error={errors.data?.message} {...register('data')} />
          </div>
          <Input label="Início *" type="time" error={errors.hora?.message} {...register('hora')} />
          <Input
            label="Término *"
            type="time"
            error={errors.hora_fim?.message}
            hint={duracao ? `Duração: ${formatarDuracao(duracao)}${viraDia ? ' · termina no dia seguinte' : ''}` : undefined}
            {...register('hora_fim')}
          />
        </div>

        {/* Repetição (estilo Google Agenda): atalhos para a data do evento ou personalizada */}
        <div className={caixa} style={caixaSty}>
          {tituloCaixa('calendar', 'Repetição')}
          <select
            aria-label="Repetir"
            className={fieldCls}
            style={fieldSty}
            {...register('repeticao', { onChange: (ev) => aoTrocarRepeticao(ev.target.value) })}
          >
            {rotulosAtalhos(base).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* Personalizada: a cada N …, repetir em (dias), termina */}
          {repeticao === 'personalizado' && (
            <div className="rounded-xl p-4 flex flex-col gap-4" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm" style={labelSty}>Repetir a cada</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  aria-label="Intervalo"
                  className="h-10 w-16 rounded-lg border px-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                  style={fieldSty}
                  {...register('intervalo', { valueAsNumber: true })}
                />
                <select aria-label="Unidade" className="h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]" style={fieldSty} {...register('unidade')}>
                  {UNIDADES.map((u) => <option key={u.value} value={u.value}>{n > 1 ? u.plural : u.singular}</option>)}
                </select>
              </div>
              {erroCampo(errors.intervalo?.message)}

              {unidade === 'semanal' && (
                <div className="flex flex-col gap-2">
                  <span className="text-sm" style={labelSty}>Repetir em</span>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Dias da semana">
                    {DIAS_SEMANA_CURTO.map((letra, dia) => {
                      const marcado = (diasSemana ?? []).includes(dia)
                      return (
                        <button
                          key={dia}
                          type="button"
                          onClick={() => alternarDia(dia)}
                          aria-pressed={marcado}
                          aria-label={DIAS_SEMANA_NOME[dia]}
                          title={DIAS_SEMANA_NOME[dia]}
                          className="w-9 h-9 rounded-full text-xs font-bold cursor-pointer transition-colors"
                          style={marcado
                            ? { backgroundColor: 'var(--color-brand)', color: '#fff' }
                            : { backgroundColor: '#fff', color: 'var(--color-text-secondary)' }}
                        >
                          {letra}
                        </button>
                      )
                    })}
                  </div>
                  {erroCampo(errors.dias_semana?.message)}
                </div>
              )}

              {/* Termina: nunca, em uma data ou após N ocorrências */}
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm mb-1" style={labelSty}>Termina</legend>
                <label className="flex items-center gap-3 h-10 text-sm cursor-pointer select-none" style={{ color: 'var(--color-text-primary)' }}>
                  <input type="radio" value="nunca" className="h-4 w-4 cursor-pointer" style={{ accentColor: 'var(--color-brand)' }} {...register('termina')} />
                  Nunca
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-3 w-20 text-sm cursor-pointer select-none" style={{ color: 'var(--color-text-primary)' }}>
                    <input type="radio" value="em" className="h-4 w-4 cursor-pointer" style={{ accentColor: 'var(--color-brand)' }} {...register('termina')} />
                    Em
                  </label>
                  <input
                    type="date"
                    min={data}
                    aria-label="Data final"
                    disabled={termina !== 'em'}
                    className={cn(fieldCls, 'max-w-48')}
                    style={fieldSty}
                    {...register('recorrencia_ate')}
                  />
                </div>
                {termina === 'em' && erroCampo(errors.recorrencia_ate?.message)}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-3 w-20 text-sm cursor-pointer select-none" style={{ color: 'var(--color-text-primary)' }}>
                    <input type="radio" value="apos" className="h-4 w-4 cursor-pointer" style={{ accentColor: 'var(--color-brand)' }} {...register('termina')} />
                    Após
                  </label>
                  <div className={cn('flex items-center gap-2', termina !== 'apos' && 'opacity-50')}>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      aria-label="Número de ocorrências"
                      disabled={termina !== 'apos'}
                      className="h-10 w-20 rounded-lg border px-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] disabled:cursor-not-allowed"
                      style={fieldSty}
                      {...register('ocorrencias', { valueAsNumber: true })}
                    />
                    <span className="text-sm" style={labelSty}>{Number(ocorrencias) === 1 ? 'ocorrência' : 'ocorrências'}</span>
                  </div>
                </div>
                {termina === 'apos' && erroCampo(errors.ocorrencias?.message)}
              </fieldset>
            </div>
          )}

          {resumoRepeticao && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{resumoRepeticao}</p>}

          {/* Editando: regra nova → vale daqui em diante; mesma regra num evento da série → escolhe o alcance */}
          {isEditing && mudouRegra && (
            <p className="text-xs rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
              {!regraForm.recorrencia
                ? 'Este evento deixará de se repetir; os próximos da série serão removidos.'
                : naSerie
                  ? 'A nova repetição vale a partir deste evento: os próximos da série serão recriados com ela.'
                  : 'Este evento passará a ser o primeiro da repetição.'}
            </p>
          )}
          {isEditing && naSerie && !mudouRegra && (
            <div className="flex flex-col gap-2">
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Este evento faz parte de uma série. Aplicar as alterações em:</p>
              <div className="flex flex-wrap gap-2">
                {([['este', 'Somente este evento'], ['proximos', 'Este e os próximos']] as const).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setEscopo(v)}
                    aria-pressed={escopo === v}
                    className="h-9 px-3 rounded-lg text-sm font-semibold border cursor-pointer transition-colors"
                    style={escopo === v
                      ? { backgroundColor: 'var(--color-brand)', borderColor: 'var(--color-brand)', color: '#fff' }
                      : { borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Local: endereço (presencial) e/ou link da reunião (online); os dois preenchidos = híbrido */}
        <div className={caixa} style={caixaSty}>
          {tituloCaixa('external', 'Local')}
          <Input label="Endereço (presencial)" placeholder="Ex.: Escritório, Rua das Flores, 123 — sala 4" error={errors.local?.message} {...register('local')} />
          <Input label="Link da reunião (online)" type="url" placeholder="https://meet.google.com/… ou https://teams.microsoft.com/…" error={errors.link_reuniao?.message} {...register('link_reuniao')} />
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Preencha um, os dois (reunião híbrida) ou nenhum.</p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="evento-descricao" className="text-sm font-medium" style={labelSty}>Descrição</label>
          <textarea
            id="evento-descricao"
            rows={3}
            placeholder="Detalhes (opcional)"
            className="w-full rounded-lg border px-3 py-2 text-sm resize-none placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
            style={fieldSty}
            {...register('descricao')}
          />
        </div>

        {/* Convidados: usuários do sistema; recebem o convite por e-mail e veem o evento no calendário */}
        <div className={caixa} style={caixaSty}>
          {tituloCaixa('users', 'Convidados')}
          {/* Pesquisa pelo nome ou e-mail; ao escolher, o convidado entra na lista abaixo */}
          <BuscaPessoas excluir={convidados.map((c) => c.id)} onAdicionar={(p) => setConvidados((l) => [...l, p])} />

          {convidados.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {convidados.map((c) => (
                <li key={c.id} className="flex items-center gap-3">
                  <Avatar nome={c.nome} url={c.avatar_url} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{c.nome}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{c.email}</p>
                  </div>
                  {c.status && (
                    <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={STATUS_CONVITE[c.status].estilo}>{STATUS_CONVITE[c.status].label}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setConvidados((l) => l.filter((x) => x.id !== c.id))}
                    aria-label={`Remover ${c.nome}`}
                    title="Remover convidado"
                    className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center hover:bg-gray-100 cursor-pointer"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Ninguém convidado. Os convidados recebem o convite por e-mail e veem o evento no calendário.</p>
          )}
        </div>

        {/* Notificação */}
        <div className={caixa} style={caixaSty}>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <span
              onClick={() => setValue('notificar', !notificar, { shouldDirty: true })}
              className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${notificar ? 'bg-[var(--color-brand)]' : 'bg-gray-200'}`}
              role="switch"
              aria-checked={notificar}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${notificar ? 'translate-x-5' : 'translate-x-1'}`} />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-medium" style={labelSty}>Notificar</span>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Avisa no sino da barra e no navegador (você e os convidados).</span>
            </span>
          </label>

          {notificar && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:items-end">
              <div className="flex flex-col gap-1">
                <label htmlFor="evento-antecedencia" className="text-sm font-medium" style={labelSty}>Quando avisar</label>
                <select id="evento-antecedencia" className={fieldCls} style={fieldSty} {...register('antecedencia_min', { valueAsNumber: true })}>
                  {ANTECEDENCIAS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 h-10 text-sm cursor-pointer select-none" style={labelSty}>
                <input type="checkbox" className="h-4 w-4 cursor-pointer" style={{ accentColor: 'var(--color-brand)' }} {...register('notificar_email')} />
                Também por e-mail (para você)
              </label>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={isSubmitting}>{isEditing ? 'Salvar' : 'Criar evento'}</Button>
        </div>
      </form>
    </Modal>
  )
}
