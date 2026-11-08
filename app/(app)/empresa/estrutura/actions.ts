'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { semAcesso } from '@/lib/auth/acesso'
import { requireGestor } from '@/lib/auth/gestor'
import { cargoSchema, departamentoSchema } from '@/lib/validations/estrutura'
import { normalizarValor } from '../../pessoas/funcionarios/components/ficha/ficha-config'
import { criaCiclo } from './tipos'

/** Faz parte de Minha Empresa. Colaborador não altera a estrutura. */
async function bloqueio(companyId: string) {
  const negado = await semAcesso('sistema.empresa', companyId)
  if (negado) return negado
  const auth = await requireGestor(companyId)
  return 'error' in auth ? { error: auth.error as string } : null
}
type Admin = ReturnType<typeof createAdminClient>

function revalidar() {
  revalidatePath('/empresa')
  revalidatePath('/admin/usuarios')
  revalidatePath('/pessoas/funcionarios')
  revalidatePath('/pessoas/vagas')
}

const hierarquia = async (admin: Admin, companyId: string) => {
  const { data } = await admin.from('job_positions').select('id, superior_id').eq('company_id', companyId)
  return (data ?? []) as { id: string; superior_id: string | null }[]
}

/** Fichas e vagas guardam o nome do cargo e do departamento: acompanham o cadastro */
async function copiarTextos(admin: Admin, companyId: string, positionId: string, cargo: string, departamento: string) {
  await Promise.all([
    admin.from('employees').update({ cargo, departamento }).eq('company_id', companyId).eq('position_id', positionId),
    admin.from('job_openings').update({ cargo, departamento }).eq('company_id', companyId).eq('position_id', positionId),
  ])
}

export async function salvarDepartamentoAction(companyId: string, id: string | null, data: unknown) {
  const negado = await bloqueio(companyId)
  if (negado) return negado

  const parsed = departamentoSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { nome } = parsed.data

  const admin = createAdminClient()
  const { error } = id
    ? await admin.from('departments').update({ nome }).eq('id', id).eq('company_id', companyId)
    : await admin.from('departments').insert({ company_id: companyId, nome })
  if (error) return { error: error.code === '23505' ? 'Já existe um departamento com esse nome.' : error.message }

  if (id) {
    const { data: cargos } = await admin.from('job_positions').select('id').eq('company_id', companyId).eq('department_id', id)
    const ids = (cargos ?? []).map((c) => c.id as string)
    if (ids.length) {
      await Promise.all([
        admin.from('employees').update({ departamento: nome }).eq('company_id', companyId).in('position_id', ids),
        admin.from('job_openings').update({ departamento: nome }).eq('company_id', companyId).in('position_id', ids),
      ])
    }
  }
  revalidar()
  return { success: true as const }
}

export async function excluirDepartamentoAction(companyId: string, id: string) {
  const negado = await bloqueio(companyId)
  if (negado) return negado

  const admin = createAdminClient()
  const { count } = await admin.from('job_positions').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('department_id', id)
  if (count) return { error: `Este departamento tem ${count} ${count === 1 ? 'cargo' : 'cargos'}. Mova ou exclua antes.` }

  const { error } = await admin.from('departments').delete().eq('id', id).eq('company_id', companyId)
  if (error) return { error: error.message }
  revalidar()
  return { success: true as const }
}

export async function salvarCargoAction(companyId: string, id: string | null, data: unknown) {
  const negado = await bloqueio(companyId)
  if (negado) return negado

  const parsed = cargoSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const d = parsed.data

  const salarioMin = d.salario_min ? Number(normalizarValor(d.salario_min)) : null
  const salarioMax = d.salario_max ? Number(normalizarValor(d.salario_max)) : null
  if (salarioMin != null && salarioMax != null && salarioMin > salarioMax) return { error: 'O salário mínimo não pode ser maior que o máximo.' }

  const admin = createAdminClient()
  const { data: dep } = await admin.from('departments').select('nome').eq('id', d.department_id).eq('company_id', companyId).maybeSingle()
  if (!dep) return { error: 'Escolha o departamento.' }

  const cargos = await hierarquia(admin, companyId)
  if (d.superior_id && !cargos.some((c) => c.id === d.superior_id)) return { error: 'Cargo superior não encontrado.' }
  if (id && d.superior_id && criaCiclo(cargos, id, d.superior_id)) return { error: 'Um cargo não pode responder a si mesmo nem a um cargo abaixo dele.' }

  const campos = {
    nome: d.nome,
    department_id: d.department_id,
    superior_id: d.superior_id || null,
    salario_min: salarioMin,
    salario_max: salarioMax,
    updated_at: new Date().toISOString(),
  }
  const { error } = id
    ? await admin.from('job_positions').update(campos).eq('id', id).eq('company_id', companyId)
    : await admin.from('job_positions').insert({ ...campos, company_id: companyId })
  if (error) return { error: error.code === '23505' ? 'Já existe esse cargo neste departamento.' : error.message }

  if (id) await copiarTextos(admin, companyId, id, d.nome, dep.nome as string)
  revalidar()
  return { success: true as const }
}

/** Organograma: muda a quem o cargo responde (null = topo da hierarquia) */
export async function moverCargoAction(companyId: string, id: string, superiorId: string | null) {
  const negado = await bloqueio(companyId)
  if (negado) return negado

  const admin = createAdminClient()
  const cargos = await hierarquia(admin, companyId)
  if (!cargos.some((c) => c.id === id)) return { error: 'Cargo não encontrado.' }
  if (superiorId && !cargos.some((c) => c.id === superiorId)) return { error: 'Cargo superior não encontrado.' }
  if (superiorId && criaCiclo(cargos, id, superiorId)) return { error: 'Um cargo não pode responder a si mesmo nem a um cargo abaixo dele.' }

  const { error } = await admin
    .from('job_positions')
    .update({ superior_id: superiorId, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', companyId)
  if (error) return { error: error.message }
  revalidatePath('/empresa')
  return { success: true as const }
}

/** Quem respondia a este cargo passa a responder ao superior dele */
export async function excluirCargoAction(companyId: string, id: string) {
  const negado = await bloqueio(companyId)
  if (negado) return negado

  const admin = createAdminClient()
  const { count } = await admin
    .from('employees')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('position_id', id)
    .not('status', 'in', '(inativo,demitido)')
  const { count: usuarios } = await admin.from('company_members').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('position_id', id).eq('status', 'active')
  const total = (count ?? 0) + (usuarios ?? 0)
  if (total) return { error: `Este cargo tem ${total} ${total === 1 ? 'pessoa' : 'pessoas'}. Troque o cargo delas antes de excluir.` }

  const { data: cargo } = await admin.from('job_positions').select('superior_id').eq('id', id).eq('company_id', companyId).maybeSingle()
  if (!cargo) return { error: 'Cargo não encontrado.' }

  const { error: errFilhos } = await admin.from('job_positions').update({ superior_id: cargo.superior_id }).eq('company_id', companyId).eq('superior_id', id)
  if (errFilhos) return { error: errFilhos.message }
  const { error } = await admin.from('job_positions').delete().eq('id', id).eq('company_id', companyId)
  if (error) return { error: error.message }
  revalidar()
  return { success: true as const }
}
