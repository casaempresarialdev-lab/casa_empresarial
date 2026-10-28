'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { ANTECEDENCIAS, eventoFormSchema, type EventoFormData } from '@/lib/validations/evento'
import { criarEventoAction, atualizarEventoAction } from '../actions'
import type { Evento } from '../queries'

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

function valoresIniciais(l: Evento | null, dataInicial?: Date, horaInicial?: number | null): EventoFormData {
  if (l) {
    const d = new Date(l.data_hora)
    return {
      titulo: l.titulo, descricao: l.descricao ?? '', data: paraData(d), hora: paraHora(d),
      notificar: l.notificar, antecedencia_min: l.antecedencia_min, notificar_email: l.notificar_email,
    }
  }
  // Novo: no dia escolhido no calendário (ou hoje), na hora escolhida ou na próxima hora cheia
  const agora = new Date()
  const d = dataInicial ? new Date(dataInicial) : new Date()
  d.setHours(horaInicial ?? agora.getHours() + 1, 0, 0, 0)
  return { titulo: '', descricao: '', data: paraData(d), hora: paraHora(d), notificar: true, antecedencia_min: 15, notificar_email: false }
}

// Pede permissão para as notificações do navegador (aparecem mesmo com o sistema em segundo plano)
function pedirPermissaoNavegador() {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => null)
  }
}

export function ModalEvento({ open, onClose, evento, dataInicial, horaInicial }: Props) {
  const router = useRouter()
  const isEditing = !!evento

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } =
    useForm<EventoFormData>({ resolver: zodResolver(eventoFormSchema), defaultValues: valoresIniciais(evento, dataInicial, horaInicial) })

  useEffect(() => { if (open) reset(valoresIniciais(evento, dataInicial, horaInicial)) }, [open, evento, dataInicial, horaInicial, reset])

  const notificar = watch('notificar')

  async function onSubmit(d: EventoFormData) {
    // Data e hora no fuso do usuário → ISO
    const dataHora = new Date(`${d.data}T${d.hora}:00`)
    const payload = {
      titulo: d.titulo,
      descricao: d.descricao,
      data_hora: dataHora.toISOString(),
      notificar: d.notificar,
      antecedencia_min: Number(d.antecedencia_min),
      notificar_email: d.notificar_email,
    }
    const r = await toast.promise(isEditing ? atualizarEventoAction(evento!.id, payload) : criarEventoAction(payload), {
      loading: 'Salvando evento…',
      success: isEditing ? 'Evento atualizado.' : 'Evento criado.',
      error: 'Não foi possível salvar o evento.',
    })
    if ('error' in r) return
    if (d.notificar) pedirPermissaoNavegador()
    onClose()
    router.refresh()
  }

  const labelSty = { color: 'var(--color-text-secondary)' }
  const fieldCls = 'h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]'
  const fieldSty = { borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? 'Editar evento' : 'Novo evento'} className="sm:max-w-xl">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input label="Título *" placeholder="Ex.: Pagar o aluguel, Reunião com o contador" autoFocus error={errors.titulo?.message} {...register('titulo')} />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Data *" type="date" error={errors.data?.message} {...register('data')} />
          <Input label="Hora *" type="time" error={errors.hora?.message} {...register('hora')} />
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

        {/* Notificação */}
        <div className="rounded-xl border p-4 flex flex-col gap-3" style={{ borderColor: 'var(--color-bg-surface)' }}>
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
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Avisa no sino da barra e no navegador.</span>
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
                Também por e-mail
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
