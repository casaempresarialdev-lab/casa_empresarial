'use client'

import { useEffect, useState } from 'react'
import { useForm, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { FotoPicker } from '@/components/ui/foto-picker'
import { Stepper } from '@/components/ui/form-steps'
import { PublicoAviso } from '@/components/layout/publico-shell'
import { toast } from '@/lib/toast'
import { autoCadastroSchema, type AutoCadastroInput } from '@/lib/validations/auto-cadastro'
import { GRAU_OPTIONS, maskCpf, maskTelefone } from '@/app/(app)/pessoas/funcionarios/components/ficha/ficha-config'
import { docsObrigatorios } from '../../docs-obrigatorios'

const MAX_ARQUIVO = 20 * 1024 * 1024

const DOCUMENTOS = [
  { key: 'rg_cnh_frente', label: 'RG frente / CNH' },
  { key: 'rg_verso', label: 'RG verso' },
  { key: 'cpf', label: 'CPF' },
  { key: 'ctps', label: 'Carteira de Trabalho' },
  { key: 'pis', label: 'PIS' },
  { key: 'titulo_eleitor', label: 'Título de Eleitor' },
  { key: 'certidao', label: 'Certidão Nasc./Casamento' },
  { key: 'comprovante_residencia', label: 'Comprovante de Residência' },
]

interface Props {
  /** Envia os dados: pelo link (candidato) ou pelo painel (empresa) */
  enviar: (fd: FormData) => Promise<{ success?: true; error?: string }>
  /** No painel: em vez da mensagem de agradecimento, avisa quem chamou */
  onConcluido?: () => void
  /** No painel, dentro de outra caixa: sem o cartão próprio */
  semCartao?: boolean
  employeeName: string
  companyName: string
  /** Dados já conhecidos (candidatura, ficha): o candidato só confere e completa */
  inicial: AutoCadastroInput
  tipoContrato: string | null
  /** Documentos obrigatórios já enviados antes */
  docsExistentes: string[]
}

// Etapas do preenchimento: cada uma valida os próprios campos antes de avançar
export function AutoCadastroForm({ enviar: enviarDados, onConcluido, semCartao, employeeName, companyName, inicial, tipoContrato, docsExistentes }: Props) {
  const painel = !!onConcluido
  // "ROGELSON" → "Rogelson" no título
  const nomeTitulo = employeeName.split(' ')[0].toLowerCase().replace(/^\p{L}/u, (l) => l.toUpperCase())
  const primeiroNome = employeeName.split(' ')[0]
  const pj = tipoContrato === 'pj' || tipoContrato === 'autonomo'
  const obrigatorios = docsObrigatorios(tipoContrato)
  // PJ/autônomo não têm documentos trabalhistas
  const documentos = DOCUMENTOS.filter((d) => !pj || !['ctps', 'pis'].includes(d.key))

  const etapas: { label: string; campos: (keyof AutoCadastroInput)[] }[] = [
    { label: 'Dados pessoais', campos: ['cpf', 'rg', 'nascimento', 'telefone', 'email', 'grau_instrucao', 'dependentes'] },
    { label: pj ? 'Dados bancários' : 'Trabalho e banco', campos: ['pis_pasep', 'serie_ctps', 'certificado_reservista', 'dados_bancarios'] },
    { label: 'Documentos', campos: [] },
    { label: 'Foto', campos: [] },
  ]

  const [etapa, setEtapa] = useState(0)
  const ultima = etapa === etapas.length - 1
  const [arquivos, setArquivos] = useState<Record<string, File | undefined>>({})
  const [docsFaltando, setDocsFaltando] = useState<string[]>([])
  const [foto, setFoto] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [enviado, setEnviado] = useState(false)

  const { register, handleSubmit, trigger, setValue, formState: { errors } } = useForm<AutoCadastroInput>({
    resolver: zodResolver(autoCadastroSchema(pj)),
    defaultValues: { ...inicial, cpf: maskCpf(inicial.cpf), telefone: maskTelefone(inicial.telefone) },
  })

  useEffect(() => () => { if (fotoPreview) URL.revokeObjectURL(fotoPreview) }, [fotoPreview])

  const faltando = () => obrigatorios.filter((d) => !arquivos[d.key] && !docsExistentes.includes(d.key))

  async function avancar() {
    if (etapas[etapa].campos.length && !(await trigger(etapas[etapa].campos, { shouldFocus: true }))) {
      toast.error('Confira os campos destacados.')
      return
    }
    if (etapas[etapa].label === 'Documentos' && faltando().length) {
      setDocsFaltando(faltando().map((d) => d.key))
      toast.error(`Anexe: ${faltando().map((d) => d.label).join(', ')}.`)
      return
    }
    setErro('')
    setEtapa((e) => e + 1)
  }

  function escolher(key: string, file: File | undefined) {
    if (!file) return
    if (file.size > MAX_ARQUIVO) { toast.error(`"${file.name}" passa de 20 MB.`); return }
    setArquivos((a) => ({ ...a, [key]: file }))
    setDocsFaltando((f) => f.filter((k) => k !== key))
  }

  async function enviar(d: AutoCadastroInput) {
    setEnviando(true)
    setErro('')
    const fd = new FormData()
    for (const [k, v] of Object.entries(d)) fd.set(k, v)
    if (foto) fd.set('doc_foto', foto)
    for (const doc of documentos) {
      const file = arquivos[doc.key]
      if (file) fd.set(`doc_${doc.key}`, file)
    }
    const r = await enviarDados(fd)
    setEnviando(false)
    if (r.error) { setErro(r.error); return }
    if (onConcluido) { onConcluido(); return }
    setEnviado(true)
  }

  function invalido(erros: FieldErrors<AutoCadastroInput>) {
    // Um campo de etapa anterior ficou com problema: volta para ela
    const i = etapas.findIndex((e) => e.campos.some((c) => erros[c]))
    if (i >= 0) setEtapa(i)
    toast.error('Confira os campos destacados.')
  }

  function handleForm(e: React.FormEvent<HTMLFormElement>) {
    // Enter nas etapas intermediárias avança em vez de enviar
    if (!ultima) { e.preventDefault(); void avancar(); return }
    void handleSubmit(enviar, invalido)(e)
  }

  if (enviado) {
    return (
      <PublicoAviso
        icon="check"
        tom="sucesso"
        titulo="Dados enviados"
        texto={`Obrigado, ${primeiroNome}! Suas informações foram recebidas pela equipe da ${companyName}, que entrará em contato com os próximos passos.`}
      />
    )
  }

  return (
    <>
    {/* Página do candidato: saudação fora da caixa, na cor da empresa */}
    {!painel && (
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Olá, {nomeTitulo}!</h2>
        <p className="text-base mt-1 font-medium" style={{ color: 'var(--color-brand)' }}>Confira o que já está preenchido e complete o restante.</p>
      </div>
    )}
    {/* Página do candidato: letra um pouco maior nos campos e nos textos de apoio (no painel, o tamanho do sistema) */}
    <div className={[
      semCartao ? '' : 'app-card p-6 sm:p-8',
      painel ? '' : '[&_label]:text-[15px] [&_input]:text-base [&_select]:text-base [&_textarea]:text-base [&_form_p.text-sm]:text-[15px]',
    ].join(' ')}>
      <Stepper labels={etapas.map((e) => e.label)} step={etapa} onSelect={setEtapa} />

      {/* Todas as etapas ficam no mesmo formulário (só escondidas), para não perder o que foi digitado */}
      <form onSubmit={handleForm} noValidate className="flex flex-col gap-5">
        {/* ── 1. Dados pessoais ── */}
        <div className={etapa === 0 ? 'flex flex-col gap-4' : 'hidden'}>
          {painel && (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Confira o que já está preenchido e complete o restante.</p>
          )}
          {/* Três colunas em telas largas: CPF, RG, nascimento / telefone, e-mail (duplo) / grau, dependentes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <Input label="CPF *" inputMode="numeric" placeholder="000.000.000-00" error={errors.cpf?.message}
              {...register('cpf', { onChange: (e) => setValue('cpf', maskCpf(e.target.value)) })} />
            <Input label="RG *" error={errors.rg?.message} {...register('rg')} />
            <Input label="Data de nascimento *" type="date" error={errors.nascimento?.message} {...register('nascimento')} />
            <Input label="Telefone / WhatsApp *" inputMode="tel" placeholder="(00) 00000-0000" error={errors.telefone?.message}
              {...register('telefone', { onChange: (e) => setValue('telefone', maskTelefone(e.target.value)) })} />
            <div className="sm:col-span-2">
              <Input label="E-mail *" type="email" placeholder="seu@email.com" error={errors.email?.message} {...register('email')} />
            </div>
            <Select label="Grau de instrução *" options={GRAU_OPTIONS} placeholder="Selecionar..." error={errors.grau_instrucao?.message} {...register('grau_instrucao')} />
            {!pj && <Input label="Dependentes (IR) *" type="number" min={0} error={errors.dependentes?.message} {...register('dependentes')} />}
          </div>
        </div>

        {/* ── 2. Trabalho e banco ── */}
        <div className={etapa === 1 ? 'flex flex-col gap-4' : 'hidden'}>
          {!pj && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              <Input label="PIS / PASEP *" placeholder="000.00000.00-0" error={errors.pis_pasep?.message} {...register('pis_pasep')} />
              <Input label="Série da CTPS *" placeholder="Ex.: 001" error={errors.serie_ctps?.message} {...register('serie_ctps')} />
              <Input label="Certificado de reservista" placeholder="Nº / categoria" {...register('certificado_reservista')} />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label htmlFor="dados-bancarios" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Dados bancários *</label>
            <textarea
              id="dados-bancarios"
              rows={3}
              placeholder="Banco, agência, conta corrente e/ou chave PIX"
              aria-invalid={!!errors.dados_bancarios || undefined}
              className={`w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 ${errors.dados_bancarios ? 'border-red-400 focus:ring-red-300' : 'focus:ring-[var(--color-brand)]'}`}
              style={{ borderColor: errors.dados_bancarios ? undefined : 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
              {...register('dados_bancarios')}
            />
            {errors.dados_bancarios && <p className="text-xs" style={{ color: 'var(--color-error)' }}>{errors.dados_bancarios.message}</p>}
          </div>
        </div>

        {/* ── 3. Documentos ── */}
        <div className={etapa === 2 ? 'flex flex-col gap-3' : 'hidden'}>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Obrigatórios: {obrigatorios.map((d) => d.label).join(', ')}. Imagem (JPG, PNG) ou PDF, até 20 MB cada.
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {documentos.map((d) => {
              const file = arquivos[d.key]
              const obrigatorio = obrigatorios.some((o) => o.key === d.key)
              const jaEnviado = docsExistentes.includes(d.key)
              const tem = !!file || jaEnviado
              const destacar = docsFaltando.includes(d.key)
              return (
                <li
                  key={d.key}
                  className="flex items-center gap-3 rounded-xl border px-3.5 py-3"
                  style={{
                    borderColor: destacar ? '#F87171' : tem ? 'var(--color-brand)' : 'var(--color-card-border)',
                    backgroundColor: tem ? 'var(--color-brand-light)' : '#fff',
                  }}
                >
                  <span className="shrink-0" style={{ color: tem ? 'var(--color-brand)' : 'var(--color-text-muted)' }}><Icon name="file" size={18} /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{d.label}{obrigatorio && ' *'}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{file ? file.name : jaEnviado ? 'Já enviado' : obrigatorio ? 'Obrigatório' : 'Opcional'}</p>
                  </div>
                  {file ? (
                    <button type="button" onClick={() => setArquivos((a) => ({ ...a, [d.key]: undefined }))} className="text-xs font-medium px-2 py-1 rounded-lg shrink-0 hover:bg-white/70" style={{ color: '#B91C1C' }}>
                      Remover
                    </button>
                  ) : (
                    <label className="text-xs font-medium px-2 py-1 rounded-lg cursor-pointer shrink-0 hover:bg-[var(--color-brand-light)]" style={{ color: 'var(--color-brand)' }}>
                      {jaEnviado ? 'Trocar' : 'Anexar'}
                      <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { escolher(d.key, e.target.files?.[0]); e.target.value = '' }} />
                    </label>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        {/* ── 4. Foto ── */}
        <div className={etapa === 3 ? 'flex flex-col gap-4' : 'hidden'}>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{painel ? 'Opcional: a foto aparece na ficha do funcionário.' : 'Opcional: a foto aparece na sua ficha na empresa.'}</p>
          <FotoPicker
            preview={fotoPreview}
            alt="Sua foto"
            onPick={(file) => { setFoto(file); setFotoPreview(URL.createObjectURL(file)) }}
            onRemove={() => { setFoto(null); setFotoPreview(null) }}
            disabled={enviando}
          />
        </div>

        {erro && <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: '#B91C1C' }} role="alert">{erro}</p>}

        <div className="flex items-center justify-between gap-2 pt-2">
          {etapa > 0 ? (
            <Button type="button" variant="secondary" style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-card-border-hover)' }} onClick={() => setEtapa((e) => e - 1)} disabled={enviando}>Voltar</Button>
          ) : <span />}
          {ultima ? (
            <Button key="enviar" type="submit" loading={enviando} style={{ color: 'var(--cor-sobre-marca, #fff)' }}>{painel ? 'Salvar dados' : 'Enviar dados'}</Button>
          ) : (
            <Button key="avancar" type="button" style={{ color: 'var(--cor-sobre-marca, #fff)' }} onClick={avancar}>Avançar</Button>
          )}
        </div>

        {!painel && (
          <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
            Seus dados são protegidos e usados exclusivamente para fins trabalhistas.
          </p>
        )}
      </form>
    </div>
    </>
  )
}
