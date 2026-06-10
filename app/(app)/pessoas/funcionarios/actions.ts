'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function parseEmployeeFields(formData: FormData) {
  const salarioRaw = formData.get('salario') as string
  const salario = salarioRaw ? parseFloat(salarioRaw.replace(',', '.')) : null

  return {
    nome: formData.get('nome') as string,
    cpf: (formData.get('cpf') as string)?.replace(/\D/g, '') || null,
    rg: (formData.get('rg') as string) || null,
    telefone: (formData.get('telefone') as string) || null,
    email: (formData.get('email') as string) || null,
    cargo: (formData.get('cargo') as string) || null,
    departamento: (formData.get('departamento') as string) || null,
    salario,
    status: (formData.get('status') as string) || 'admissao',
    data_admissao: (formData.get('data_admissao') as string) || null,
    data_experiencia_fim: (formData.get('data_experiencia_fim') as string) || null,
    data_demissao: (formData.get('data_demissao') as string) || null,
    tipo_contrato: (formData.get('tipo_contrato') as string) || null,
    vale_transporte: formData.get('vale_transporte') === 'true',
    vale_refeicao: formData.get('vale_refeicao') === 'true',
    plano_saude: formData.get('plano_saude') === 'true',
    grau_instrucao: (formData.get('grau_instrucao') as string) || null,
    pin: (formData.get('pin') as string) || null,
    pin_ativo: formData.get('pin_ativo') === 'true',
  }
}

async function syncEmployeeBenefits(admin: ReturnType<typeof createAdminClient>, companyId: string, employeeId: string, formData: FormData) {
  const raw = formData.get('benefit_ids') as string
  const benefitIds: string[] = raw ? JSON.parse(raw) : []

  await admin.from('employee_benefits').delete().eq('employee_id', employeeId)

  if (benefitIds.length > 0) {
    await admin.from('employee_benefits').insert(
      benefitIds.map(bid => ({ company_id: companyId, employee_id: employeeId, benefit_id: bid }))
    )
  }
}

export async function createEmployeeAction(companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseEmployeeFields(formData)
  if (!fields.nome) return { error: 'Nome é obrigatório.' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employees')
    .insert({ company_id: companyId, ...fields })
    .select('id')
    .single()

  if (error) return { error: error.message }
  await syncEmployeeBenefits(admin, companyId, data.id, formData)

  revalidatePath('/pessoas/funcionarios')
  revalidatePath('/pessoas/beneficios')
  return { success: true }
}

export async function updateEmployeeAction(employeeId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseEmployeeFields(formData)
  if (!fields.nome) return { error: 'Nome é obrigatório.' }

  const admin = createAdminClient()
  const { error } = await admin.from('employees').update(fields).eq('id', employeeId)
  if (error) return { error: error.message }

  const { data: emp } = await admin.from('employees').select('company_id').eq('id', employeeId).single()
  if (emp) await syncEmployeeBenefits(admin, emp.company_id, employeeId, formData)

  revalidatePath('/pessoas/funcionarios')
  revalidatePath('/pessoas/beneficios')
  return { success: true }
}

export async function deleteEmployeeAction(employeeId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('employees').delete().eq('id', employeeId)

  if (error) return { error: error.message }
  revalidatePath('/pessoas/funcionarios')
  return { success: true }
}
