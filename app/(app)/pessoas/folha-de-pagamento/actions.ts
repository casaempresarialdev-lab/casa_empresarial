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

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function mesAnoLabel(mesAno: string) {
  const [ano, mes] = mesAno.split('-')
  return `${MESES[parseInt(mes) - 1]}/${ano}`
}

async function syncPayrollTransactions(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  entryId: string,
  employeeId: string,
  mesAno: string,
  salarioLiquido: number,
  status: string,
) {
  const refPrefix = `payroll_entry:${entryId}`

  // Remove existing transactions from this entry before re-creating
  await admin.from('transactions')
    .delete()
    .eq('company_id', companyId)
    .like('detalhes', `${refPrefix}%`)

  if (status !== 'fechado' && status !== 'pago') return

  const { data: emp } = await admin
    .from('employees')
    .select('nome')
    .eq('id', employeeId)
    .single()

  const nomeEmp = emp?.nome ?? 'Funcionário'
  const mesLabel = mesAnoLabel(mesAno)
  const dataComp = `${mesAno.split('-')[0]}-${mesAno.split('-')[1]}-01`

  // Salary transaction
  await admin.from('transactions').insert({
    company_id: companyId,
    descricao: `Salário — ${nomeEmp} — ${mesLabel}`,
    tipo: 'pagamento',
    valor: salarioLiquido,
    data_competencia: dataComp,
    status: 'pendente',
    recorrente: false,
    detalhes: `${refPrefix}:salary`,
  })

  // Employer-paid benefits transaction (if any)
  type EmpBenefit = {
    valor_override: number | null
    benefit: { valor: number; por_dia_trabalhado: boolean; desconta_salario: boolean }
  }
  const { data: benefits } = await admin
    .from('employee_benefits')
    .select('valor_override, benefit:benefit_id(valor, por_dia_trabalhado, desconta_salario)')
    .eq('employee_id', employeeId)

  const DIAS_UTEIS = 22
  const totalBenefPatronal = ((benefits ?? []) as unknown as EmpBenefit[])
    .filter(eb => !eb.benefit.desconta_salario)
    .reduce((s, eb) => {
      const v = eb.valor_override ?? eb.benefit.valor
      return s + (eb.benefit.por_dia_trabalhado ? v * DIAS_UTEIS : v)
    }, 0)

  if (totalBenefPatronal > 0) {
    await admin.from('transactions').insert({
      company_id: companyId,
      descricao: `Benefícios (patronal) — ${nomeEmp} — ${mesLabel}`,
      tipo: 'pagamento',
      valor: totalBenefPatronal,
      data_competencia: dataComp,
      status: 'pendente',
      recorrente: false,
      detalhes: `${refPrefix}:benefits`,
    })
  }

  revalidatePath('/financeiro/fluxo-de-caixa')
  revalidatePath('/financeiro/fluxo-de-caixa/pagamentos')
}

export async function createPayrollEntryAction(companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const employeeId = formData.get('employee_id') as string
  if (!employeeId) return { error: 'Funcionário é obrigatório.' }

  const mesAno = formData.get('mes_ano') as string
  if (!mesAno) return { error: 'Mês/ano é obrigatório.' }

  const status = (formData.get('status') as string) || 'rascunho'
  const liquido = calcLiquido(formData)

  const admin = createAdminClient()
  const { data: entry, error } = await admin.from('payroll_entries').insert({
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
    salario_liquido:    liquido,
    status,
    observacao:         (formData.get('observacao') as string) || null,
  }).select('id').single()

  if (error) return { error: error.message }

  await syncPayrollTransactions(admin, companyId, entry.id, employeeId, mesAno, liquido, status)

  revalidatePath('/pessoas/folha-de-pagamento')
  return { success: true }
}

export async function updatePayrollEntryAction(entryId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const status = (formData.get('status') as string) || 'rascunho'
  const liquido = calcLiquido(formData)

  const admin = createAdminClient()

  // Fetch existing entry to get companyId + employeeId + mesAno
  const { data: existing } = await admin
    .from('payroll_entries')
    .select('company_id, employee_id, mes_ano')
    .eq('id', entryId)
    .single()

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
    salario_liquido:    liquido,
    status,
    observacao:         (formData.get('observacao') as string) || null,
  }).eq('id', entryId)

  if (error) return { error: error.message }

  if (existing) {
    await syncPayrollTransactions(
      admin,
      existing.company_id,
      entryId,
      existing.employee_id,
      existing.mes_ano,
      liquido,
      status,
    )
  }

  revalidatePath('/pessoas/folha-de-pagamento')
  return { success: true }
}

export async function deletePayrollEntryAction(entryId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()

  // Remove associated transactions
  const { data: existing } = await admin
    .from('payroll_entries')
    .select('company_id')
    .eq('id', entryId)
    .single()

  if (existing) {
    await admin.from('transactions')
      .delete()
      .eq('company_id', existing.company_id)
      .like('detalhes', `payroll_entry:${entryId}%`)
  }

  const { error } = await admin.from('payroll_entries').delete().eq('id', entryId)
  if (error) return { error: error.message }

  revalidatePath('/pessoas/folha-de-pagamento')
  revalidatePath('/financeiro/fluxo-de-caixa')
  revalidatePath('/financeiro/fluxo-de-caixa/pagamentos')
  return { success: true }
}
