'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Accordion } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/lib/toast'
import {
  ASSUNTO_PADRAO, CAMPOS_CARTA, CAMPOS_EXAME, CAMPOS_REPROVACAO, EXAME_ASSUNTO_PADRAO, EXAME_MODELO_PADRAO, MODELO_PADRAO,
  EXAME_REPROVACAO_ASSUNTO_PADRAO, EXAME_REPROVACAO_MODELO_PADRAO,
  REPROVACAO_ASSUNTO_PADRAO, REPROVACAO_MODELO_PADRAO,
  configAdmissaoSchema, type ConfigAdmissaoInput,
} from '@/lib/validations/admissao'
import { salvarConfigAdmissaoAction } from '../actions'
import type { Clinica, ConfigAdmissao as Config } from '../../pessoas/admissao/queries'
import { ConfigExame } from './config-exame'

type CampoModelo = 'carta_modelo' | 'reprovacao_modelo' | 'exame_modelo' | 'exame_reprovacao_modelo'
type Secao = 'carta' | 'reprovacao' | 'exame' | 'exame_reprovacao'

const CAMPOS_DA_SECAO: Record<Secao, (keyof ConfigAdmissaoInput)[]> = {
  carta: ['carta_assunto', 'carta_validade_dias', 'carta_modelo'],
  reprovacao: ['reprovacao_notificar', 'reprovacao_assunto', 'reprovacao_modelo'],
  exame: ['exame_notificar', 'exame_assunto', 'exame_modelo'],
  exame_reprovacao: ['exame_reprovacao_notificar', 'exame_reprovacao_assunto', 'exame_reprovacao_modelo'],
}

