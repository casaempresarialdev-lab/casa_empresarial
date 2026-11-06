'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { toast } from '@/lib/toast'
import { exameSchema, fmtDataHora, isoParaCampos, type ExameInput } from '@/lib/validations/admissao'
import { encaminharExameAction, getAsoUrlAction } from '../../actions'
import type { Clinica, ConfigAdmissao, Exame } from '../../queries'

const STATUS: Record<Exame['status'], { texto: string; fundo: string; cor: string }> = {
  encaminhado: { texto: 'Encaminhado', fundo: '#DBEAFE', cor: '#1D4ED8' },
  realizado: { texto: 'Realizado', fundo: '#DCFCE7', cor: '#15803D' },
  substituido: { texto: 'Substituído', fundo: '#F3F4F6', cor: '#6B7280' },
}

const RESULTADO = {
  apto: { texto: 'Apto', fundo: '#DCFCE7', cor: '#15803D' },
  inapto: { texto: 'Inapto', fundo: '#FEE2E2', cor: '#B91C1C' },
}

/** "2026-11-12" → "12/11/2026" */
const fmtData = (d: string) => d.split('-').reverse().join('/')

/** "Marcado para 12/11/2026 às 08:00" ou ordem de chegada */
export const quandoExame = (e: Pick<Exame, 'data_hora'>) => e.data_hora ? `Marcado para ${fmtDataHora(e.data_hora)}` : 'Por ordem de chegada'

function FormExame({ clinicas, atual, enviando, emailLigado, temEmail, onSalvar, onCancelar }: {
  clinicas: Clinica[]
  atual: Exame | null
  enviando: boolean
  emailLigado: boolean
  temEmail: boolean
  onSalvar: (d: ExameInput) => void
  onCancelar: () => void
}) {
  const inicialClinica = clinicas.find((c) => c.id === atual?.clinic_id) ?? (clinicas.length === 1 ? clinicas[0] : null)
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<ExameInput>({
    resolver: zodResolver(exameSchema),
    defaultValues: {
      clinic_id: inicialClinica?.id ?? '',
      ...(atual?.data_hora ? isoParaCampos(atual.data_hora) : { data: '', hora: '' }),
      orientacoes: atual?.orientacoes ?? inicialClinica?.orientacoes ?? '',
    },
  })
  const clinica = register('clinic_id')

  return (
    <form onSubmit={handleSubmit(onSalvar)} noValidate className="flex flex-col gap-3 rounded-xl border p-4" style={{ borderColor: 'var(--color-card-border)', backgroundColor: '#FAFAFA' }}>
      <Select
        label="Clínica *"
        placeholder="Selecionar..."
        options={clinicas.map((c) => ({ value: c.id, label: c.nome }))}
        error={errors.clinic_id?.message}
        {...clinica}
        // Trocou a clínica: as orientações passam a ser as dela
        onChange={(e) => { clinica.onChange(e); setValue('orientacoes', clinicas.find((c) => c.id === e.target.value)?.orientacoes ?? '') }}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Data" type="date" error={errors.data?.message} {...register('data')} />
        <Input label="Hora" type="time" error={errors.hora?.message} {...register('hora')} />
      </div>
      <p className="text-xs -mt-1" style={{ color: 'var(--color-text-muted)' }}>Sem data e hora, o candidato é orientado a ir por ordem de chegada.</p>
      <div className="flex flex-col gap-1">
        <label htmlFor="exame-orientacoes" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Orientações ao candidato</label>
        <textarea
          id="exame-orientacoes"
          rows={3}
          {...register('orientacoes')}
          className="w-full rounded-lg border px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
          style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
        />
        {errors.orientacoes && <p className="text-xs" style={{ color: 'var(--color-error)' }}>{errors.orientacoes.message}</p>}
      </div>
      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {!emailLigado
          ? 'O envio de e-mail está desligado nas Configurações: combine o exame com o candidato por outro meio.'
          : temEmail
            ? 'O candidato recebe a clínica, a data e as orientações por e-mail, com a guia de encaminhamento em anexo.'
            : 'O candidato não tem e-mail cadastrado: combine o exame por outro meio.'}
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancelar} disabled={enviando}>Cancelar</Button>
        <Button type="submit" size="sm" loading={enviando}>{atual ? 'Reencaminhar' : 'Encaminhar candidato'}</Button>
      </div>
    </form>
  )
}

