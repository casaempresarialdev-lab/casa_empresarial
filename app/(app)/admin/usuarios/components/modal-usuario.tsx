'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { atualizarCargoMembroAction, atualizarPerfisMembroAction, inviteUserAction, updateMemberProfileAction } from '../actions'
import type { MemberWithProfile, PerfilAcesso } from '../queries'
import { toast } from '@/lib/toast'
import { CampoCargo } from '../../../empresa/estrutura/components/campo-cargo'
import type { CargoOpcao } from '../../../empresa/estrutura/tipos'

const FUNCAO_FIXA: Record<string, string> = {
  owner: 'Proprietário: acesso total à empresa, sem depender de perfil.',
  colaborador: 'Colaborador: acesso somente aos próprios dados, sem depender de perfil.',
}

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
  perfis: PerfilAcesso[]
  cargos: CargoOpcao[]
}

export function ModalUsuario({ open, onClose, companyId, member, currentUserRole, perfis, cargos }: Props) {
  const router = useRouter()
  const isEditing = !!member
  const isOwner = currentUserRole === 'owner'
  // Proprietário e colaborador têm acesso definido à parte, sem perfil
  const funcaoFixa = member ? FUNCAO_FIXA[member.role] : undefined
  const temPerfil = !funcaoFixa

  // ── Modo adição: só e-mail e perfil de acesso; depois do envio, tela de confirmação ──
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState<{ titulo: string; texto: string } | null>(null)

  // ── Modo edição ──
  const [perfilIds, setPerfilIds] = useState<string[]>([])
  const [cargoId, setCargoId] = useState('')
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
      setEmail('')
      setEnviado(null)
      // Convite novo já vem com o perfil Funcionário marcado
      setPerfilIds(member ? member.access_profile_ids : perfis.filter((p) => p.padrao === 'funcionario').map((p) => p.id))
      setCargoId(member?.cargo_id ?? '')
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
    if (temPerfil && perfilIds.length === 0) { setError('Escolha ao menos um perfil de acesso.'); return }
    setLoading(true)

    let result: { error?: string; success?: boolean; warning?: string; notice?: string; emailEnviado?: boolean; contaExistente?: boolean; avatar_url?: string }

    if (isEditing) {
      result = { success: true }
      if (isOwner) {
        result = await updateMemberProfileAction(member!.profile_id, companyId, {
          name,
          avatarFile,
          cep, uf, cidade, logradouro, bairro, numero, complemento,
        })
      }
      if (!result.error && temPerfil && [...perfilIds].sort().join() !== [...member!.access_profile_ids].sort().join()) {
        result = await atualizarPerfisMembroAction(companyId, member!.id, perfilIds)
      }
      if (!result.error && cargos.length > 0 && cargoId !== (member!.cargo_id ?? '')) {
        result = await atualizarCargoMembroAction(companyId, member!.id, cargoId)
      }
    } else {
      result = await inviteUserAction(companyId, email, perfilIds)
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

    // Adição: e-mail saiu → confirmação no próprio modal
    if (!isEditing && 'emailEnviado' in result && result.emailEnviado) {
      setEnviado('contaExistente' in result && result.contaExistente
        ? { titulo: 'Acesso liberado', texto: `${email.trim()} já tinha conta e foi adicionado(a) à empresa. Enviamos um e-mail avisando.` }
        : { titulo: 'E-mail enviado', texto: `Enviamos o convite de acesso para ${email.trim()}. O link para cadastrar a senha vale por 7 dias.` })
      router.refresh()
      return
    }
    // Resultado exato do e-mail: ✓ quando saiu, ✕ quando não saiu (o acesso pode ter sido liberado mesmo assim)
    if ('notice' in result && result.notice) {
      if (result.emailEnviado) toast(result.notice)
      else toast.error(result.notice)
    }

    onClose()
    router.refresh()
  }

  // Perfis acumulativos: o acesso é a soma dos marcados
  const escolhaPerfis = (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Perfis de acesso *</span>
      <div className="flex flex-col gap-2 rounded-lg border p-3" style={{ borderColor: 'var(--color-bg-surface)' }}>
        {perfis.length === 0 && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Nenhum perfil cadastrado.</p>}
        {perfis.map((p) => (
          <label key={p.id} className="flex items-center gap-2.5 text-sm cursor-pointer" style={{ color: 'var(--color-text-primary)' }}>
            <input
              type="checkbox"
              className="w-4 h-4 shrink-0"
              style={{ accentColor: 'var(--color-brand)' }}
              checked={perfilIds.includes(p.id)}
              onChange={(e) => setPerfilIds((ids) => (e.target.checked ? [...ids, p.id] : ids.filter((id) => id !== p.id)))}
            />
            {p.nome}
          </label>
        ))}
      </div>
      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Com mais de um perfil, o acesso é a soma de todos.</p>
    </div>
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Editar membro' : 'Adicionar usuário'}
      description={isEditing ? (member?.profiles?.name ?? '') : undefined}
    >
      {/* ── Confirmação depois do envio ── */}
      {enviado ? (
        <div className="flex flex-col items-center text-center gap-3 py-2">
          <span className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
            <Icon name="mail" size={30} />
          </span>
          <h3 className="text-lg font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{enviado.titulo}</h3>
          <p className="text-sm max-w-xs" style={{ color: 'var(--color-text-muted)' }}>{enviado.texto}</p>
          <div className="flex gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={() => { setEnviado(null); setEmail('') }}>Convidar outro</Button>
            <Button type="button" onClick={onClose}>Fechar</Button>
          </div>
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* ── Modo adição: e-mail que recebe o convite ── */}
        {!isEditing && (
          <Input
            label="E-mail"
            type="email"
            placeholder="usuario@email.com"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            hint="Enviaremos um convite com o link para a pessoa cadastrar a senha."
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
                Cargo e acesso na empresa
              </p>
              <div className="mb-4 flex flex-col gap-1">
                <CampoCargo cargos={cargos} value={cargoId} onChange={(c) => setCargoId(c?.id ?? '')} />
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {member?.tem_ficha ? 'É o mesmo cargo da ficha desta pessoa na Equipe.' : 'Coloca a pessoa no organograma.'}
                </p>
              </div>
              {funcaoFixa ? (
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{funcaoFixa}</p>
              ) : escolhaPerfis}
              {!isOwner && (
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  Apenas proprietários podem editar nome, foto e endereço.
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

        {/* ── Perfil de acesso no modo adição ── */}
        {!isEditing && escolhaPerfis}

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
          <Button type="submit" loading={loading}>
            {isEditing ? 'Salvar' : 'Enviar convite'}
          </Button>
        </div>
      </form>
      )}
    </Modal>
  )
}
