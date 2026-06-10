'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function createBenefitAction(companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const nome = (formData.get('nome') as string)?.trim()
  if (!nome) return { error: 'Nome é obrigatório.' }

  const admin = createAdminClient()
  const { error } = await admin.from('company_benefits').insert({
    company_id: companyId,
    nome,
    valor: parseFloat((formData.get('valor') as string)?.replace(',', '.') || '0') || 0,
    por_dia_trabalhado: formData.get('por_dia_trabalhado') === 'true',
    desconta_salario: formData.get('desconta_salario') === 'true',
    ativo: true,
  })

  if (error) return { error: error.message }
  revalidatePath('/pessoas/beneficios')
  return { success: true }
}

export async function updateBenefitAction(benefitId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('company_benefits').update({
    nome: (formData.get('nome') as string)?.trim(),
    valor: parseFloat((formData.get('valor') as string)?.replace(',', '.') || '0') || 0,
    por_dia_trabalhado: formData.get('por_dia_trabalhado') === 'true',
    desconta_salario: formData.get('desconta_salario') === 'true',
    ativo: formData.get('ativo') !== 'false',
  }).eq('id', benefitId)

  if (error) return { error: error.message }
  revalidatePath('/pessoas/beneficios')
  revalidatePath('/pessoas/funcionarios')
  return { success: true }
}

export async function deleteBenefitAction(benefitId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
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
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

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
