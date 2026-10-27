'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createCompanyAction, updateCompanyAction } from '../actions'
import { companySchema, type CompanyData } from '@/lib/validations/company'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import type { Company } from '../queries'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { Icon } from '@/components/ui/icon'
import type { EmpresaPdfData } from './empresa-pdf'

const UF_OPTIONS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO',
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

// Abas do formulário e os campos de cada uma (para levar a pessoa até a aba com erro)
const TABS = [
  { id: 'dados',       label: 'Dados da empresa',    fields: ['razao_social', 'cnpj', 'nome_fantasia', 'telefone', 'email'] },
  { id: 'endereco',    label: 'Endereço',            fields: ['cep', 'uf', 'cidade', 'logradouro', 'numero', 'bairro', 'complemento'] },
  { id: 'fiscal',      label: 'Dados fiscais',       fields: ['regime_tributario', 'inscricao_municipal', 'ie_situacao', 'inscricao_estadual'] },
] as const

type TabId = (typeof TABS)[number]['id']

// Conteúdo de uma aba: fica montado mesmo escondido, para os campos não perderem o valor
function TabPanel({ active, children }: { active: boolean; children: React.ReactNode }) {
  return <div className={active ? 'flex flex-col gap-4' : 'hidden'}>{children}</div>
}

function Req() {
  return <span style={{ color: '#EF4444' }}>*</span>
}

interface Props {
  company: Company | null
}

