import { createAdminClient } from '@/lib/supabase/server'

export type Perfil = {
  id: string
  name: string
  cpf: string | null
  avatar_url: string | null
  cep: string | null
  uf: string | null
  cidade: string | null
  logradouro: string | null
  bairro: string | null
  numero: string | null
  complemento: string | null
  /** Se o usuário já cadastrou o PIN de segurança (o hash nunca sai do servidor) */
  tem_pin: boolean
  pin_atualizado_em: string | null
}

export async function getPerfil(profileId: string): Promise<Perfil | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .select('id, name, cpf, avatar_url, cep, uf, cidade, logradouro, bairro, numero, complemento, security_pin_hash, security_pin_updated_at')
    .eq('id', profileId)
    .single()

  if (error || !data) return null
  const { security_pin_hash, security_pin_updated_at, ...perfil } = data as Record<string, unknown>
  return {
    ...(perfil as Omit<Perfil, 'tem_pin' | 'pin_atualizado_em'>),
    tem_pin: !!security_pin_hash,
    pin_atualizado_em: (security_pin_updated_at as string | null) ?? null,
  }
}