// Etapa "Encaminhar para exame": escolher a clínica e avisar o candidato. Encaminhado, o card segue para o resultado,
// onde ainda dá para reencaminhar (exame remarcado ou em outra clínica).
export function ExameAdmissao({ exames, clinicas, config, temEmail, naEtapa, companyId, employeeId }: {
  exames: Exame[]
  clinicas: Clinica[]
  config: ConfigAdmissao
  temEmail: boolean
  naEtapa: boolean
  companyId: string
  employeeId: string
}) {
  const router = useRouter()
  const [formAberto, setFormAberto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const atual = exames.find((e) => e.status === 'encaminhado') ?? null

  async function verAso(exameId: string) {
    const r = await getAsoUrlAction(companyId, exameId)
    if (!('url' in r) || !r.url) { toast.error(('error' in r && r.error) || 'Não foi possível abrir o ASO.'); return }
    window.open(r.url, '_blank', 'noopener')
  }

  async function encaminhar(d: ExameInput) {
    setEnviando(true)
    const r = await toast.promise(encaminharExameAction(companyId, employeeId, d), {
      loading: 'Encaminhando…',
      success: (res) => {
        const avisado = 'email' in res && res.email === 'enviado' ? ' e avisado por e-mail' : ''
        return 'reencaminhando' in res && res.reencaminhando ? `Candidato reencaminhado${avisado}.` : `Candidato encaminhado${avisado}. O card seguiu para "Registrar resultado do exame".`
      },
      error: 'Não foi possível encaminhar.',
    })
    setEnviando(false)
    if ('error' in r) return
    if (r.email === 'falhou') toast.error('O e-mail para o candidato não foi enviado. Avise por outro meio.')
    setFormAberto(false)
    router.refresh()
  }

  if (naEtapa && clinicas.length === 0 && !atual) {
    return (
      <p className="text-sm rounded-lg border border-dashed px-4 py-5 text-center" style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-muted)' }}>
        Nenhuma clínica cadastrada. Cadastre em{' '}
        <Link href="/configuracoes" className="font-semibold hover:underline" style={{ color: 'var(--color-brand)' }}>Configurações → Admissão → Exame admissional</Link>
        {' '}para encaminhar o candidato.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {naEtapa && !formAberto && (
        <div className="flex justify-end">
          <Button type="button" variant="secondary" size="sm" onClick={() => setFormAberto(true)}>{atual ? 'Reencaminhar' : 'Encaminhar para exame'}</Button>
        </div>
      )}
      {formAberto && (
        <FormExame
          clinicas={clinicas}
          atual={atual}
          enviando={enviando}
          emailLigado={config.exame_notificar}
          temEmail={temEmail}
          onSalvar={encaminhar}
          onCancelar={() => setFormAberto(false)}
        />
      )}

      {exames.length > 0 && (
        <ul className="flex flex-col gap-2">
          {exames.map((e) => {
            const s = e.resultado ? RESULTADO[e.resultado] : STATUS[e.status]
            return (
              <li key={e.id} className="rounded-lg border px-4 py-3 flex flex-col gap-1" style={{ borderColor: 'var(--color-card-border)', opacity: e.status === 'substituido' ? 0.6 : 1 }}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold flex-1 min-w-0" style={{ color: 'var(--color-text-primary)' }}>{e.clinica_nome}</p>
                  {e.aso_path && <Button type="button" variant="ghost" size="sm" onClick={() => verAso(e.id)}>Ver ASO</Button>}
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: s.fundo, color: s.cor }}>{s.texto}</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {e.resultado_data
                    ? `Exame em ${fmtData(e.resultado_data)}${e.resultado_por ? ` · resultado registrado por ${e.resultado_por}` : ''}`
                    : quandoExame(e)}
                </p>
                {e.resultado_observacoes && <p className="text-xs whitespace-pre-line" style={{ color: 'var(--color-text-secondary)' }}>Observações: {e.resultado_observacoes}</p>}
                {(e.clinica_endereco || e.clinica_telefone) && (
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{[e.clinica_endereco, e.clinica_telefone].filter(Boolean).join(' · ')}</p>
                )}
                {e.orientacoes && <p className="text-xs whitespace-pre-line" style={{ color: 'var(--color-text-muted)' }}>{e.orientacoes}</p>}
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Encaminhado em {fmtDataHora(e.created_at)}{e.email_enviado ? ' · candidato avisado por e-mail' : ''}
                </p>
              </li>
            )
          })}
        </ul>
      )}

    </div>
  )
}
