'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FotoPicker } from '@/components/ui/foto-picker'
import { toast } from '@/lib/toast'
import { perfilSchema, type PerfilData } from '@/lib/validations/perfil'
import { updatePerfilAction, updateAvatarAction } from '../actions'
import { Icon } from '@/components/ui/icon'
import { ModalSenha } from './modal-senha'
import type { Perfil } from '../queries'
import { SegurancaTab } from './seguranca-tab'

const UF_OPTIONS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO',
]

function formatCpf(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

function maskCep(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

// Abas e os campos de cada uma (para levar a pessoa até a aba com erro)
const TABS = [
  { id: 'dados',    label: 'Dados pessoais', fields: ['name', 'cpf'] },
  { id: 'endereco', label: 'Endereço',       fields: ['cep', 'uf', 'cidade', 'logradouro', 'numero', 'bairro', 'complemento'] },
  { id: 'senha',    label: 'Senha',          fields: [] },
  { id: 'seguranca', label: 'Segurança',     fields: [] },
] as const

type TabId = (typeof TABS)[number]['id']

interface Props {
  perfil: Perfil
  email: string
  /** Aba aberta ao entrar (ex.: /perfil?aba=seguranca vindo do cofre de senhas) */
  abaInicial?: string
}

export function PerfilClient({ perfil, email, abaInicial }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>(
    TABS.some((t) => t.id === abaInicial) ? (abaInicial as TabId) : 'dados',
  )
  const [avatar, setAvatar] = useState<string | null>(perfil.avatar_url)
  const [avatarSaving, setAvatarSaving] = useState(false)
  const [cepLoading, setCepLoading] = useState(false)
  const cpfBloqueado = !!perfil.cpf

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<PerfilData>({
    resolver: zodResolver(perfilSchema),
    defaultValues: {
      name:        perfil.name,
      cpf:         perfil.cpf ? formatCpf(perfil.cpf) : '',
      cep:         perfil.cep ? maskCep(perfil.cep) : '',
      uf:          perfil.uf ?? '',
      cidade:      perfil.cidade ?? '',
      logradouro:  perfil.logradouro ?? '',
      bairro:      perfil.bairro ?? '',
      numero:      perfil.numero ?? '',
      complemento: perfil.complemento ?? '',
    },
  })

  const [modalSenha, setModalSenha] = useState(false)

  const nome = watch('name')

  // Foto: salva assim que escolhe (ou remove)
  async function saveAvatar(file: File | null) {
    const fd = new FormData()
    if (file) fd.set('avatar', file)
    setAvatarSaving(true)
    const result = await toast.promise(updateAvatarAction(fd), {
      loading: file ? 'Enviando foto…' : 'Removendo foto…',
      success: file ? 'Foto atualizada.' : 'Foto removida.',
      error: 'Não foi possível salvar a foto.',
    })
    setAvatarSaving(false)
    if (!('error' in result)) {
      setAvatar(result.avatar_url ?? null)
      router.refresh() // avatar no menu do usuário
    }
  }

  async function handleCepBlur(cep: string) {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) return
    setCepLoading(true)
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const json = await res.json()
      if (!json.erro) {
        setValue('logradouro', json.logradouro || '')
        setValue('bairro',     json.bairro     || '')
        setValue('cidade',     json.localidade || '')
        setValue('uf',         json.uf         || '')
      }
    } catch { /* usuário preenche manualmente */ }
    finally { setCepLoading(false) }
  }

  async function onSubmit(data: PerfilData) {
    const result = await toast.promise(updatePerfilAction(data), {
      loading: 'Salvando seus dados…',
      success: 'Perfil atualizado com sucesso!',
      error: 'Não foi possível salvar o perfil.',
    })
    if (!('error' in result)) router.refresh()
  }

  // Validação falhou: abre a primeira aba que tem campo com erro
  function onInvalid(formErrors: typeof errors) {
    const tab = TABS.find((t) => t.fields.some((f) => f in formErrors))
    if (tab) setActiveTab(tab.id)
  }

  const tabHasError = (tab: (typeof TABS)[number]) => tab.fields.some((f) => f in errors)

  const selectCls = 'h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]'
  const selectSty = { borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }
  const labelSty  = { color: 'var(--color-text-secondary)' }

  return (
    <>
      <div className="mb-6">
        {/* Título e breadcrumb na mesma linha */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
            Meu Perfil
          </h1>
          <Breadcrumb />
        </div>
        <p className="text-sm mt-1 animate-enter" style={{ color: 'var(--color-text-muted)', animationDelay: '60ms' }}>
          Seus dados pessoais e de acesso
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 items-start">
        {/* Foto e identificação */}
        <div className="app-card p-6 flex flex-col items-center gap-4">
          <FotoPicker
            preview={avatar}
            onPick={(file) => saveAvatar(file)}
            onRemove={() => saveAvatar(null)}
            alt={perfil.name}
            maxMb={2}
            disabled={avatarSaving}
          />
          <div className="text-center min-w-0 w-full pt-2 border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
            <p className="font-bold truncate pt-3" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
              {nome?.trim() || perfil.name}
            </p>
            <p className="text-sm truncate" style={{ color: 'var(--color-text-muted)' }}>{email}</p>
          </div>
        </div>

        {/* Dados */}
        <div className="app-card p-6 flex flex-col gap-6">
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
                    ...(active ? { backgroundColor: 'var(--color-brand)', color: '#fff' } : { color: 'var(--color-sidebar-text)' }),
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

          {/* Dados pessoais + endereço: um formulário (as abas só escondem) */}
          <form onSubmit={handleSubmit(onSubmit, onInvalid)} className={activeTab === 'dados' || activeTab === 'endereco' ? 'flex flex-col gap-4' : 'hidden'}>
            <div className={activeTab === 'dados' ? 'flex flex-col gap-4' : 'hidden'}>
              <Input label="Nome completo *" placeholder="Seu nome" error={errors.name?.message} {...register('name')} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <Input
                    label="CPF"
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    readOnly={cpfBloqueado}
                    className={cpfBloqueado ? 'bg-gray-50 cursor-not-allowed' : ''}
                    error={errors.cpf?.message}
                    {...register('cpf', {
                      onChange: cpfBloqueado ? undefined : (e) => { e.target.value = formatCpf(e.target.value) },
                    })}
                  />
                  {cpfBloqueado && (
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>O CPF não pode ser alterado.</p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <Input label="E-mail" value={email} readOnly className="bg-gray-50 cursor-not-allowed" />
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>É o seu login de acesso.</p>
                </div>
              </div>
            </div>

            <div className={activeTab === 'endereco' ? 'flex flex-col gap-4' : 'hidden'}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium" style={labelSty}>CEP</label>
                    {cepLoading && <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Buscando...</span>}
                  </div>
                  <input
                    type="text" placeholder="00000-000" inputMode="numeric" maxLength={9}
                    className={selectCls} style={selectSty}
                    {...register('cep', {
                      onChange: (e) => { e.target.value = maskCep(e.target.value) },
                      onBlur:   (e) => handleCepBlur(e.target.value),
                    })}
                  />
                  {errors.cep && <p className="text-xs" style={{ color: 'var(--color-error)' }}>{errors.cep.message}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium" style={labelSty}>UF</label>
                  <select className={selectCls} style={selectSty} {...register('uf')}>
                    <option value="">UF</option>
                    {UF_OPTIONS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
                <Input label="Cidade" placeholder="Cidade" {...register('cidade')} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Input label="Logradouro" placeholder="Rua, Avenida, etc." {...register('logradouro')} />
                </div>
                <Input label="Número" placeholder="Número" {...register('numero')} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Bairro" placeholder="Bairro" {...register('bairro')} />
                <Input label="Complemento" placeholder="Apto, sala..." {...register('complemento')} />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" loading={isSubmitting}>Salvar alterações</Button>
            </div>
          </form>

          {/* Senha: só o status; a troca é feita no modal (nova senha → confirmar → código) */}
          {activeTab === 'senha' && (
            <section className="w-full max-w-[380px] rounded-xl border p-5 flex flex-col gap-4" style={{ borderColor: 'var(--color-bg-surface)' }}>
              <div className="flex items-center gap-3">
                <span className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--color-brand)', color: 'var(--color-brand-light)' }}>
                  <Icon name="lock" size={28} />
                </span>
                <div className="min-w-0">
                  <h3 className="font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>Senha</h3>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Sua senha segura está cadastrada!</p>
                </div>
              </div>
              <Button type="button" className="w-full" onClick={() => setModalSenha(true)}>Alterar senha</Button>
              <ModalSenha open={modalSenha} onClose={() => setModalSenha(false)} />
            </section>
          )}

          {activeTab === 'seguranca' && <SegurancaTab temPin={perfil.tem_pin} pinAtualizadoEm={perfil.pin_atualizado_em} />}
        </div>
      </div>
    </>
  )
}
