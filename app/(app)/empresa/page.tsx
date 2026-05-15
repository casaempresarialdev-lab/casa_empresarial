'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createCompanyAction } from './actions'
import { companySchema, type CompanyData } from '@/lib/validations/company'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const UF_OPTIONS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO',
]

function formatCNPJ(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

function maskCep(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

export default function EmpresaPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [cepLoading, setCepLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CompanyData>({ resolver: zodResolver(companySchema) })

  const loading = isSubmitting || isPending

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
    } catch {
      // usuário preenche manualmente
    } finally {
      setCepLoading(false)
    }
  }

  async function onSubmit(data: CompanyData) {
    setServerError(null)
    const formData = new FormData()
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== '') formData.set(k, String(v))
    })
    startTransition(async () => {
      const result = await createCompanyAction(formData)
      if (result?.error) setServerError(result.error)
    })
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
          Minha Empresa
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Cadastre os dados da sua empresa para começar a usar o sistema
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border p-8" style={{ borderColor: 'var(--color-bg-surface)' }}>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">

          {/* Dados da empresa */}
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            Dados da empresa
          </p>

          <Input
            label="CNPJ"
            type="text"
            placeholder="00.000.000/0000-00"
            inputMode="numeric"
            error={errors.cnpj?.message}
            {...register('cnpj', {
              onChange: (e) => {
                const formatted = formatCNPJ(e.target.value)
                e.target.value = formatted
                setValue('cnpj', formatted, { shouldValidate: false })
              },
            })}
          />

          <Input
            label="Razão Social"
            type="text"
            placeholder="Nome oficial da empresa"
            error={errors.razao_social?.message}
            {...register('razao_social')}
          />

          <Input
            label="Nome Fantasia (opcional)"
            type="text"
            placeholder="Como a empresa é conhecida"
            error={errors.nome_fantasia?.message}
            {...register('nome_fantasia')}
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Regime Tributário (opcional)
            </label>
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
            <Input
              label="Telefone (opcional)"
              type="tel"
              placeholder="(11) 99999-9999"
              error={errors.telefone?.message}
              {...register('telefone')}
            />
            <Input
              label="E-mail da empresa (opcional)"
              type="email"
              placeholder="empresa@email.com"
              error={errors.email?.message}
              {...register('email')}
            />
          </div>

          {/* Endereço */}
          <div className="pt-2 border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--color-text-muted)' }}>
              Endereço (opcional)
            </p>

            {/* CEP */}
            <div className="flex flex-col gap-1 mb-4">
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
                  onChange: (e) => {
                    e.target.value = maskCep(e.target.value)
                    setValue('cep', e.target.value, { shouldValidate: false })
                  },
                  onBlur: (e) => handleCepBlur(e.target.value),
                })}
              />
              {cepLoading && (
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Buscando endereço...</p>
              )}
            </div>

            {/* UF + Cidade */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>UF</label>
                <select
                  className="h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C19A6B]"
                  style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
                  {...register('uf')}
                >
                  <option value="">UF</option>
                  {UF_OPTIONS.map((uf) => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <Input label="Cidade" type="text" placeholder="Cidade" {...register('cidade')} />
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <Input label="Logradouro" type="text" placeholder="Rua, Avenida, etc." {...register('logradouro')} />
              <Input label="Bairro" type="text" placeholder="Bairro" {...register('bairro')} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Número" type="text" placeholder="Número" {...register('numero')} />
                <Input label="Complemento" type="text" placeholder="Apto, sala..." {...register('complemento')} />
              </div>
            </div>
          </div>

          {serverError && (
            <p className="text-sm text-center py-2 px-3 rounded-lg bg-red-50 border border-red-200" style={{ color: 'var(--color-error)' }}>
              {serverError}
            </p>
          )}

          <Button type="submit" loading={loading} size="lg" className="w-full mt-2">
            Cadastrar empresa
          </Button>
        </form>
      </div>
    </div>
  )
}
