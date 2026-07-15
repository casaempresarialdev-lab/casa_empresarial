'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { addMemberAction, updateMemberRoleAction, inviteUserAction, updateMemberProfileAction } from '../actions'
import type { MemberWithProfile } from '../queries'

const ROLE_OPTIONS = [
  { value: 'admin',      label: 'Administrador' },
  { value: 'member',     label: 'Membro' },
  { value: 'accountant', label: 'Contador' },
]

function formatCpf(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  member: MemberWithProfile | null
  currentUserRole: string
}

export function ModalUsuario({ open, onClose, companyId, member, currentUserRole }: Props) {
  const router = useRouter()
  const isEditing = !!member
  const isOwner = currentUserRole === 'owner'

  // ── Modo adição ──
  const [tab, setTab] = useState<'cpf' | 'invite'>('cpf')
  const [cpf, setCpf] = useState('')
  const [email, setEmail] = useState('')

  // ── Modo edição ──
  const [role, setRole] = useState('member')
  const [name, setName] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [cep, setCep] = useState('')
  const [uf, setUf] = useState('')
  const [cidade, setCidade] = useState('')
  const [logradouro, setLogradouro] = useState('')
  const [bairro, setBairro] = useState('')
  const [numero, setNumero] = useState('')
  const [complemento, setComplemento] = useState('')

  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTab('cpf')
      setCpf('')
      setEmail('')
      setRole(member?.role ?? 'member')
      setName(member?.profiles?.name ?? '')
      setAvatarPreview(member?.profiles?.avatar_url ?? null)
      setAvatarFile(null)
      setCep(member?.profiles?.cep ?? '')
      setUf(member?.profiles?.uf ?? '')
      setCidade(member?.profiles?.cidade ?? '')
      setLogradouro(member?.profiles?.logradouro ?? '')
      setBairro(member?.profiles?.bairro ?? '')
      setNumero(member?.profiles?.numero ?? '')
      setComplemento(member?.profiles?.complemento ?? '')
      setError('')
      setSuccessMsg('')
    }
  }, [open, member])

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setLoading(true)

    let result: { error?: string; success?: boolean; warning?: string; avatar_url?: string }

    if (isEditing) {
      if (isOwner) {
        result = await updateMemberProfileAction(member!.profile_id, companyId, {
          name,
          avatarFile,
          cep, uf, cidade, logradouro, bairro, numero, complemento,
        })
      } else {
        result = await updateMemberRoleAction(member!.id, role)
      }
    } else if (tab === 'cpf') {
      result = await addMemberAction(companyId, cpf, role)
    } else {
      result = await inviteUserAction(companyId, email, role)
    }

    setLoading(false)

    if ('warning' in result && result.warning) {
      setSuccessMsg(result.warning)
      router.refresh()
      return
    }
    if ('error' in result && result.error) {
      setError(result.error)
      return
    }

    onClose()
    router.refresh()
  }

  const roleOptions = isEditing && member?.role === 'owner'
    ? [{ value: 'owner', label: 'Proprietário' }, ...ROLE_OPTIONS]
    : ROLE_OPTIONS

  const disabled = isEditing && !isOwner && member?.role === 'owner'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Editar membro' : 'Adicionar membro'}
      description={isEditing ? (member?.profiles?.name ?? '') : undefined}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* ── Abas — só no modo adição ── */}
        {!isEditing && (
          <div className="flex rounded-lg p-1" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            {(['cpf', 'invite'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setTab(t); setError('') }}
                className="flex-1 py-1.5 text-sm rounded-md transition-all font-medium"
                style={tab === t
                  ? { backgroundColor: 'white', color: 'var(--color-text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                  : { color: 'var(--color-text-muted)' }
                }
              >
                {t === 'cpf' ? 'Buscar por CPF' : 'Convidar por e-mail'}
              </button>
            ))}
          </div>
        )}

        {!isEditing && tab === 'cpf' && (
          <Input
            label="CPF do usuário"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(formatCpf(e.target.value))}
            required
          />
        )}

        {!isEditing && tab === 'invite' && (
          <Input
            label="E-mail do usuário"
            type="email"
            placeholder="usuario@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            hint="O usuário receberá um e-mail com o link para criar a conta"
            required
          />
        )}

        {/* ── Modo edição ── */}
        {isEditing && (
          <>
            {/* Seção: Identificação */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
                Identificação
              </p>

              {/* Avatar */}
              <div className="flex items-center gap-4 mb-4">
                <div className="relative">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold overflow-hidden shrink-0"
                    style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-darker)' }}
                  >
                    {avatarPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      name?.charAt(0).toUpperCase() ?? '?'
                    )}
                  </div>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs border-2 border-white"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                      title="Alterar foto"
                    >
                      ✏️
                    </button>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {isOwner ? 'Clique no ícone para alterar a foto' : 'Foto de perfil'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    JPG, PNG ou WebP — máx. 2 MB
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Input
                    label="Nome completo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!isOwner}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    label="CPF"
                    value={formatCpf(member?.profiles?.cpf ?? '')}
                    disabled
                  />
                </div>
              </div>
            </div>

            {/* Seção: Função */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
                Função na empresa
              </p>
              <Select
                label="Função"
                options={roleOptions}
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={disabled || (!isOwner && member?.role === 'owner')}
              />
              {!isOwner && (
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  Apenas proprietários podem editar perfis e alterar funções.
                </p>
              )}
            </div>

            {/* Seção: Endereço */}
            {isOwner && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
                  Endereço
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="CEP" value={cep} onChange={(e) => setCep(e.target.value)} placeholder="00000-000" />
                  <Input label="UF" value={uf} onChange={(e) => setUf(e.target.value)} placeholder="SP" />
                  <div className="col-span-2">
                    <Input label="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <Input label="Logradouro" value={logradouro} onChange={(e) => setLogradouro(e.target.value)} placeholder="Rua, Av., etc." />
                  </div>
                  <Input label="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} />
                  <Input label="Número" value={numero} onChange={(e) => setNumero(e.target.value)} />
                  <div className="col-span-2">
                    <Input label="Complemento" value={complemento} onChange={(e) => setComplemento(e.target.value)} placeholder="Apto, sala, etc." />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Função no modo adição ── */}
        {!isEditing && (
          <Select
            label="Função"
            options={roleOptions}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
        )}

        {error && (
          <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>
            {error}
          </p>
        )}
        {successMsg && (
          <p className="text-sm p-3 rounded-lg bg-yellow-50 text-yellow-800">
            {successMsg}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading} disabled={isEditing && !isOwner && member?.role !== 'owner'}>
            {isEditing ? 'Salvar' : tab === 'invite' ? 'Enviar convite' : 'Adicionar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
