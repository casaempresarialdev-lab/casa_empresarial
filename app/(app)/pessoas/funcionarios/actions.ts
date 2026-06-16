'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function dec(fd: FormData, key: string): number | null {
  const v = (fd.get(key) as string)?.replace(',', '.').trim()
  if (!v) return null
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}

function parseEmployeeFields(formData: FormData) {
  const dataAdmissao = (formData.get('data_admissao') as string) || null

  // Auto-calcular datas de experiência a partir da admissão se não fornecidas manualmente
  const fimExp1Raw = (formData.get('fim_experiencia_1') as string) || null
  const fimExp2Raw = (formData.get('fim_experiencia_2') as string) || null

  let fim_experiencia_1 = fimExp1Raw || null
  let fim_experiencia_2 = fimExp2Raw || null

  if (dataAdmissao && !fim_experiencia_1) {
    fim_experiencia_1 = addDays(dataAdmissao, 44)
  }
  if (fim_experiencia_1 && !fim_experiencia_2) {
    fim_experiencia_2 = addDays(fim_experiencia_1, 44)
  }

  // Vencimento de férias: manual ou admissão + 364 dias
  const vctoFeriasRaw = (formData.get('vcto_ferias') as string) || null
  const vcto_ferias = vctoFeriasRaw || (dataAdmissao ? addDays(dataAdmissao, 364) : null)
  const conceder_ferias_ate = vcto_ferias ? addDays(vcto_ferias, 330) : null

  const valeAlim = dec(formData, 'vale_alimentacao_valor') ?? 0
  const valeTransp = dec(formData, 'vale_transporte_valor') ?? 0
  const salario = dec(formData, 'salario')

  return {
    nome: (formData.get('nome') as string)?.toUpperCase() || '',
    cpf: (formData.get('cpf') as string)?.replace(/\D/g, '') || null,
    rg: (formData.get('rg') as string) || null,
    nascimento: (formData.get('nascimento') as string) || null,
    telefone: (formData.get('telefone') as string) || null,
    email: (formData.get('email') as string) || null,
    cargo: (formData.get('cargo') as string) || null,
    departamento: (formData.get('departamento') as string) || null,
    local_trabalho: (formData.get('local_trabalho') as string) || null,
    salario,
    tem_periculosidade: formData.get('tem_periculosidade') === 'true',
    dias_trabalhados_vt: parseInt((formData.get('dias_trabalhados_vt') as string) || '22') || 22,
    vale_alimentacao_valor: valeAlim,
    vale_transporte_valor: valeTransp,
    status: (formData.get('status') as string) || 'admissao',
    data_admissao: dataAdmissao,
    fim_experiencia_1,
    fim_experiencia_2,
    data_demissao: (formData.get('data_demissao') as string) || null,
    vcto_ferias,
    conceder_ferias_ate,
    exame_periodico: (formData.get('exame_periodico') as string) || null,
    status_contrato: (formData.get('status_contrato') as string) || null,
    tipo_contrato: (formData.get('tipo_contrato') as string) || null,
    pis_pasep: (formData.get('pis_pasep') as string) || null,
    matricula: (formData.get('matricula') as string) || null,
    dados_bancarios: (formData.get('dados_bancarios') as string) || null,
    grau_instrucao: (formData.get('grau_instrucao') as string) || null,
    plano_saude: formData.get('plano_saude') === 'true',
    pin: (formData.get('pin') as string) || null,
    pin_ativo: formData.get('pin_ativo') === 'true',
  }
}

async function syncEmployeeBenefits(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  employeeId: string,
  formData: FormData
) {
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
  revalidatePath('/pessoas/folha-de-pagamento')
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
