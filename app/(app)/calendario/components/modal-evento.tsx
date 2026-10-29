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
import { ANTECEDENCIAS, RECORRENCIAS, duracaoDoCampo, duracaoParaCampo, eventoFormSchema, type EventoFormData } from '@/lib/validations/evento'
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
const SEMANA_LONGA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/** Repetir até: 3 meses depois do início, por padrão */
const tresMesesDepois = (data: string) => {
  const [a, m, d] = data.split('-').map(Number)
  return paraData(new Date(a, m - 1 + 3, d))
}

function valoresIniciais(l: Evento | null, dataInicial?: Date, horaInicial?: number | null): EventoFormData {
  if (l) {
    const d = new Date(l.data_hora)
    return {
      titulo: l.titulo, descricao: l.descricao ?? '', data: paraData(d), hora: paraHora(d), duracao: duracaoParaCampo(l.duracao_min),
      notificar: l.notificar, antecedencia_min: l.antecedencia_min, notificar_email: l.notificar_email,
      local: l.local ?? '', link_reuniao: l.link_reuniao ?? '',
      recorrencia: l.recorrencia ?? 'nenhuma', recorrencia_ate: l.recorrencia_ate ?? undefined,
    }
  }
  // Novo: no dia escolhido no calendário (ou hoje), na hora escolhida ou na próxima hora cheia
  const agora = new Date()
  const d = dataInicial ? new Date(dataInicial) : new Date()
  d.setHours(horaInicial ?? agora.getHours() + 1, 0, 0, 0)
  return {
    titulo: '', descricao: '', data: paraData(d), hora: paraHora(d), duracao: '01:00',
    notificar: true, antecedencia_min: 15, notificar_email: false,
    local: '', link_reuniao: '',
    recorrencia: 'nenhuma', recorrencia_ate: tresMesesDepois(paraData(d)),
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
  const recorrencia = watch('recorrencia')
  const data = watch('data')
  const diaSemana = data ? SEMANA_LONGA[new Date(`${data}T12:00:00`).getDay()] : ''
  const diaMes = data ? Number(data.slice(8, 10)) : 0
  // Término (início + duração), mostrado abaixo do campo de duração
  const hora = watch('hora')
  const duracao = watch('duracao')
  const termino = (() => {
    if (!data || !/^\d{2}:\d{2}$/.test(hora ?? '') || !/^\d{1,2}:\d{2}$/.test(duracao ?? '')) return null
    const min = duracaoDoCampo(duracao)
    if (min <= 0) return null
    const fim = new Date(new Date(`${data}T${hora}:00`).getTime() + min * 60_000)
    return paraData(fim) === data ? paraHora(fim) : `${paraHora(fim)} do dia seguinte`
  })()

  async function onSubmit(d: EventoFormData) {
    // Data e hora no fuso do usuário → ISO
    const dataHora = new Date(`${d.data}T${d.hora}:00`)
    const payload = {
      titulo: d.titulo,
      descricao: d.descricao,
      data_hora: dataHora.toISOString(),
      duracao_min: duracaoDoCampo(d.duracao),
      notificar: d.notificar,
      antecedencia_min: Number(d.antecedencia_min),
      notificar_email: d.notificar_email,
      local: d.local,
      link_reuniao: d.link_reuniao,
      recorrencia: isEditing ? 'nenhuma' as const : d.recorrencia, // a repetição só é definida ao criar
      recorrencia_ate: isEditing || d.recorrencia === 'nenhuma' ? undefined : d.recorrencia_ate,
      convidados: convidados.map((c) => c.email),
    }
    type Resultado = { error?: string; success?: boolean; ocorrencias?: number; atualizados?: number; convites?: { enviados: number; falhas: number } }
    const acao: Promise<Resultado> = isEditing ? atualizarEventoAction(evento!.id, payload, escopo) : criarEventoAction(payload)
    const r = await toast.promise(acao, {
      loading: 'Salvando evento…',
      success: (res) => {
        if ((res.atualizados ?? 0) > 1) return `${res.atualizados} eventos da série atualizados.`
        if ((res.ocorrencias ?? 0) > 1) return `Evento criado com ${res.ocorrencias} repetições.`
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
  const fieldCls = 'h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] disabled:opacity-60 disabled:cursor-not-allowed'
  const fieldSty = { borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }
  const caixa = 'rounded-xl border p-4 flex flex-col gap-3'
  const caixaSty = { borderColor: 'var(--color-bg-surface)' }
  const tituloCaixa = (icon: 'calendar' | 'users' | 'bell' | 'external', texto: string) => (
    <p className="flex items-center gap-2 text-sm font-semibold" style={labelSty}>
      <span style={{ color: 'var(--color-brand)' }}><Icon name={icon} size={16} /></span>
      {texto}
    </p>
  )

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? 'Editar evento' : 'Novo evento'} className="sm:max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input label="Título *" placeholder="Ex.: Pagar o aluguel, Reunião com o contador" autoFocus error={errors.titulo?.message} {...register('titulo')} />

        {/* Quando: data, início e duração */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Input label="Data *" type="date" error={errors.data?.message} {...register('data')} />
          <Input label="Início *" type="time" error={errors.hora?.message} {...register('hora')} />
          {/* Duração em horas e minutos, livre (ex.: 01:30); mostra o horário de término */}
          <div className="col-span-2 sm:col-span-1">
            <Input
              label="Duração *"
              type="time"
              min="00:05"
              error={errors.duracao?.message}
              hint={termino ? `Termina às ${termino}` : undefined}
              {...register('duracao')}
            />
          </div>
        </div>

        {/* Repetição: definida ao criar; ao editar um evento da série, escolhe se vale só para ele ou para os próximos */}
        <div className={caixa} style={caixaSty}>
          {tituloCaixa('calendar', 'Repetição')}
          {isEditing ? (
            naSerie ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Este evento faz parte de uma série ({RECORRENCIAS.find((o) => o.value === evento?.recorrencia)?.label.toLowerCase()}). Aplicar as alterações em:
                </p>
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
            ) : (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Não se repete. A repetição é escolhida ao criar o evento.</p>
            )
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:items-start">
              <div className="flex flex-col gap-1">
                <label htmlFor="evento-recorrencia" className="text-sm font-medium" style={labelSty}>Repetir</label>
                <select id="evento-recorrencia" className={fieldCls} style={fieldSty} {...register('recorrencia')}>
                  {RECORRENCIAS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.value === 'semanal' && diaSemana ? `Toda semana (${diaSemana})` : o.value === 'mensal' && diaMes ? `Todo mês (dia ${diaMes})` : o.label}
                    </option>
                  ))}
                </select>
              </div>
              {recorrencia !== 'nenhuma' && (
                <Input label="Até *" type="date" min={data} hint="Até 366 repetições" error={errors.recorrencia_ate?.message} {...register('recorrencia_ate')} />
              )}
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
