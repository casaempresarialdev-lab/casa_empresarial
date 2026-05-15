'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createCompanyAction } from './actions'
import { companySchema, type CompanyData } from '@/lib/validations/company'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

function formatCNPJ(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export default function EmpresaPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CompanyData>({ resolver: zodResolver(companySchema) })

  const loading = isSubmitting || isPending

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
