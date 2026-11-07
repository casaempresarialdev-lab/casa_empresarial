'use client'

import { useState } from 'react'
import { useForm, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Stepper, Tabs } from '@/components/ui/form-steps'
import { toast } from '@/lib/toast'
import { vagaSchema, type VagaInput } from '@/lib/validations/vaga'
import { salvarVagaAction } from '../actions'
import type { Vaga } from '../queries'
import type { CompanyBenefit } from '../../beneficios/queries'
import { TIPO_OPTIONS, fmtMoney, isPjOuAutonomo, maskMoeda } from '../../funcionarios/components/ficha/ficha-config'

// Etapas no cadastro, abas na edição
const ETAPAS: { label: string; campos: (keyof VagaInput)[] }[] = [
  { label: 'Dados da vaga', campos: ['titulo', 'descricao', 'cargo', 'departamento', 'local_trabalho'] },
  { label: 'Contratação', campos: ['tipo_contrato', 'salario', 'exibir_salario', 'benefit_ids'] },
  { label: 'Publicação', campos: ['posicoes', 'data_limite'] },
]

interface Props {
  companyId: string
  vaga: Vaga | null
  companyBenefits: CompanyBenefit[]
  /** Abas antes das do formulário, na edição (ex.: Candidaturas, que salvam na hora) */
  abasExtras?: { label: string; content: React.ReactNode }[]
  /** Abre direto nas abas do formulário */
  abrirDados?: boolean
  /** Botões na mesma linha das abas, à direita */
  acoes?: React.ReactNode
  onCancel: () => void
  onSaved: (id: string) => void
}

function valoresIniciais(v: Vaga | null): VagaInput {
  return {
    titulo: v?.titulo ?? '',
    descricao: v?.descricao ?? '',
    cargo: v?.cargo ?? '',
    departamento: v?.departamento ?? '',
    local_trabalho: v?.local_trabalho ?? '',
    tipo_contrato: (v?.tipo_contrato ?? '') as VagaInput['tipo_contrato'],
    salario: v?.salario != null ? v.salario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
    exibir_salario: v?.exibir_salario ?? false,
    posicoes: String(v?.posicoes ?? 1),
    data_limite: v?.data_limite ?? '',
    benefit_ids: v?.benefit_ids ?? [],
  }
}

