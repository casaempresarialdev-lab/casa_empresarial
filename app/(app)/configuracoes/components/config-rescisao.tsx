'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Accordion } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/lib/toast'
import {
  CAMPOS_EXAME_DEMISSIONAL, EXAME_DEMISSIONAL_ASSUNTO_PADRAO, EXAME_DEMISSIONAL_MODELO_PADRAO,
  configRescisaoSchema, type ConfigRescisaoInput,
} from '@/lib/validations/rescisao'
import { salvarConfigRescisaoAction } from '../actions'
import type { ConfigRescisao as Config } from '../../pessoas/rescisao/queries'
import { ConfigEtapas } from './config-etapas'

// Configurações da rescisão: as etapas (salvas no botão próprio) e o e-mail do exame demissional
export function ConfigRescisao({ companyId, inicial, clinicas }: { companyId: string; inicial: Config; clinicas: number }) {
  const router = useRouter()
  const [exameAberto, setExameAberto] = useState(false)
  const modeloRef = useRef<HTMLTextAreaElement | null>(null)

  const { register, handleSubmit, setValue, getValues, watch, formState: { errors, isSubmitting } } = useForm<ConfigRescisaoInput>({
    resolver: zodResolver(configRescisaoSchema),
    defaultValues: { exame_notificar: inicial.exame_notificar, exame_assunto: inicial.exame_assunto, exame_modelo: inicial.exame_modelo },
  })
  const notificar = watch('exame_notificar')
  const modelo = register('exame_modelo')

  // Insere o campo onde está o cursor
  function inserirCampo(campo: string) {
    const el = modeloRef.current
    const atual = getValues('exame_modelo')
    const inicio = el?.selectionStart ?? atual.length
    const fim = el?.selectionEnd ?? atual.length
    const trecho = `{${campo}}`
    setValue('exame_modelo', atual.slice(0, inicio) + trecho + atual.slice(fim), { shouldDirty: true })
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(inicio + trecho.length, inicio + trecho.length) })
  }

  async function salvar(d: ConfigRescisaoInput) {
    const r = await toast.promise(salvarConfigRescisaoAction(companyId, d), {
      loading: 'Salvando…',
      success: 'Configurações da rescisão salvas.',
      error: 'Não foi possível salvar.',
    })
    if (!('error' in r)) router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <ConfigEtapas companyId={companyId} inicial={inicial.etapas} processo="rescisao" />

      <form onSubmit={handleSubmit(salvar, () => { setExameAberto(true); toast.error('Confira os campos destacados.') })} noValidate>
        <Accordion
          titulo="Exame demissional"
          icone="stethoscope"
          resumo={`${clinicas ? `${clinicas} ${clinicas === 1 ? 'clínica cadastrada' : 'clínicas cadastradas'}` : 'Nenhuma clínica cadastrada'} · ${notificar ? 'funcionário avisado por e-mail' : 'sem e-mail ao funcionário'}`}
          aberto={exameAberto}
          onAlternar={() => setExameAberto((a) => !a)}
        >
          <div className="flex flex-col gap-5">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Usado na etapa &quot;Encaminhar para exame demissional&quot;. As clínicas e a guia de encaminhamento são as mesmas da aba Admissão.
            </p>
            <label className="flex items-start gap-2.5 text-sm cursor-pointer" style={{ color: 'var(--color-text-secondary)' }}>
              <input type="checkbox" className="mt-0.5 w-4 h-4 shrink-0" style={{ accentColor: 'var(--color-brand)' }} {...register('exame_notificar')} />
              <span>
                <span className="font-medium">Enviar o encaminhamento ao funcionário por e-mail</span>
                <span className="block text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>O e-mail leva a clínica, a data e as orientações, com a guia em anexo.</span>
              </span>
            </label>
            <Input label="Assunto do e-mail *" error={errors.exame_assunto?.message} {...register('exame_assunto')} />
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="rescisao-exame-modelo" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Texto do e-mail *</label>
                <button
                  type="button"
                  onClick={() => { setValue('exame_modelo', EXAME_DEMISSIONAL_MODELO_PADRAO, { shouldDirty: true }); setValue('exame_assunto', EXAME_DEMISSIONAL_ASSUNTO_PADRAO, { shouldDirty: true }) }}
                  className="text-xs font-medium hover:underline"
                  style={{ color: 'var(--color-brand)' }}
                >
                  Restaurar o padrão
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CAMPOS_EXAME_DEMISSIONAL.map((c) => (
                  <button key={c.campo} type="button" onClick={() => inserirCampo(c.campo)}
                    className="text-xs px-2 py-1 rounded-md border transition-colors hover:bg-[var(--color-brand-light)]"
                    style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-secondary)' }}>
                    {c.descricao}
                  </button>
                ))}
              </div>
              <textarea
                id="rescisao-exame-modelo"
                rows={10}
                {...modelo}
                ref={(el) => { modelo.ref(el); modeloRef.current = el }}
                className="w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
              />
              {errors.exame_modelo && <p className="text-xs" style={{ color: 'var(--color-error)' }}>{errors.exame_modelo.message}</p>}
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={isSubmitting}>Salvar</Button>
            </div>
          </div>
        </Accordion>
      </form>
    </div>
  )
}