export function EmpresaForm({ company }: Props) {
  const isEdit = !!company
  const router = useRouter()

  const [serverError, setServerError] = useState<string | null>(null)
  const [cepLoading, setCepLoading]   = useState(false)
  const [activeTab, setActiveTab]     = useState<TabId>('dados')
  const [isPending, startTransition]  = useTransition()


  const cnpjDisplay = company ? formatCNPJ(company.cnpj) : ''
  const cepDisplay  = company?.cep ? maskCep(company.cep) : ''

  const { register, handleSubmit, setValue, getValues, watch, formState: { errors, isSubmitting } } =
    useForm<CompanyData>({
      resolver: zodResolver(companySchema),
      defaultValues: company
        ? {
            cnpj:                      cnpjDisplay,
            razao_social:              company.razao_social,
            nome_fantasia:             company.nome_fantasia ?? '',
            regime_tributario:         (company.regime_tributario as CompanyData['regime_tributario']) ?? undefined,
            telefone:                  company.telefone ?? '',
            email:                     company.email ?? '',
            ie_situacao:               (company.ie_situacao as CompanyData['ie_situacao']) ?? undefined,
            inscricao_estadual:        company.inscricao_estadual ?? '',
            inscricao_municipal:       company.inscricao_municipal ?? '',
            cor_primaria:              company.cor_primaria ?? '#C19A6B',
            cep:                       cepDisplay,
            uf:                        company.uf ?? '',
            cidade:                    company.cidade ?? '',
            logradouro:                company.logradouro ?? '',
            bairro:                    company.bairro ?? '',
            numero:                    company.numero ?? '',
            complemento:               company.complemento ?? '',
          }
        : { cor_primaria: '#C19A6B' },
    })

  const loading  = isSubmitting || isPending
  const [pdfLoading, setPdfLoading] = useState(false)

  // Exporta para PDF o que está na tela (inclusive alterações ainda não salvas)
  async function handleExportPdf() {
    if (!company) return
    setPdfLoading(true)
    try {
      const [{ pdf }, { EmpresaPdf }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./empresa-pdf'),
      ])
      const v = getValues()
      const data: EmpresaPdfData = {
        razao_social:        v.razao_social ?? '',
        cnpj:                v.cnpj ?? '',
        nome_fantasia:       v.nome_fantasia ?? '',
        telefone:            v.telefone ?? '',
        email:               v.email ?? '',
        cep:                 v.cep ?? '',
        uf:                  v.uf ?? '',
        cidade:              v.cidade ?? '',
        logradouro:          v.logradouro ?? '',
        numero:              v.numero ?? '',
        bairro:              v.bairro ?? '',
        complemento:         v.complemento ?? '',
        regime_tributario:   v.regime_tributario ?? '',
        inscricao_municipal: v.inscricao_municipal ?? '',
        ie_situacao:         v.ie_situacao ?? '',
        inscricao_estadual:  v.inscricao_estadual ?? '',
      }
      // Cor principal da identidade visual (sempre em hex no tema)
      const brand = getComputedStyle(document.documentElement).getPropertyValue('--color-brand').trim()
      const accent = /^#[0-9a-f]{6}$/i.test(brand) ? brand : '#A88E5D'
      const geradoEm = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
      const render = (logoUrl: string | null) =>
        pdf(<EmpresaPdf data={data} logoUrl={logoUrl} accent={accent} geradoEm={geradoEm} />).toBlob()

      // Se a logo não carregar, gera o documento sem ela
      const blob = await render(company.logo_url).catch(() => render(null))
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dados-empresa-${(v.cnpj ?? '').replace(/\D/g, '') || 'empresa'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Não foi possível gerar o PDF.')
    } finally {
      setPdfLoading(false)
    }
  }

  const tabHasError = (tab: (typeof TABS)[number]) => tab.fields.some((f) => f in errors)

  // Validação falhou: abre a primeira aba que tem campo com erro
  function onInvalid(formErrors: typeof errors) {
    const tab = TABS.find((t) => t.fields.some((f) => f in formErrors))
    if (tab) setActiveTab(tab.id)
  }

  async function handleCepBlur(cep: string) {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) return
    setCepLoading(true)
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const json = await res.json()
      if (!json.erro) {
        setValue('logradouro', json.logradouro || '', { shouldValidate: false })
        setValue('bairro',     json.bairro     || '', { shouldValidate: false })
        setValue('cidade',     json.localidade || '', { shouldValidate: false })
        setValue('uf',         json.uf         || '', { shouldValidate: false })
      }
    } catch { /* usuário preenche manualmente */ }
    finally { setCepLoading(false) }
  }

  async function onSubmit(data: CompanyData) {
    setServerError(null)
    const formData = new FormData()
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== '') formData.set(k, String(v))
    })

    startTransition(async () => {
      if (isEdit) {
        // Erros do servidor aparecem no próprio toast (✕)
        await toast.promise(updateCompanyAction(company.id, formData), {
          loading: 'Salvando dados da empresa…',
          success: 'Dados da empresa atualizados com sucesso!',
          error: 'Não foi possível salvar os dados da empresa.',
        })
      } else {
        const result = await createCompanyAction(formData)
        if (result?.error) {
          setServerError(result.error)
        } else if (result?.companyId) {
          document.cookie = `active_company_id=${result.companyId}; path=/; max-age=31536000; SameSite=Lax`
          router.push('/dashboard')
        }
      }
    })
  }

  const selectCls = 'h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]'
  const selectSty = { borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }

  return (
    <div className="w-full">
      <div className="mb-6">
        {/* Título e breadcrumb na mesma linha */}
        <div className="flex-1 min-w-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
            Minha Empresa
          </h1>
          <Breadcrumb />
        </div>
        <p className="text-sm mt-1 animate-enter" style={{ color: 'var(--color-text-muted)', animationDelay: '60ms' }}>
          {isEdit ? 'Edite os dados da sua empresa' : 'Cadastre os dados da sua empresa para começar a usar o sistema'}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="flex flex-col gap-4">
        <div className="app-card p-6 flex flex-col gap-6">

        {/* Abas + exportar PDF (à direita) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist">
          {TABS.map((tab) => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`relative h-10 px-4 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${active ? '' : 'hover:bg-gray-50'}`}
                style={{
                  fontFamily: 'Manrope',
                  ...(active
                    ? { backgroundColor: 'var(--color-brand)', color: '#fff' }
                    : { color: 'var(--color-sidebar-text)' }),
                }}
              >
                {tab.label}
                {tabHasError(tab) && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" aria-label="Campo com erro" />
                )}
              </button>
            )
          })}
        </div>
        {isEdit && (
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={pdfLoading}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-medium transition-colors hover:bg-[var(--color-brand-light)] shrink-0 disabled:opacity-60 disabled:cursor-wait"
            style={{ borderColor: 'var(--color-brand)', color: 'var(--color-brand)' }}
          >
            {pdfLoading ? (
              <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : (
              <Icon name="download" size={16} />
            )}
            {pdfLoading ? 'Gerando PDF…' : 'Exportar PDF'}
          </button>
        )}
        </div>

        {/* Dados da empresa */}
        <TabPanel active={activeTab === 'dados'}>
          {/* Razão Social — linha inteira */}
          <Input label={<>Razão Social <Req /></>} type="text" placeholder="Nome oficial da empresa"
            error={errors.razao_social?.message} {...register('razao_social')} />

          {/* CNPJ + Nome Fantasia */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Input
                label={<>CNPJ <Req /></>}
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
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  O CNPJ não pode ser alterado após o cadastro.
                </p>
              )}
            </div>
            <Input label="Nome Fantasia" type="text" placeholder="Como a empresa é conhecida"
              {...register('nome_fantasia')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Telefone" type="tel" placeholder="(11) 99999-9999" {...register('telefone')} />
            <Input label="E-mail da empresa" type="email" placeholder="empresa@email.com"
              error={errors.email?.message} {...register('email')} />
          </div>

        </TabPanel>

        {/* Endereço */}
        <TabPanel active={activeTab === 'endereco'}>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>CEP</label>
                <a href="https://buscacepinter.correios.com.br/app/endereco/index.php"
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs hover:underline" style={{ color: 'var(--color-primary-dark)' }}>
                  Não sabe?
                </a>
              </div>
              <input
                type="text" placeholder="00000-000" inputMode="numeric" maxLength={9}
                className={selectCls} style={selectSty}
                {...register('cep', {
                  onChange: (e) => { e.target.value = maskCep(e.target.value); setValue('cep', e.target.value, { shouldValidate: false }) },
                  onBlur:   (e) => handleCepBlur(e.target.value),
                })}
              />
              {cepLoading && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Buscando...</p>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>UF</label>
              <select className={selectCls} style={selectSty} {...register('uf')}>
                <option value="">UF</option>
                {UF_OPTIONS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>

            <Input label="Cidade" type="text" placeholder="Cidade" {...register('cidade')} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Input label="Logradouro" type="text" placeholder="Rua, Avenida, etc." {...register('logradouro')} />
            </div>
            <Input label="Número" type="text" placeholder="Número" {...register('numero')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Bairro" type="text" placeholder="Bairro" {...register('bairro')} />
            <Input label="Complemento" type="text" placeholder="Apto, sala..." {...register('complemento')} />
          </div>
        </TabPanel>

        {/* Dados fiscais */}
        <TabPanel active={activeTab === 'fiscal'}>
          {/* Regime Tributário + IM */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Regime Tributário
              </label>
              <select className={selectCls} style={selectSty} {...register('regime_tributario')}>
                <option value="">Selecione...</option>
                <option value="mei">MEI</option>
                <option value="simples_nacional">Simples Nacional</option>
                <option value="lucro_presumido">Lucro Presumido</option>
                <option value="lucro_real">Lucro Real</option>
              </select>
            </div>
            <Input label={<>IM — Inscrição Municipal <Req /></>} type="text" placeholder="00000000"
              {...register('inscricao_municipal')} />
          </div>

          {/* IE */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                IE — Situação
              </label>
              <select className={selectCls} style={selectSty} {...register('ie_situacao')}>
                <option value="">Selecione...</option>
                <option value="isento">Isento</option>
                <option value="nao_contribuinte">Não contribuinte do ICMS</option>
                <option value="contribuinte">Contribuinte do ICMS</option>
              </select>
            </div>
            <Input label="IE — Número" type="text" placeholder="000.000.000.000"
              {...register('inscricao_estadual')} />
          </div>
        </TabPanel>

        </div>

        {serverError && (
          <p className="text-sm text-center py-2 px-3 rounded-lg bg-red-50 border border-red-200"
            style={{ color: 'var(--color-error)' }}>
            {serverError}
          </p>
        )}

        <div className="flex justify-end pb-8">
          <Button type="submit" loading={loading} size="lg">
            {isEdit ? 'Salvar alterações' : 'Cadastrar empresa'}
          </Button>
        </div>
      </form>
    </div>
  )
}
