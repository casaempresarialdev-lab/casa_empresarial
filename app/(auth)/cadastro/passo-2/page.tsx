'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { saveAddressAction } from './actions'
import { cadastroPasso2Schema, type CadastroPasso2Data } from '@/lib/validations/auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const UF_OPTIONS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO',
]

function maskCep(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

export default function CadastroPasso2Page() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [cepLoading, setCepLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CadastroPasso2Data>({ resolver: zodResolver(cadastroPasso2Schema) })

  const loading = isSubmitting || isPending

  async function handleCepBlur(cep: string) {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) return
    setCepLoading(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const json = await res.json()
      if (!json.erro) {
        setValue('logradouro', json.logradouro || '', { shouldValidate: true })
        setValue('bairro', json.bairro || '', { shouldValidate: true })
        setValue('cidade', json.localidade || '', { shouldValidate: true })
        setValue('uf', json.uf || '', { shouldValidate: true })
      }
    } catch {
      // Ignora erros de rede — usuário preenche manualmente
    } finally {
      setCepLoading(false)
    }
  }

  async function onSubmit(data: CadastroPasso2Data) {
    setServerError(null)
    startTransition(async () => {
      const result = await saveAddressAction(data)
      if (result?.error) setServerError(result.error)
    })
  }

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-primary-darker)' }}>
          Casa Empresarial
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Quase lá! Informe seu endereço
        </p>
      </div>

      {/* Progress */}
      <div className="flex gap-2 mb-2">
        <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-primary-dark)' }} />
        <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-primary-dark)' }} />
      </div>
      <p className="text-xs mb-6 text-center" style={{ color: 'var(--color-text-muted)' }}>
        Passo 2 de 2 — Seu endereço
      </p>

      <div className="bg-white rounded-2xl shadow-sm border p-8" style={{ borderColor: 'var(--color-bg-surface)' }}>
        <h2 className="text-lg font-semibold mb-6" style={{ color: 'var(--color-text-primary)' }}>
          Endereço pessoal
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {/* CEP */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                CEP
              </label>
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
              style={{ borderColor: errors.cep ? 'var(--color-error)' : 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
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
            {errors.cep && (
              <p className="text-xs" style={{ color: 'var(--color-error)' }}>{errors.cep.message}</p>
            )}
          </div>

          {/* UF + Cidade */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>UF</label>
              <select
                className="h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C19A6B]"
                style={{ borderColor: errors.uf ? 'var(--color-error)' : 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
                {...register('uf')}
              >
                <option value="">UF</option>
                {UF_OPTIONS.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
              {errors.uf && (
                <p className="text-xs" style={{ color: 'var(--color-error)' }}>{errors.uf.message}</p>
              )}
            </div>

            <div className="col-span-2 flex flex-col gap-1">
              <Input
                label="Cidade"
                type="text"
                placeholder="Cidade"
                error={errors.cidade?.message}
                {...register('cidade')}
              />
            </div>
          </div>

          {/* Logradouro */}
          <Input
            label="Logradouro"
            type="text"
            placeholder="Rua, Avenida, etc."
            error={errors.logradouro?.message}
            {...register('logradouro')}
          />

          {/* Bairro */}
          <Input
            label="Bairro"
            type="text"
            placeholder="Bairro"
            error={errors.bairro?.message}
            {...register('bairro')}
          />

          {/* Número + Complemento */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Número"
              type="text"
              placeholder="Número"
              error={errors.numero?.message}
              {...register('numero')}
            />
            <Input
              label="Complemento (opcional)"
              type="text"
              placeholder="Apto, sala..."
              error={errors.complemento?.message}
              {...register('complemento')}
            />
          </div>

          {serverError && (
            <p className="text-sm text-center py-2 px-3 rounded-lg bg-red-50 border border-red-200" style={{ color: 'var(--color-error)' }}>
              {serverError}
            </p>
          )}

          <Button type="submit" loading={loading} size="lg" className="w-full mt-2">
            Concluir cadastro →
          </Button>
        </form>

        <p className="text-center text-sm mt-4" style={{ color: 'var(--color-text-muted)' }}>
          <Link href="/cadastro/passo-1" className="hover:underline" style={{ color: 'var(--color-primary-dark)' }}>
            ← Voltar
          </Link>
        </p>
      </div>
    </div>
  )
}
