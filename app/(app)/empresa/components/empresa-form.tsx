'use client'

import { useRef, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Image from 'next/image'
import { createCompanyAction, updateCompanyAction } from '../actions'
import { companySchema, type CompanyData } from '@/lib/validations/company'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Button } from '@/components/ui/button'
import type { Company } from '../queries'

const UF_OPTIONS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO',
]

const COR_PRESETS = [
  '#C19A6B','#1A1A2E','#16213E','#2E86AB','#A23B72',
  '#F18F01','#2ECC71','#E74C3C','#8E44AD','#2C3E50',
]

function formatCNPJ(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

function maskCep(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider pt-2" style={{ color: 'var(--color-text-muted)' }}>
      {children}
    </p>
  )
}

function Divider() {
  return <hr style={{ borderColor: 'var(--color-bg-surface)' }} />
}

interface Props {
  company: Company | null
}

export function EmpresaForm({ company }: Props) {
  const isEdit = !!company

  const [serverError, setServerError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [cepLoading, setCepLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  const logoInputRef = useRef<HTMLInputElement>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(company?.logo_url ?? null)

  const certInputRef = useRef<HTMLInputElement>(null)
  const [certName, setCertName] = useState<string | null>(
    company?.certificado_digital_url ? 'Certificado já cadastrado' : null,
  )

  const cnpjDisplay = company ? formatCNPJ(company.cnpj) : ''
  const cepDisplay = company?.cep ? maskCep(company.cep) : ''

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CompanyData>({
    resolver: zodResolver(companySchema),
    defaultValues: company
      ? {
          cnpj: cnpjDisplay,
          razao_social: company.razao_social,
          nome_fantasia: company.nome_fantasia ?? '',
          regime_tributario: (company.regime_tributario as CompanyData['regime_tributario']) ?? undefined,
          telefone: company.telefone ?? '',
          email: company.email ?? '',
          inscricao_estadual: company.inscricao_estadual ?? '',
          inscricao_municipal: company.inscricao_municipal ?? '',
          cor_primaria: company.cor_primaria ?? '#C19A6B',
          cep: cepDisplay,
          uf: company.uf ?? '',
          cidade: company.cidade ?? '',
          logradouro: company.logradouro ?? '',
          bairro: company.bairro ?? '',
          numero: company.numero ?? '',
          complemento: company.complemento ?? '',
        }
      : { cor_primaria: '#C19A6B' },
  })

  const corAtual = watch('cor_primaria') ?? '#C19A6B'
  const loading = isSubmitting || isPending

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoPreview(URL.createObjectURL(file))
  }

  function handleCertChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCertName(e.target.files?.[0]?.name ?? null)
  }

  async function handleCepBlur(cep: string) {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) return
    setCepLoading(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const json = await res.json()
      if (!json.erro) {
        setValue('logradouro', json.logradouro || '', { shouldValidate: false })
        setValue('bairro', json.bairro || '', { shouldValidate: false })
        setValue('cidade', json.localidade || '', { shouldValidate: false })
        setValue('uf', json.uf || '', { shouldValidate: false })
      }
    } catch { /* usuário preenche manualmente */ }
    finally { setCepLoading(false) }
  }

  async function onSubmit(data: CompanyData) {
    setServerError(null)
    setSuccessMsg(null)
    const formData = new FormData()
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== '') formData.set(k, String(v))
    })
    const logoFile = logoInputRef.current?.files?.[0]
    if (logoFile) formData.set('logo_file', logoFile)
    const certFile = certInputRef.current?.files?.[0]
    if (certFile) formData.set('certificado_file', certFile)

    startTransition(async () => {
      if (isEdit) {
        const result = await updateCompanyAction(company.id, formData)
        if (result?.error) setServerError(result.error)
        else setSuccessMsg('Dados da empresa atualizados com sucesso!')
      } else {
        const result = await createCompanyAction(formData)
        if (result?.error) setServerError(result.error)
        // sucesso → redirect para /dashboard feito pela action
      }
    })
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
          Minha Empresa
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          {isEdit ? 'Edite os dados da sua empresa' : 'Cadastre os dados da sua empresa para começar a usar o sistema'}
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border p-8" style={{ borderColor: 'var(--color-bg-surface)' }}>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">

          {/* ── Dados da empresa ── */}
          <SectionTitle>Dados da empresa</SectionTitle>

          <div className="flex flex-col gap-1">
            <Input
              label="CNPJ"
              type="text"
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
              error={errors.cnpj?.message}
              readOnly={isEdit}
              className={isEdit ? 'bg-gray-50 cursor-not-allowed' : ''}
              {...register('cnpj', {
                onChange: isEdit ? undefined : (e) => {
                  const f = formatCNPJ(e.target.value)
                  e.target.value = f
                  setValue('cnpj', f, { shouldValidate: false })
                },
              })}
            />
            {isEdit && (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>O CNPJ não pode ser alterado após o cadastro.</p>
            )}
          </div>

          <Input label="Razão Social" type="text" placeholder="Nome oficial da empresa" error={errors.razao_social?.message} {...register('razao_social')} />
          <Input label="Nome Fantasia (opcional)" type="text" placeholder="Como a empresa é conhecida" {...register('nome_fantasia')} />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Regime Tributário (opcional)</label>
            <select
              className="h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C19A6B]"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
              {...register('regime_tributario')}
            >
              <option value="">Selecione...</option>
              <option value="mei">MEI</option>
              <option value="simples_nacional">Simples Nacional</option>
              <option value="lucro_presumido">Lucro Presumido</option>
              <option value="lucro_real">Lucro Real</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Telefone (opcional)" type="tel" placeholder="(11) 99999-9999" {...register('telefone')} />
            <Input label="E-mail da empresa (opcional)" type="email" placeholder="empresa@email.com" error={errors.email?.message} {...register('email')} />
          </div>

          <Divider />

          {/* ── Documentos fiscais ── */}
          <SectionTitle>Documentos Fiscais</SectionTitle>

          <div className="grid grid-cols-2 gap-3">
            <Input label="IE — Inscrição Estadual (opcional)" type="text" placeholder="000.000.000.000" {...register('inscricao_estadual')} />
            <Input label="IM — Inscrição Municipal (opcional)" type="text" placeholder="00000000" {...register('inscricao_municipal')} />
          </div>

          <Divider />

          {/* ── Identidade Visual ── */}
          <SectionTitle>Identidade Visual</SectionTitle>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Logo da empresa (opcional)
            </label>
            <div className="flex items-center gap-4">
              {logoPreview ? (
                <Image src={logoPreview} alt="Preview logo" width={56} height={56} className="w-14 h-14 rounded-lg object-contain border" style={{ borderColor: 'var(--color-bg-surface)' }} />
              ) : (
                <div className="w-14 h-14 rounded-lg border flex items-center justify-center text-2xl" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'var(--color-bg-surface)' }}>
                  🏢
                </div>
              )}
              <label
                className="cursor-pointer text-sm px-4 py-2 rounded-lg border transition-colors hover:bg-gray-50"
                style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}
              >
                {logoPreview ? 'Trocar imagem' : 'Selecionar imagem'}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={handleLogoChange}
                />
              </label>
              {logoPreview && (
                <button type="button" className="text-xs" style={{ color: 'var(--color-text-muted)' }} onClick={() => { setLogoPreview(null); if (logoInputRef.current) logoInputRef.current.value = '' }}>
                  Remover
                </button>
              )}
            </div>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>PNG, JPG ou SVG — máx. 5 MB</p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Cor da empresa (opcional)
            </label>
            <div className="flex items-center gap-3 flex-wrap">
              {COR_PRESETS.map((cor) => (
                <button
                  key={cor}
                  type="button"
                  onClick={() => setValue('cor_primaria', cor)}
                  className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: cor,
                    borderColor: corAtual === cor ? 'var(--color-text-primary)' : 'transparent',
                  }}
                  title={cor}
                />
              ))}
              <label className="relative cursor-pointer" title="Cor personalizada">
                <div
                  className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold overflow-hidden"
                  style={{ backgroundColor: corAtual, borderColor: 'var(--color-bg-surface)' }}
                >
                  <input
                    type="color"
                    className="absolute opacity-0 w-full h-full cursor-pointer"
                    {...register('cor_primaria')}
                  />
                </div>
              </label>
              <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{corAtual}</span>
            </div>
          </div>

          <Divider />

          {/* ── Certificado Digital ── */}
          <SectionTitle>Certificado Digital (opcional)</SectionTitle>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Arquivo do certificado (.pfx / .p12)
            </label>
            <label
              className="flex items-center gap-3 cursor-pointer h-10 rounded-lg border px-3 text-sm hover:bg-gray-50 transition-colors"
              style={{ borderColor: 'var(--color-bg-surface)', color: certName ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}
            >
              <span>📎</span>
              <span className="truncate">{certName ?? 'Selecionar arquivo...'}</span>
              <input
                ref={certInputRef}
                type="file"
                accept=".pfx,.p12,application/x-pkcs12"
                className="hidden"
                onChange={handleCertChange}
              />
            </label>
          </div>

          <PasswordInput
            label={isEdit && company.certificado_digital_url ? 'Nova senha do certificado (deixe em branco para manter)' : 'Senha do certificado digital (opcional)'}
            placeholder="••••••••"
            autoComplete="off"
            {...register('certificado_digital_senha')}
          />

          <Divider />

          {/* ── Endereço ── */}
          <SectionTitle>Endereço (opcional)</SectionTitle>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>CEP</label>
              <a
                href="https://buscacepinter.correios.com.br/app/endereco/index.php"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs hover:underline"
                style={{ color: 'var(--color-primary-dark)' }}
              >
                Não sabe o CEP?
              </a>
            </div>
            <input
              type="text"
              placeholder="00000-000"
              inputMode="numeric"
              maxLength={9}
              className="h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C19A6B]"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
              {...register('cep', {
                onChange: (e) => { e.target.value = maskCep(e.target.value); setValue('cep', e.target.value, { shouldValidate: false }) },
                onBlur: (e) => handleCepBlur(e.target.value),
              })}
            />
            {cepLoading && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Buscando endereço...</p>}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>UF</label>
              <select
                className="h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C19A6B]"
                style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
                {...register('uf')}
              >
                <option value="">UF</option>
                {UF_OPTIONS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <Input label="Cidade" type="text" placeholder="Cidade" {...register('cidade')} />
            </div>
          </div>

          <Input label="Logradouro" type="text" placeholder="Rua, Avenida, etc." {...register('logradouro')} />
          <Input label="Bairro" type="text" placeholder="Bairro" {...register('bairro')} />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Número" type="text" placeholder="Número" {...register('numero')} />
            <Input label="Complemento" type="text" placeholder="Apto, sala..." {...register('complemento')} />
          </div>

          {successMsg && (
            <p className="text-sm text-center py-2 px-3 rounded-lg bg-green-50 border border-green-200 text-green-700">
              {successMsg}
            </p>
          )}

          {serverError && (
            <p className="text-sm text-center py-2 px-3 rounded-lg bg-red-50 border border-red-200" style={{ color: 'var(--color-error)' }}>
              {serverError}
            </p>
          )}

          <Button type="submit" loading={loading} size="lg" className="w-full mt-2">
            {isEdit ? 'Salvar alterações' : 'Cadastrar empresa'}
          </Button>
        </form>
      </div>
    </div>
  )
}
