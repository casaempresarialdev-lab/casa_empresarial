import { createAdminClient } from '@/lib/supabase/server'

export type MemberWithProfile = {
  id: string
  role: string
  status: string
  created_at: string
  profile_id: string
  /** Perfis de acesso, acumulativos (proprietário e colaborador não têm) */
  access_profile_ids: string[]
  /** Cargo da pessoa: o da ficha na Equipe ou, sem ficha, o do próprio vínculo */
  cargo_id: string | null
  /** Tem ficha ativa na Equipe: o cargo é o mesmo da ficha */
  tem_ficha: boolean
  position_id?: string | null
  profiles: {
    name: string | null
    cpf: string | null
    avatar_url: string | null
    cep: string | null
    uf: string | null
    cidade: string | null
    logradouro: string | null
    bairro: string | null
    numero: string | null
    complemento: string | null
  } | null
}

export type Invitation = {
  id: string
  email: string
  role: string
  status: string
  created_at: string
  expires_at: string
  avatar_url: string | null
  access_profile_ids?: string[] | null
}

export type PerfilAcesso = {
  id: string
  nome: string
  permissoes: string[]
  /** Perfil padrão, com cadeado */
  padrao: 'administrador' | 'funcionario' | null
}

const ORDEM_PADRAO = { administrador: 0, funcionario: 1 }

/** Perfis de acesso da empresa, os padrão primeiro (sem a migration 20261108000088: nenhum) */
export async function getPerfisAcesso(companyId: string): Promise<PerfilAcesso[]> {
  const { data, error } = await createAdminClient()
    .from('access_profiles')
    .select('*')
    .eq('company_id', companyId)
    .order('nome', { ascending: true })
  if (error) console.error('[acesso] perfis indisponíveis:', error.message)
  const ordem = (p: PerfilAcesso) => (p.padrao ? ORDEM_PADRAO[p.padrao] : 2)
  return ((data ?? []) as PerfilAcesso[]).filter((p) => 'padrao' in p).sort((a, b) => ordem(a) - ordem(b))
}

export async function getCompanyMembers(companyId: string): Promise<MemberWithProfile[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('company_members')
    .select('*, profiles!profile_id(name, cpf, avatar_url, cep, uf, cidade, logradouro, bairro, numero, complemento)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`[company_members] ${error.code}: ${error.message} — ${error.details ?? ''}`)

  const [{ data: vinculos }, { data: fichas }] = await Promise.all([
    admin.from('member_access_profiles').select('member_id, profile_id').eq('company_id', companyId),
    // '*': position_id pode ainda não existir (migration 20261108000090)
    admin.from('employees').select('*').eq('company_id', companyId).not('profile_id', 'is', null).not('status', 'in', '(inativo,demitido)'),
  ])
  const fichaDe = new Map((fichas ?? []).map((f) => [f.profile_id as string, f as { position_id?: string | null }]))
  return ((data ?? []) as unknown as MemberWithProfile[]).map((m) => ({
    ...m,
    cargo_id: (fichaDe.has(m.profile_id) ? fichaDe.get(m.profile_id)!.position_id : m.position_id) ?? null,
    tem_ficha: fichaDe.has(m.profile_id),
    access_profile_ids: (vinculos ?? []).filter((v) => v.member_id === m.id).map((v) => v.profile_id as string),
  }))
}

export async function getPendingInvitations(companyId: string): Promise<Invitation[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('invitations')
    .select('*')
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Invitation[]
}
