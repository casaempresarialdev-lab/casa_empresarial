'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function num(fd: FormData, key: string): number {
  return parseFloat((fd.get(key) as string)?.replace(',', '.') || '0') || 0
}

function calcLiquido(fd: FormData): number {
  const base = num(fd, 'salario_base')
  const extras = num(fd, 'horas_extras')
  const noturno = num(fd, 'adicional_noturno')
  const bonus = num(fd, 'bonus')
  const faltas = num(fd, 'desconto_faltas')
  const inss = num(fd, 'desconto_inss')
  const irrf = num(fd, 'desconto_irrf')
  const vt = num(fd, 'desconto_vt')
  const outros = num(fd, 'desconto_outros')
  return Math.max(0, base + extras + noturno + bonus - faltas - inss - irrf - vt - outros)
}

export async function createPayrollEntryAction(companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const employeeId = formData.get('employee_id') as string
  if (!employeeId) return { error: 'Funcionário é obrigatório.' }

  const mesAno = formData.get('mes_ano') as string
  if (!mesAno) return { error: 'Mês/ano é obrigatório.' }

  const admin = createAdminClient()
  const { error } = await admin.from('payroll_entries').insert({
    company_id: companyId,
    employee_id: employeeId,
    mes_ano: mesAno,
    salario_base:       num(formData, 'salario_base'),
    horas_extras:       num(formData, 'horas_extras'),
    adicional_noturno:  num(formData, 'adicional_noturno'),
    bonus:              num(formData, 'bonus'),
    desconto_faltas:    num(formData, 'desconto_faltas'),
    desconto_inss:      num(formData, 'desconto_inss'),
    desconto_irrf:      num(formData, 'desconto_irrf'),
    desconto_vt:        num(formData, 'desconto_vt'),
    desconto_outros:    num(formData, 'desconto_outros'),
    salario_liquido:    calcLiquido(formData),
    status:             (formData.get('status') as string) || 'rascunho',
    observacao:         (formData.get('observacao') as string) || null,
  })

  if (error) return { error: error.message }
  revalidatePath('/pessoas/folha-de-pagamento')
  return { success: true }
}

export async function updatePayrollEntryAction(entryId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('payroll_entries').update({
    salario_base:       num(formData, 'salario_base'),
    horas_extras:       num(formData, 'horas_extras'),
    adicional_noturno:  num(formData, 'adicional_noturno'),
    bonus:              num(formData, 'bonus'),
    desconto_faltas:    num(formData, 'desconto_faltas'),
    desconto_inss:      num(formData, 'desconto_inss'),
    desconto_irrf:      num(formData, 'desconto_irrf'),
    desconto_vt:        num(formData, 'desconto_vt'),
    desconto_outros:    num(formData, 'desconto_outros'),
    salario_liquido:    calcLiquido(formData),
    status:             (formData.get('status') as string) || 'rascunho',
    observacao:         (formData.get('observacao') as string) || null,
  }).eq('id', entryId)

  if (error) return { error: error.message }
  revalidatePath('/pessoas/folha-de-pagamento')
  return { success: true }
}

export async function deletePayrollEntryAction(entryId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('payroll_entries').delete().eq('id', entryId)

  if (error) return { error: error.message }
  revalidatePath('/pessoas/folha-de-pagamento')
  return { success: true }
}
