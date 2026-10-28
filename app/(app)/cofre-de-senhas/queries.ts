import { createAdminClient } from '@/lib/supabase/server'

export type Compartilhamento = {
  id: string
  email: string
  nome: string | null
}

export type Credential = {
  id: string
  sistema: string
  login: string
  url: string | null
  observacao: string | null
  created_at: string
  updated_at: string
  /** Com quem o dono compartilhou (só nas minhas credenciais) */
  compartilhamentos: Compartilhamento[]
}

export type CredencialCompartilhada = {
  id: string
  sistema: string
  login: string
  url: string | null
  observacao: string | null
  /** Quem compartilhou */
  dono_nome: string
  compartilhada_em: string
}

export type Cofre = {
  minhas: Credential[]
  compartilhadas: CredencialCompartilhada[]
  /** Ver e compartilhar senhas exige o PIN de segurança */
  temPin: boolean
}

// Cofre pessoal: credenciais do usuário + as que outros compartilharam com ele (a senha nunca vem nesta consulta)
export async function getCofre(profileId: string): Promise<Cofre> {
  const admin = createAdminClient()
  const [{ data: minhas, error }, { data: recebidas }, { data: perfil }] = await Promise.all([
    admin
      .from('credentials')
      .select('id, sistema, login, url, observacao, created_at, updated_at')
      .eq('profile_id', profileId)
      .order('sistema', { ascending: true }),
    // Se a tabela de compartilhamentos ainda não existir no banco, a lista fica vazia
    admin
      .from('credential_shares')
      .select('created_at, owner_id, credentials(id, sistema, login, url, observacao)')
      .eq('shared_with', profileId),
    admin.from('profiles').select('security_pin_hash').eq('id', profileId).maybeSingle(),
  ])
  if (error) throw error

  const ids = (minhas ?? []).map((c) => c.id)
  const { data: shares } = ids.length
    ? await admin.from('credential_shares').select('id, credential_id, shared_with, shared_with_email').in('credential_id', ids)
    : { data: [] as { id: string; credential_id: string; shared_with: string; shared_with_email: string }[] }

  type Recebida = {
    created_at: string
    owner_id: string
    credentials: { id: string; sistema: string; login: string; url: string | null; observacao: string | null } | null
  }
  const recebidasRows = (recebidas ?? []) as unknown as Recebida[]

  // Nomes de quem recebeu e de quem compartilhou, de uma vez
  const perfisIds = [...new Set([...(shares ?? []).map((s) => s.shared_with), ...recebidasRows.map((r) => r.owner_id)])]
  const { data: perfis } = perfisIds.length
    ? await admin.from('profiles').select('id, name').in('id', perfisIds)
    : { data: [] as { id: string; name: string }[] }
  const nomePorId = new Map((perfis ?? []).map((p) => [p.id, p.name]))

  return {
    minhas: (minhas ?? []).map((c) => ({
      ...c,
      compartilhamentos: (shares ?? [])
        .filter((s) => s.credential_id === c.id)
        .map((s) => ({ id: s.id, email: s.shared_with_email, nome: nomePorId.get(s.shared_with) ?? null })),
    })) as Credential[],
    compartilhadas: recebidasRows
      .filter((r) => r.credentials)
      .map((r) => ({
        ...r.credentials!,
        dono_nome: nomePorId.get(r.owner_id) ?? 'Outro usuário',
        compartilhada_em: r.created_at,
      }))
      .sort((a, b) => a.sistema.localeCompare(b.sistema, 'pt-BR')),
    temPin: !!(perfil as { security_pin_hash?: string | null } | null)?.security_pin_hash,
  }
}

/** Notificação: alguém compartilhou uma credencial do cofre com o usuário */
export type AvisoCompartilhamento = {
  id: string
  sistema: string
  dono_nome: string
  created_at: string
  aviso_visto_em: string | null
}

/** Compartilhamentos recebidos (mais recentes primeiro), para o sino e a página de notificações */
export async function getAvisosCompartilhamento(profileId: string, limite = 50): Promise<AvisoCompartilhamento[]> {
  const admin = createAdminClient()
  // '*': tolera a coluna aviso_visto_em ainda não criada no banco
  const { data, error } = await admin
    .from('credential_shares')
    .select('*, credentials(sistema)')
    .eq('shared_with', profileId)
    .order('created_at', { ascending: false })
    .limit(limite)
  if (error || !data) return []

  type Row = { id: string; owner_id: string; created_at: string; aviso_visto_em?: string | null; credentials: { sistema: string } | null }
  const rows = (data as unknown as Row[]).filter((r) => r.credentials)
  const donos = [...new Set(rows.map((r) => r.owner_id))]
  const { data: perfis } = donos.length
    ? await admin.from('profiles').select('id, name').in('id', donos)
    : { data: [] as { id: string; name: string }[] }
  const nomePorId = new Map((perfis ?? []).map((p) => [p.id, p.name]))

  return rows.map((r) => ({
    id: r.id,
    sistema: r.credentials!.sistema,
    dono_nome: nomePorId.get(r.owner_id) ?? 'Outro usuário',
    created_at: r.created_at,
    aviso_visto_em: r.aviso_visto_em ?? null,
  }))
}