// Vaga: etapas no cadastro (nova/), abas na edição ([id]/)
export function VagaForm({ companyId, vaga, companyBenefits, abasExtras = [], abrirDados, acoes, onCancel, onSaved }: Props) {
  const editando = !!vaga
  const qtdExtras = editando ? abasExtras.length : 0
  // Índice geral: abas extras primeiro, depois as do formulário
  const [passo, setPasso] = useState(abrirDados ? qtdExtras : 0)
  const etapa = passo - qtdExtras
  const naAbaExtra = etapa < 0
  const ultima = etapa === ETAPAS.length - 1

  const { register, handleSubmit, trigger, watch, setValue, formState: { errors, isSubmitting } } = useForm<VagaInput>({
    resolver: zodResolver(vagaSchema),
    defaultValues: valoresIniciais(vaga),
  })
  // Salário formatado como moeda enquanto digita
  const salarioCampo = register('salario')

  const tipo = watch('tipo_contrato')
  const benefitIds = watch('benefit_ids')
  const pj = isPjOuAutonomo(tipo)

  async function avancar() {
    if (!(await trigger(ETAPAS[etapa].campos, { shouldFocus: true }))) {
      toast.error('Confira os campos destacados.')
      return
    }
    setPasso((p) => p + 1)
  }

  async function salvar(dados: VagaInput) {
    // PJ/autônomo não têm benefícios: não grava o que ficou marcado antes de trocar o tipo
    const envio = { ...dados, benefit_ids: pj ? [] : dados.benefit_ids }
    const r = await toast.promise(salvarVagaAction(companyId, vaga?.id ?? null, envio), {
      loading: editando ? 'Salvando a vaga…' : 'Criando a vaga…',
      success: editando ? 'Vaga atualizada.' : 'Vaga criada. O link de candidatura já está disponível.',
      error: 'Não foi possível salvar a vaga.',
    })
    if ('id' in r && r.id) onSaved(r.id)
  }

  // Campo com problema em outra etapa/aba: leva até ela
  function invalido(erros: FieldErrors<VagaInput>) {
    const i = ETAPAS.findIndex((e) => e.campos.some((c) => erros[c]))
    if (i >= 0) setPasso(i + qtdExtras)
    toast.error('Confira os campos destacados.')
  }

  function handleForm(e: React.FormEvent<HTMLFormElement>) {
    // Cadastro: Enter nas etapas intermediárias avança em vez de salvar
    if (!editando && !ultima) { e.preventDefault(); avancar(); return }
    handleSubmit(salvar, invalido)(e)
  }

  const labels = ETAPAS.map((e) => e.label)

  return (
    <>
      {editando ? (
        <div className="flex flex-wrap items-start justify-between gap-x-4">
          <Tabs labels={[...abasExtras.map((a) => a.label), ...labels]} step={passo} onSelect={setPasso} />
          {acoes && <div className="flex flex-wrap items-center gap-2 mb-6">{acoes}</div>}
        </div>
      ) : <Stepper labels={labels} step={passo} onSelect={setPasso} />}

      {/* Todas as etapas ficam no mesmo formulário (só escondidas), para não perder o que foi digitado */}
      <form onSubmit={handleForm} noValidate className={naAbaExtra ? 'hidden' : 'flex flex-col gap-4'}>
        {/* ── 1. Dados da vaga ── */}
        <div className={etapa === 0 ? 'flex flex-col gap-4' : 'hidden'}>
          <Input label="Título da vaga *" placeholder="Ex.: Recepcionista" error={errors.titulo?.message} {...register('titulo')} />
          <div className="flex flex-col gap-1">
            <label htmlFor="descricao" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Descrição</label>
            <textarea
              id="descricao"
              rows={6}
              placeholder="Atividades, requisitos e o que mais o candidato precisa saber. Aparece na página pública."
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
              {...register('descricao')}
            />
            {errors.descricao && <p className="text-xs" style={{ color: 'var(--color-error)' }}>{errors.descricao.message}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Cargo" placeholder="Ex.: Auxiliar administrativo" error={errors.cargo?.message} {...register('cargo')} />
            <Input label="Departamento" placeholder="Ex.: Operacional" error={errors.departamento?.message} {...register('departamento')} />
            <Input label="Local de trabalho" placeholder="Ex.: Matriz" error={errors.local_trabalho?.message} {...register('local_trabalho')} />
          </div>
        </div>

        {/* ── 2. Contratação ── */}
        <div className={etapa === 1 ? 'flex flex-col gap-4' : 'hidden'}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Forma de contratação *" options={TIPO_OPTIONS} placeholder="Selecionar..." error={errors.tipo_contrato?.message} {...register('tipo_contrato')} />
            <Input label={pj ? 'Valor do contrato (R$)' : 'Salário (R$)'} placeholder="0,00" inputMode="numeric" hint="Usado na carta proposta." error={errors.salario?.message} {...salarioCampo} onChange={(e) => { e.target.value = maskMoeda(e.target.value); void salarioCampo.onChange(e) }} />
          </div>
          <label className="flex items-center gap-2.5 text-sm cursor-pointer self-start" style={{ color: 'var(--color-text-secondary)' }}>
            <input type="checkbox" className="w-4 h-4" style={{ accentColor: 'var(--color-brand)' }} {...register('exibir_salario')} />
            Mostrar o valor na página pública
          </label>

          {!pj && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Benefícios</p>
              {companyBenefits.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Nenhum benefício cadastrado. Crie o catálogo em Pessoas → Benefícios.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {companyBenefits.map((b) => {
                    const marcado = benefitIds.includes(b.id)
                    return (
                      <label key={b.id} className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors"
                        style={{ borderColor: marcado ? 'var(--color-brand)' : 'var(--color-card-border)', backgroundColor: marcado ? 'var(--color-brand-light)' : '#fff' }}>
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={(e) => setValue('benefit_ids', e.target.checked ? [...benefitIds, b.id] : benefitIds.filter((id) => id !== b.id))}
                          className="mt-0.5 w-4 h-4"
                          style={{ accentColor: 'var(--color-brand)' }}
                        />
                        <span>
                          <span className="block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{b.nome}</span>
                          <span className="block text-xs" style={{ color: 'var(--color-text-muted)' }}>{fmtMoney(b.valor)}{b.por_dia_trabalhado ? '/dia' : '/mês'}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 3. Publicação ── */}
        <div className={etapa === 2 ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : 'hidden'}>
          <Input label="Posições *" type="number" min={1} hint="A vaga encerra ao preencher todas." error={errors.posicoes?.message} {...register('posicoes')} />
          <Input label="Receber candidaturas até" type="date" hint="Em branco: até pausar ou encerrar." error={errors.data_limite?.message} {...register('data_limite')} />
        </div>

        <div className="flex items-center justify-between gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={editando || etapa === 0 ? onCancel : () => setPasso((p) => p - 1)}>
            {editando || etapa === 0 ? 'Cancelar' : 'Voltar'}
          </Button>
          {!editando && !ultima ? (
            <Button key="next" type="button" onClick={avancar}>Avançar</Button>
          ) : (
            <Button key="submit" type="submit" loading={isSubmitting}>{editando ? 'Salvar alterações' : 'Criar vaga'}</Button>
          )}
        </div>
      </form>

      {naAbaExtra && abasExtras[passo]?.content}
    </>
  )
}
