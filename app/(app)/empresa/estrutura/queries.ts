import { createAdminClient } from '@/lib/supabase/server'
import type { AdicionalCargo } from '@/lib/folha/config'
import type { Cargo, CargoOpcao, Departamento } from './tipos'

type LinhaCargo = {
  id: string
  nome: string
  department_id: string
  superior_id: string | null
  salario_min: number | null
  salario_max: number | null
  adicional?: AdicionalCargo | null
  bate_ponto?: boolean | null
  departments: { nome: string } | null
}

// '*': a coluna "adicional" vem da migration 20261110000102
const COLS = '*, departments(nome)'

/** Lista dos formulários (sem a migration 20261108000090: vazia) */
export async function getCargosOpcoes(companyId: string): Promise<CargoOpcao[]> {
  const { data, error } = await createAdminClient().from('job_positions').select(COLS).eq('company_id', companyId).order('nome', { ascending: true })
  if (error) { console.error('[estrutura] cargos indisponíveis:', error.message); return [] }
  return (data as unknown as LinhaCargo[]).map((c) => ({
    id: c.id,
    nome: c.nome,
    departamento: c.departments?.nome ?? '',
    salario_min: c.salario_min,
    salario_max: c.salario_max,
    adicional: c.adicional ?? 'nenhum',
  }))
}

/** Departamentos, cargos e quem ocupa cada cargo, com as fotos */
export async function getEstrutura(companyId: string): Promise<{ departamentos: Departamento[]; cargos: Cargo[] }> {
  const admin = createAdminClient()
  const [{ data: deps, error: e1 }, { data: linhas, error: e2 }, { data: pessoas }, { data: membros }] = await Promise.all([
    admin.from('departments').select('id, nome').eq('company_id', companyId).order('nome', { ascending: true }),
    admin.from('job_positions').select(COLS).eq('company_id', companyId).order('nome', { ascending: true }),
    admin
      .from('employees')
      .select('*')
      .eq('company_id', companyId)
      .not('status', 'in', '(inativo,demitido,admissao)')
      .order('nome', { ascending: true }),
    // Usuários sem ficha na Equipe, ligados direto a um cargo ('*': a coluna pode ainda não existir)
    admin.from('company_members').select('*, profiles!profile_id(name, avatar_url)').eq('company_id', companyId).eq('status', 'active'),
  ])
  if (e1 || e2) {
    console.error('[estrutura] indisponível:', e1?.message ?? e2?.message)
    return { departamentos: [], cargos: [] }
  }

  type Pessoa = { id: string; nome: string; position_id?: string | null; foto_path: string | null }
  const ocupantes = ((pessoas ?? []) as Pessoa[]).filter((p) => p.position_id)
  const fotos = new Map<string, string>()
  await Promise.all(ocupantes.filter((p) => p.foto_path).map(async (p) => {
    const { data } = await admin.storage.from('documentos').createSignedUrl(p.foto_path!, 3600)
    if (data?.signedUrl) fotos.set(p.id, data.signedUrl)
  }))

  type Membro = { profile_id: string; position_id?: string | null; profiles: { name: string | null; avatar_url: string | null } | null }
  const usuarios = ((membros ?? []) as unknown as Membro[]).filter((m) => m.position_id)

  return {
    departamentos: (deps ?? []) as Departamento[],
    cargos: (linhas as unknown as LinhaCargo[]).map(({ departments, ...c }) => ({
      id: c.id,
      nome: c.nome,
      department_id: c.department_id,
      superior_id: c.superior_id,
      salario_min: c.salario_min,
      salario_max: c.salario_max,
      adicional: c.adicional ?? 'nenhum',
      bate_ponto: c.bate_ponto !== false,
      departamento: departments?.nome ?? '',
      ocupantes: [
        ...ocupantes.filter((p) => p.position_id === c.id).map((p) => ({ id: p.id, nome: p.nome, foto: fotos.get(p.id) ?? null })),
        ...usuarios.filter((m) => m.position_id === c.id).map((m) => ({ id: m.profile_id, nome: m.profiles?.name ?? 'Usuário', foto: m.profiles?.avatar_url ?? null })),
      ],
    })),
  }
}
