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
  } | null
}

export async function getCompanyMembers(companyId: string): Promise<MemberWithProfile[]> {
  const admin = createAdminClient()
  // profiles!profile_id(...) especifica qual FK usar (evita PGRST201 com invited_by)
  const { data, error } = await admin
    .from('company_members')
    .select('id, role, status, created_at, profile_id, profiles!profile_id(name, cpf, avatar_url)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`[company_members] ${error.code}: ${error.message} — ${error.details ?? ''}`)
  return (data ?? []) as unknown as MemberWithProfile[]
}
