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
    status: (formData.get('status') as string) || 'ativo',
    data_admissao: (formData.get('data_admissao') as string) || null,
    data_experiencia_fim: (formData.get('data_experiencia_fim') as string) || null,
    data_demissao: (formData.get('data_demissao') as string) || null,
    tipo_contrato: (formData.get('tipo_contrato') as string) || null,
    vale_transporte: formData.get('vale_transporte') === 'true',
    vale_refeicao: formData.get('vale_refeicao') === 'true',
    plano_saude: formData.get('plano_saude') === 'true',
    grau_instrucao: (formData.get('grau_instrucao') as string) || null,
  }
}

export async function createEmployeeAction(companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseEmployeeFields(formData)
  if (!fields.nome) return { error: 'Nome é obrigatório.' }

  const admin = createAdminClient()
  const { error } = await admin.from('employees').insert({ company_id: companyId, ...fields })

  if (error) return { error: error.message }
  revalidatePath('/pessoas/funcionarios')
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
  revalidatePath('/pessoas/funcionarios')
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
