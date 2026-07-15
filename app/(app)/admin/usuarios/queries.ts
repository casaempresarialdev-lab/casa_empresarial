import { createAdminClient } from '@/lib/supabase/server'

export type MemberWithProfile = {
  id: string
  role: string
  status: string
  created_at: string
  profile_id: string
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
}

export async function getCompanyMembers(companyId: string): Promise<MemberWithProfile[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('company_members')
    .select('id, role, status, created_at, profile_id, profiles!profile_id(name, cpf, avatar_url, cep, uf, cidade, logradouro, bairro, numero, complemento)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`[company_members] ${error.code}: ${error.message} — ${error.details ?? ''}`)
  return (data ?? []) as unknown as MemberWithProfile[]
}

export async function getPendingInvitations(companyId: string): Promise<Invitation[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('invitations')
    .select('id, email, role, status, created_at, expires_at')
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Invitation[]
}
