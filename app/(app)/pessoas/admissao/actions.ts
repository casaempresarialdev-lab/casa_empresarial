'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getFinalStageKey, getAdmissionStages } from './queries'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function slugify(label: string): string {
  const base = label
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return base || 'coluna'
}

// ── Colunas do Kanban (estilo Trello: adicionar, renomear, recolorir, reordenar, excluir) ──

export async function createStageAction(companyId: string, label: string, color: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  if (!label.trim()) return { error: 'Nome da coluna é obrigatório.' }

  const admin = createAdminClient()
  const stages = await getAdmissionStages(companyId)

  const base = slugify(label)
  let key = base
  let n = 2
  while (stages.some(s => s.key === key)) { key = `${base}_${n}`; n++ }

  const ordem = stages.length > 0 ? Math.max(...stages.map(s => s.ordem)) + 1 : 0

  const { error } = await admin.from('company_admission_stages').insert({
    company_id: companyId, key, label: label.trim(), color, ordem, is_final: false,
  })

  if (error) return { error: error.message }
  revalidatePath('/pessoas/admissao')
  return { success: true }
}

export async function updateStageAction(
  stageId: string,
  companyId: string,
  fields: { label?: string; color?: string; is_final?: boolean },
) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()

  // Só uma coluna pode ser "final" por empresa
  if (fields.is_final) {
    await admin.from('company_admission_stages')
      .update({ is_final: false })
      .eq('company_id', companyId)
      .neq('id', stageId)
  }

  const updates: Record<string, unknown> = {}
  if (fields.label !== undefined) updates.label = fields.label.trim()
  if (fields.color !== undefined) updates.color = fields.color
  if (fields.is_final !== undefined) updates.is_final = fields.is_final

  const { error } = await admin
    .from('company_admission_stages')
    .update(updates)
    .eq('id', stageId)
    .eq('company_id', companyId)

  if (error) return { error: error.message }
  revalidatePath('/pessoas/admissao')
  return { success: true }
}

export async function deleteStageAction(stageId: string, companyId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()

  const { data: stage } = await admin
    .from('company_admission_stages')
    .select('key, is_final')
    .eq('id', stageId)
    .eq('company_id', companyId)
    .single()

  if (!stage) return { error: 'Coluna não encontrada.' }
  if (stage.is_final) return { error: 'Esta é a coluna final do fluxo. Marque outra coluna como final antes de excluir esta.' }

  const { count } = await admin
    .from('employees')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('admission_stage', stage.key)

  if ((count ?? 0) > 0) return { error: 'Mova os candidatos desta coluna para outra antes de excluí-la.' }

  const { error } = await admin
    .from('company_admission_stages')
    .delete()
    .eq('id', stageId)
    .eq('company_id', companyId)

  if (error) return { error: error.message }
  revalidatePath('/pessoas/admissao')
  return { success: true }
}

export async function moveStageAction(companyId: string, stageId: string, direction: 'left' | 'right') {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const stages = await getAdmissionStages(companyId)

  const idx = stages.findIndex(s => s.id === stageId)
  const swapIdx = direction === 'left' ? idx - 1 : idx + 1
  if (idx < 0 || swapIdx < 0 || swapIdx >= stages.length) return { error: 'Não é possível mover.' }

  const a = stages[idx]
  const b = stages[swapIdx]

  await admin.from('company_admission_stages').update({ ordem: b.ordem }).eq('id', a.id)
  await admin.from('company_admission_stages').update({ ordem: a.ordem }).eq('id', b.id)

  revalidatePath('/pessoas/admissao')
  return { success: true }
}

export async function updateAdmissionStageAction(
  employeeId: string,
  stage: string,
) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('employees')
    .update({ admission_stage: stage })
    .eq('id', employeeId)

  if (error) return { error: error.message }
  revalidatePath('/pessoas/admissao')
  return { success: true }
}

export async function updateEmployeeStatusAction(
  employeeId: string,
  status: 'admissao' | 'experiencia' | 'ativo' | 'inativo' | 'demitido',
) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()

  const { data: employee } = await admin.from('employees').select('company_id').eq('id', employeeId).single()
  if (!employee) return { error: 'Funcionário não encontrado.' }

  const updates: Record<string, unknown> = { status }
  // ao avançar para fora do funil de admissão, garante que o Kanban seja considerado concluído
  // (senão o funcionário some tanto do Kanban quanto da Equipe — nenhum dos dois mostra status != admissao/experiencia sem isso)
  if (status !== 'admissao') updates.admission_stage = await getFinalStageKey(employee.company_id)

  const { error } = await admin
    .from('employees')
    .update(updates)
    .eq('id', employeeId)

  if (error) return { error: error.message }
  revalidatePath('/pessoas/admissao')
  revalidatePath('/pessoas/funcionarios')
  return { success: true }
}
