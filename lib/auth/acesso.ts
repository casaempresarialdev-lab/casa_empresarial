import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { pode, primeiraRota, type Permissoes } from '@/lib/acesso/catalogo'

// Checagem dos perfis de acesso. Fica em cada página e em cada Server Action, e não no proxy: o proxy não deve
// consultar o banco, e as Server Functions precisam verificar a permissão por conta própria (guia do Next).

const SEM_PERMISSAO = 'Seu perfil de acesso não permite esta ação.'
const ITENS_FUNCIONARIO = ['visao-geral.calendario', 'visao-geral.bater-ponto']
// Erros de tabela inexistente: a migration ainda não foi aplicada
const TABELA_AUSENTE = ['42P01', 'PGRST200', 'PGRST205']

/**
 * O que o usuário logado pode fazer nesta empresa: a soma dos perfis dele. Vazio se não for membro ativo.
 * Proprietário e perfil Administrador: tudo. Colaborador: regra própria (proxy e telas de Pessoas).
 * Sem a migration 20261108000088: como antes.
 */
export const getPermissoes = cache(async (companyId: string): Promise<{ autenticado: boolean; permissoes: Permissoes; perfilNome: string | null }> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { autenticado: false, permissoes: [], perfilNome: null }

  const admin = createAdminClient()
  const { data: membro } = await admin
    .from('company_members')
    .select('id, role')
    .eq('company_id', companyId)
    .eq('profile_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!membro) return { autenticado: true, permissoes: [], perfilNome: null }
  if (membro.role === 'owner' || membro.role === 'colaborador') return { autenticado: true, permissoes: null, perfilNome: null }

  const { data: vinculos, error } = await admin
    .from('member_access_profiles')
    .select('access_profiles(nome, padrao, permissoes)')
    .eq('member_id', membro.id)
  if (error) return { autenticado: true, permissoes: TABELA_AUSENTE.includes(error.code) ? null : [], perfilNome: null }

  type Perfil = { nome: string; padrao: string | null; permissoes: string[] }
  const perfis = (vinculos ?? []).flatMap((v) => (v.access_profiles ?? []) as unknown as Perfil | Perfil[])
  const perfilNome = perfis.map((p) => p.nome).sort().join(', ') || null
  if (perfis.some((p) => p.padrao === 'administrador')) return { autenticado: true, permissoes: null, perfilNome }
  // Perfil com cadeado: o que ele libera é regra do sistema, como o acesso total do Administrador
  const liberados = perfis.flatMap((p) => (p.padrao === 'funcionario' ? [...p.permissoes, ...ITENS_FUNCIONARIO] : p.permissoes))
  return { autenticado: true, permissoes: [...new Set(liberados)], perfilNome }
})

const empresaAtiva = async () => (await cookies()).get('active_company_id')?.value

/**
 * Para Server Actions: devolve o erro a retornar quando o perfil não libera o item, ou null.
 * Com uma lista, basta um dos itens (ação usada por mais de um módulo).
 */
export async function semAcesso(item: string | string[], companyId?: string): Promise<{ error: string } | null> {
  const empresa = companyId ?? await empresaAtiva()
  if (!empresa) return { error: 'Selecione uma empresa.' }
  const { autenticado, permissoes } = await getPermissoes(empresa)
  if (!autenticado) return { error: 'Não autenticado' }
  const itens = Array.isArray(item) ? item : [item]
  return itens.some((i) => pode(permissoes, i)) ? null : { error: SEM_PERMISSAO }
}

/** Para páginas: sem acesso ao item, vai para a Visão geral. Sem login ou empresa, a própria página trata. */
export async function exigirAcessoPagina(item: string) {
  const empresa = await empresaAtiva()
  if (!empresa) return
  const { autenticado, permissoes } = await getPermissoes(empresa)
  if (autenticado && !pode(permissoes, item)) redirect(primeiraRota())
}