// Configurações de admissão: cada assunto em uma sanfona; um único "Salvar" vale para todas
export function ConfigAdmissao({ companyId, inicial, clinicas }: { companyId: string; inicial: Config; clinicas: Clinica[] }) {
  const router = useRouter()
  const [abertas, setAbertas] = useState<Record<Secao, boolean>>({ carta: false, reprovacao: false, exame: false, exame_reprovacao: false })
  const alternar = (s: Secao) => setAbertas((a) => ({ ...a, [s]: !a[s] }))

  const modelos = useRef<Partial<Record<CampoModelo, HTMLTextAreaElement | null>>>({})
  const { register, handleSubmit, setValue, getValues, watch, formState: { errors, isSubmitting } } = useForm<ConfigAdmissaoInput>({
    resolver: zodResolver(configAdmissaoSchema),
    defaultValues: {
      carta_assunto: inicial.carta_assunto,
      carta_modelo: inicial.carta_modelo,
      carta_validade_dias: String(inicial.carta_validade_dias),
      reprovacao_notificar: inicial.reprovacao_notificar,
      reprovacao_assunto: inicial.reprovacao_assunto,
      reprovacao_modelo: inicial.reprovacao_modelo,
      exame_notificar: inicial.exame_notificar,
      exame_assunto: inicial.exame_assunto,
      exame_modelo: inicial.exame_modelo,
      exame_reprovacao_notificar: inicial.exame_reprovacao_notificar,
      exame_reprovacao_assunto: inicial.exame_reprovacao_assunto,
      exame_reprovacao_modelo: inicial.exame_reprovacao_modelo,
    },
  })
  const [validade, notificar, notificarExame, notificarExameReprov] = watch(['carta_validade_dias', 'reprovacao_notificar', 'exame_notificar', 'exame_reprovacao_notificar'])

  // Insere o campo onde está o cursor
  function inserirCampo(modelo: CampoModelo, campo: string) {
    const el = modelos.current[modelo]
    const atual = getValues(modelo)
    const inicio = el?.selectionStart ?? atual.length
    const fim = el?.selectionEnd ?? atual.length
    const trecho = `{${campo}}`
    setValue(modelo, atual.slice(0, inicio) + trecho + atual.slice(fim), { shouldDirty: true })
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

  // Campo com problema em uma seção fechada: abre a seção, senão o erro fica escondido
  function invalido(erros: FieldErrors<ConfigAdmissaoInput>) {
    setAbertas((a) => ({
      carta: a.carta || CAMPOS_DA_SECAO.carta.some((c) => erros[c]),
      reprovacao: a.reprovacao || CAMPOS_DA_SECAO.reprovacao.some((c) => erros[c]),
      exame: a.exame || CAMPOS_DA_SECAO.exame.some((c) => erros[c]),
      exame_reprovacao: a.exame_reprovacao || CAMPOS_DA_SECAO.exame_reprovacao.some((c) => erros[c]),
    }))
    toast.error('Confira os campos destacados.')
  }

  function Modelo({ nome, titulo, campos, padrao }: { nome: CampoModelo; titulo: string; campos: readonly { campo: string; descricao: string }[]; padrao: () => void }) {
    const campo = register(nome)
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor={nome} className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>{titulo}</label>
          <button type="button" onClick={padrao} className="text-xs font-medium hover:underline" style={{ color: 'var(--color-brand)' }}>Restaurar o padrão</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {campos.map((c) => (
            <button
              key={c.campo}
              type="button"
              onClick={() => inserirCampo(nome, c.campo)}
              className="text-xs px-2 py-1 rounded-md border transition-colors hover:bg-[var(--color-brand-light)]"
              style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-secondary)' }}
            >
              {c.descricao}
            </button>
          ))}
        </div>
        <textarea
          id={nome}
          rows={nome === 'carta_modelo' ? 18 : 10}
          {...campo}
          ref={(el) => { campo.ref(el); modelos.current[nome] = el }}
          className="w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
          style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
        />
        {errors[nome] && <p className="text-xs" style={{ color: 'var(--color-error)' }}>{errors[nome]?.message}</p>}
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Clique em um campo para inserir no texto. No envio, ele vira o dado do candidato ou da vaga, e o que estiver vazio aparece como &quot;A combinar&quot;.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(salvar, invalido)} noValidate className="flex flex-col gap-4">
      <Accordion
        titulo="Carta proposta"
        icone="file"
        resumo={`Modelo do e-mail e da carta · link válido por ${validade} ${validade === '1' ? 'dia' : 'dias'}`}
        aberto={abertas.carta}
        onAlternar={() => alternar('carta')}
      >
        <div className="flex flex-col gap-5">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Usado na etapa &quot;Enviar carta proposta&quot;. Antes de enviar, o texto pode ser ajustado para cada candidato.
          </p>
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
          {Modelo({
            nome: 'carta_modelo',
            titulo: 'Modelo da carta *',
            campos: CAMPOS_CARTA,
            padrao: () => { setValue('carta_modelo', MODELO_PADRAO, { shouldDirty: true }); setValue('carta_assunto', ASSUNTO_PADRAO, { shouldDirty: true }) },
          })}
        </div>
      </Accordion>

      <Accordion
        titulo="Reprovação do candidato"
        icone="mail"
        resumo={notificar ? 'O candidato recebe um e-mail ao ser reprovado' : 'O candidato não é avisado por e-mail'}
        aberto={abertas.reprovacao}
        onAlternar={() => alternar('reprovacao')}
      >
        <div className="flex flex-col gap-5">
          <label className="flex items-start gap-2.5 text-sm cursor-pointer" style={{ color: 'var(--color-text-secondary)' }}>
            <input type="checkbox" className="mt-0.5 w-4 h-4 shrink-0" style={{ accentColor: 'var(--color-brand)' }} {...register('reprovacao_notificar')} />
            <span>
              <span className="font-medium">Avisar o candidato por e-mail ao reprovar</span>
              <span className="block text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                Com esta opção ligada, o e-mail sai direto ao confirmar a reprovação. O motivo registrado não é enviado.
              </span>
            </span>
          </label>
          <Input label="Assunto do e-mail *" error={errors.reprovacao_assunto?.message} {...register('reprovacao_assunto')} />
          {Modelo({
            nome: 'reprovacao_modelo',
            titulo: 'Texto do e-mail *',
            campos: CAMPOS_REPROVACAO,
            padrao: () => { setValue('reprovacao_modelo', REPROVACAO_MODELO_PADRAO, { shouldDirty: true }); setValue('reprovacao_assunto', REPROVACAO_ASSUNTO_PADRAO, { shouldDirty: true }) },
          })}
        </div>
      </Accordion>

      <Accordion
        titulo="Exame admissional"
        icone="stethoscope"
        resumo={`${clinicas.length ? `${clinicas.length} ${clinicas.length === 1 ? 'clínica cadastrada' : 'clínicas cadastradas'}` : 'Nenhuma clínica cadastrada'} · ${notificarExame ? 'candidato avisado por e-mail' : 'sem e-mail ao candidato'}`}
        aberto={abertas.exame}
        onAlternar={() => alternar('exame')}
      >
        <div className="flex flex-col gap-5">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Usado na etapa &quot;Encaminhar para exame&quot;. Clínicas e guias são salvas na hora; o e-mail, no botão Salvar.
          </p>
          <ConfigExame
            companyId={companyId}
            clinicas={clinicas}
            guiaGeral={inicial.exame_guia_path ? { path: inicial.exame_guia_path, nome: inicial.exame_guia_nome ?? 'Guia de encaminhamento' } : null}
          />
          <div className="flex flex-col gap-5 border-t pt-4" style={{ borderColor: 'var(--color-card-border)' }}>
            <label className="flex items-start gap-2.5 text-sm cursor-pointer" style={{ color: 'var(--color-text-secondary)' }}>
              <input type="checkbox" className="mt-0.5 w-4 h-4 shrink-0" style={{ accentColor: 'var(--color-brand)' }} {...register('exame_notificar')} />
              <span>
                <span className="font-medium">Enviar o encaminhamento ao candidato por e-mail</span>
                <span className="block text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  O e-mail leva a clínica, a data e as orientações, com a guia em anexo.
                </span>
              </span>
            </label>
            <Input label="Assunto do e-mail *" error={errors.exame_assunto?.message} {...register('exame_assunto')} />
            {Modelo({
              nome: 'exame_modelo',
              titulo: 'Texto do e-mail *',
              campos: CAMPOS_EXAME,
              padrao: () => { setValue('exame_modelo', EXAME_MODELO_PADRAO, { shouldDirty: true }); setValue('exame_assunto', EXAME_ASSUNTO_PADRAO, { shouldDirty: true }) },
            })}
          </div>
        </div>
      </Accordion>

      <Accordion
        titulo="Reprovação no exame"
        icone="mail"
        resumo={notificarExameReprov ? 'O candidato recebe um e-mail ao ser reprovado no exame' : 'O candidato não é avisado por e-mail'}
        aberto={abertas.exame_reprovacao}
        onAlternar={() => alternar('exame_reprovacao')}
      >
        <div className="flex flex-col gap-5">
          <label className="flex items-start gap-2.5 text-sm cursor-pointer" style={{ color: 'var(--color-text-secondary)' }}>
            <input type="checkbox" className="mt-0.5 w-4 h-4 shrink-0" style={{ accentColor: 'var(--color-brand)' }} {...register('exame_reprovacao_notificar')} />
            <span>
              <span className="font-medium">Avisar o candidato por e-mail ao reprovar no exame</span>
              <span className="block text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                Vale quando o resultado é Inapto e a decisão é reprovar. O resultado e as observações do exame não são enviados.
              </span>
            </span>
          </label>
          <Input label="Assunto do e-mail *" error={errors.exame_reprovacao_assunto?.message} {...register('exame_reprovacao_assunto')} />
          {Modelo({
            nome: 'exame_reprovacao_modelo',
            titulo: 'Texto do e-mail *',
            campos: CAMPOS_REPROVACAO,
            padrao: () => { setValue('exame_reprovacao_modelo', EXAME_REPROVACAO_MODELO_PADRAO, { shouldDirty: true }); setValue('exame_reprovacao_assunto', EXAME_REPROVACAO_ASSUNTO_PADRAO, { shouldDirty: true }) },
          })}
        </div>
      </Accordion>
      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>Salvar</Button>
      </div>
    </form>
  )
}
