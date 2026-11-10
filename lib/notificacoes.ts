import type { createAdminClient } from '@/lib/supabase/server'
import { pode, type Permissoes } from '@/lib/acesso/catalogo'

// Notificações entre o colaborador e quem cuida do assunto na área de Pessoas.
// Nunca derrubam a ação que as gerou: se falharem, só ficam registradas no log.

type Admin = ReturnType<typeof createAdminClient>
export type TipoNotificacao = 'ponto' | 'ausencia' | 'ferias' | 'folha' | 'saude'

type Conteudo = { tipo: TipoNotificacao; titulo: string; mensagem: string; link: string }

// Mesmas regras de lib/auth/acesso.ts (getPermissoes), para outros usuários
const ITENS_FUNCIONARIO = ['visao-geral.calendario', 'visao-geral.bater-ponto']
const TABELA_AUSENTE = ['42P01', 'PGRST200', 'PGRST205']

const fmt = (iso: string) => iso.split('-').reverse().join('/').slice(0, 5)
export const periodoTexto = (inicio: string, fim: string) => (inicio === fim ? fmt(inicio) : `${fmt(inicio)} a ${fmt(fim)}`)

async function gravar(admin: Admin, companyId: string, para: string[], c: Conteudo) {
  if (!para.length) return
  const { error } = await admin.from('notifications').insert(para.map((profile_id) => ({ company_id: companyId, profile_id, ...c })))
  if (error) console.error('[notificações] não gravadas:', error.message)
}

/** Usuários ativos da empresa (fora colaboradores) cujo perfil libera o item */
async function gestoresDo(admin: Admin, companyId: string, item: string): Promise<string[]> {
  const { data: membros } = await admin.from('company_members').select('id, profile_id, role').eq('company_id', companyId).eq('status', 'active').neq('role', 'colaborador')
  const lista = (membros ?? []) as { id: string; profile_id: string; role: string }[]
  if (!lista.length) return []

  const { data: vinculos, error } = await admin.from('member_access_profiles').select('member_id, access_profiles(padrao, permissoes)').in('member_id', lista.map((m) => m.id))
  if (error) return TABELA_AUSENTE.includes(error.code) ? lista.map((m) => m.profile_id) : lista.filter((m) => m.role === 'owner').map((m) => m.profile_id)

  type Perfil = { padrao: string | null; permissoes: string[] }
  const perfisDe = new Map<string, Perfil[]>()
  for (const v of (vinculos ?? []) as unknown as { member_id: string; access_profiles: Perfil | Perfil[] | null }[]) {
    const p = v.access_profiles
    perfisDe.set(v.member_id, [...(perfisDe.get(v.member_id) ?? []), ...(Array.isArray(p) ? p : p ? [p] : [])])
  }

  return lista.filter((m) => {
    if (m.role === 'owner') return true
    const perfis = perfisDe.get(m.id) ?? []
    if (perfis.some((p) => p.padrao === 'administrador')) return true
    const permissoes: Permissoes = perfis.flatMap((p) => (p.padrao === 'funcionario' ? [...p.permissoes, ...ITENS_FUNCIONARIO] : p.permissoes))
    return pode(permissoes, item)
  }).map((m) => m.profile_id)
}

/** Avisa quem tem acesso ao item de gestão (ex.: 'pessoas.ferias'), menos quem fez a ação */
export async function notificarGestores(admin: Admin, opcoes: Conteudo & { companyId: string; item: string; autorId?: string | null }) {
  try {
    const { companyId, item, autorId, ...c } = opcoes
    const para = (await gestoresDo(admin, companyId, item)).filter((id) => id !== autorId)
    await gravar(admin, companyId, [...new Set(para)], c)
  } catch (e) {
    console.error('[notificações] gestores:', e)
  }
}

/** Avisa o colaborador dono da ficha, se ele tiver acesso ao sistema e não for quem fez a ação */
export async function notificarFuncionario(admin: Admin, opcoes: Conteudo & { companyId: string; employeeId: string; autorId?: string | null }) {
  try {
    const { companyId, employeeId, autorId, ...c } = opcoes
    const { data } = await admin.from('employees').select('profile_id').eq('id', employeeId).eq('company_id', companyId).maybeSingle()
    const destino = data?.profile_id as string | null | undefined
    if (destino && destino !== autorId) await gravar(admin, companyId, [destino], c)
  } catch (e) {
    console.error('[notificações] funcionário:', e)
  }
}

export async function nomeDoFuncionario(admin: Admin, employeeId: string) {
  const { data } = await admin.from('employees').select('nome').eq('id', employeeId).maybeSingle()
  return (data?.nome as string | undefined) ?? 'Um colaborador'
}

export type AvisoSistema = { id: string; tipo: TipoNotificacao; titulo: string; mensagem: string; link: string | null; visto: boolean; em: string }

/** Notificações do usuário na empresa ativa (sem a migration 20261110000101: nenhuma) */
export async function getAvisosSistema(admin: Admin, profileId: string, companyId: string | undefined, limite = 30): Promise<AvisoSistema[]> {
  if (!companyId) return []
  const { data, error } = await admin
    .from('notifications')
    .select('id, tipo, titulo, mensagem, link, visto_em, created_at')
    .eq('profile_id', profileId)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limite)
  if (error) return []
  return (data ?? []).map((n) => ({
    id: n.id as string, tipo: n.tipo as TipoNotificacao, titulo: n.titulo as string, mensagem: n.mensagem as string,
    link: n.link as string | null, visto: !!n.visto_em, em: n.created_at as string,
  }))
}

export async function marcarAvisosSistemaVistos(admin: Admin, profileId: string) {
  await admin.from('notifications').update({ visto_em: new Date().toISOString() }).eq('profile_id', profileId).is('visto_em', null)
}
