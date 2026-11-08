'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/auth/viewer'
import { semAcesso } from '@/lib/auth/acesso'
import { isRegraDesconto } from '@/lib/beneficios-calculo'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

async function assertCanManage(companyId: string) {
  const viewer = await getViewerContext(companyId)
  return viewer?.isColaborador ? { error: 'Sem permissão para esta ação.' } : null
}

/** Regra de desconto do formulário */
function lerDesconto(formData: FormData) {
  const tipo = formData.get('desconto_tipo')
  if (!isRegraDesconto(tipo)) return { error: 'Escolha a regra de desconto.' }
  const valor = tipo === 'nenhum' ? 0 : parseFloat(String(formData.get('desconto_valor') ?? ''))
  if (tipo !== 'nenhum' && !(valor > 0)) return { error: 'Informe o valor do desconto.' }
  if ((tipo === 'percentual_salario' || tipo === 'percentual_beneficio') && valor > 100) return { error: 'O percentual pode ser de até 100%.' }
  return { campos: { desconto_tipo: tipo, desconto_valor: valor, desconta_salario: tipo !== 'nenhum' } }
}

export async function createBenefitAction(companyId: string, formData: FormData) {
  const negado = await semAcesso('pessoas.beneficios', companyId)
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  const guard = await assertCanManage(companyId)
  if (guard) return guard

  const nome = (formData.get('nome') as string)?.trim()
  if (!nome) return { error: 'Nome é obrigatório.' }
  const desconto = lerDesconto(formData)
  if ('error' in desconto) return { error: desconto.error }

  const admin = createAdminClient()
  const { error } = await admin.from('company_benefits').insert({
    company_id: companyId,
    nome,
    valor: parseFloat((formData.get('valor') as string)?.replace(',', '.') || '0') || 0,
    por_dia_trabalhado: formData.get('por_dia_trabalhado') === 'true',
    ...desconto.campos,
    ativo: true,
  })

  if (error) return { error: error.message }
  revalidatePath('/pessoas/beneficios')
  return { success: true }
}

export async function updateBenefitAction(benefitId: string, formData: FormData) {
  const negado = await semAcesso('pessoas.beneficios')
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()

  const { data: current } = await admin.from('company_benefits').select('company_id').eq('id', benefitId).single()
  if (!current) return { error: 'Benefício não encontrado.' }
  const guard = await assertCanManage(current.company_id)
  if (guard) return guard
  const desconto = lerDesconto(formData)
  if ('error' in desconto) return { error: desconto.error }

  const { error } = await admin.from('company_benefits').update({
    nome: (formData.get('nome') as string)?.trim(),
    valor: parseFloat((formData.get('valor') as string)?.replace(',', '.') || '0') || 0,
    por_dia_trabalhado: formData.get('por_dia_trabalhado') === 'true',
    ...desconto.campos,
    ativo: formData.get('ativo') !== 'false',
  }).eq('id', benefitId)

  if (error) return { error: error.message }
  revalidatePath('/pessoas/beneficios')
  revalidatePath('/pessoas/funcionarios')
  return { success: true }
}

export async function deleteBenefitAction(benefitId: string) {
  const negado = await semAcesso('pessoas.beneficios')
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()

  const { data: current } = await admin.from('company_benefits').select('company_id').eq('id', benefitId).single()
  if (!current) return { error: 'Benefício não encontrado.' }
  const guard = await assertCanManage(current.company_id)
  if (guard) return guard

  const { error } = await admin.from('company_benefits').delete().eq('id', benefitId)

  if (error) return { error: error.message }
  revalidatePath('/pessoas/beneficios')
  return { success: true }
}

export async function toggleEmployeeBenefitAction(
  companyId: string,
  employeeId: string,
  benefitId: string,
  active: boolean,
) {
  const negado = await semAcesso('pessoas.beneficios', companyId)
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  const guard = await assertCanManage(companyId)
  if (guard) return guard

  const admin = createAdminClient()

  if (active) {
    const { error } = await admin.from('employee_benefits').upsert(
      { company_id: companyId, employee_id: employeeId, benefit_id: benefitId },
      { onConflict: 'employee_id,benefit_id' },
    )
    if (error) return { error: error.message }
  } else {
    const { error } = await admin.from('employee_benefits')
      .delete()
      .eq('employee_id', employeeId)
      .eq('benefit_id', benefitId)
    if (error) return { error: error.message }
  }

  revalidatePath('/pessoas/beneficios')
  revalidatePath('/pessoas/funcionarios')
  return { success: true }
}
