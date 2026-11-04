'use client'

import { useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/lib/toast'
import { ASSUNTO_PADRAO, CAMPOS_CARTA, MODELO_PADRAO, configAdmissaoSchema, type ConfigAdmissaoInput } from '@/lib/validations/admissao'
import { salvarConfigAdmissaoAction } from '../actions'

interface Props {
  companyId: string
  inicial: { carta_assunto: string; carta_modelo: string; carta_validade_dias: number }
}

// Configurações de admissão: por enquanto, a carta proposta
export function ConfigAdmissao({ companyId, inicial }: Props) {
  const router = useRouter()
  const modeloRef = useRef<HTMLTextAreaElement | null>(null)
  const { register, handleSubmit, setValue, getValues, formState: { errors, isSubmitting } } = useForm<ConfigAdmissaoInput>({
    resolver: zodResolver(configAdmissaoSchema),
    defaultValues: {
      carta_assunto: inicial.carta_assunto,
      carta_modelo: inicial.carta_modelo,
      carta_validade_dias: String(inicial.carta_validade_dias),
    },
  })
  const campoModelo = register('carta_modelo')

  // Insere o campo onde está o cursor
  function inserirCampo(campo: string) {
    const el = modeloRef.current
    const atual = getValues('carta_modelo')
    const inicio = el?.selectionStart ?? atual.length
    const fim = el?.selectionEnd ?? atual.length
    const trecho = `{${campo}}`
    setValue('carta_modelo', atual.slice(0, inicio) + trecho + atual.slice(fim), { shouldDirty: true })
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(inicio + trecho.length, inicio + trecho.length)
    })
  }

  async function salvar(d: ConfigAdmissaoInput) {
    const r = await toast.promise(salvarConfigAdmissaoAction(companyId, d), {
      loading: 'Salvando as configurações…',
      success: 'Configurações de admissão salvas.',
      error: 'Não foi possível salvar.',
    })
    if (!('error' in r)) router.refresh()
  }

  return (
    <div className="app-card p-6">
      <form onSubmit={handleSubmit(salvar)} noValidate className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>Carta proposta</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Modelo usado na etapa &quot;Enviar carta proposta&quot;. Antes de enviar, o texto pode ser ajustado para cada candidato.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <Input label="Assunto do e-mail *" error={errors.carta_assunto?.message} {...register('carta_assunto')} />
          </div>
          <Input
            label="Validade do link (dias) *"
            type="number"
            min={1}
            max={60}
            hint="Prazo para o candidato responder."
            error={errors.carta_validade_dias?.message}
            {...register('carta_validade_dias')}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="carta-modelo" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Modelo da carta *</label>
            <button
              type="button"
              onClick={() => { setValue('carta_modelo', MODELO_PADRAO, { shouldDirty: true }); setValue('carta_assunto', ASSUNTO_PADRAO, { shouldDirty: true }) }}
              className="text-xs font-medium hover:underline"
              style={{ color: 'var(--color-brand)' }}
            >
              Restaurar o padrão
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CAMPOS_CARTA.map((c) => (
              <button
                key={c.campo}
                type="button"
                title={c.descricao}
                onClick={() => inserirCampo(c.campo)}
                className="text-xs px-2 py-1 rounded-md border transition-colors hover:bg-[var(--color-brand-light)]"
                style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-secondary)' }}
              >
                {c.descricao}
              </button>
            ))}
          </div>
          <textarea
            id="carta-modelo"
            rows={18}
            {...campoModelo}
            ref={(el) => { campoModelo.ref(el); modeloRef.current = el }}
            className="w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
            style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
          />
          {errors.carta_modelo && <p className="text-xs" style={{ color: 'var(--color-error)' }}>{errors.carta_modelo.message}</p>}
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Clique em um campo para inserir no texto. Na carta, ele vira o dado do candidato ou da vaga, e o que estiver vazio aparece como &quot;A combinar&quot;.
          </p>
        </div>

        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting}>Salvar</Button>
        </div>
      </form>
    </div>
  )
}
