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
  const base       = num(fd, 'salario_base')
  const pericul    = num(fd, 'periculosidade_valor')
  const extras     = num(fd, 'horas_extras')
  const extrasFer  = num(fd, 'horas_extras_feriado')
  const noturno    = num(fd, 'adicional_noturno')
  const bonus      = num(fd, 'bonus')
  const faltas     = num(fd, 'desconto_faltas')
  const inss       = num(fd, 'desconto_inss')
  const irrf       = num(fd, 'desconto_irrf')
  const vt         = num(fd, 'desconto_vt')
  const adiant     = num(fd, 'desconto_adiantamento')
  const outros     = num(fd, 'desconto_outros')
  return Math.max(0,
    base + pericul + extras + extrasFer + noturno + bonus
    - faltas - inss - irrf - vt - adiant - outros
  )
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
    salario_base:          num(formData, 'salario_base'),
    periculosidade_valor:  num(formData, 'periculosidade_valor'),
    horas_extras:          num(formData, 'horas_extras'),
    horas_extras_feriado:  num(formData, 'horas_extras_feriado'),
    adicional_noturno:     num(formData, 'adicional_noturno'),
    bonus:                 num(formData, 'bonus'),
    desconto_faltas:       num(formData, 'desconto_faltas'),
    desconto_inss:         num(formData, 'desconto_inss'),
    desconto_irrf:         num(formData, 'desconto_irrf'),
    desconto_vt:           num(formData, 'desconto_vt'),
    desconto_adiantamento: num(formData, 'desconto_adiantamento'),
    desconto_outros:       num(formData, 'desconto_outros'),
    salario_liquido:       liquido,
    dias_trabalhados:      formData.get('dias_trabalhados') ? parseInt(formData.get('dias_trabalhados') as string) : null,
    status,
    observacao:            (formData.get('observacao') as string) || null,
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

  const { data: existing } = await admin
    .from('payroll_entries')
    .select('company_id, employee_id, mes_ano')
    .eq('id', entryId)
    .single()

  const { error } = await admin.from('payroll_entries').update({
    salario_base:          num(formData, 'salario_base'),
    periculosidade_valor:  num(formData, 'periculosidade_valor'),
    horas_extras:          num(formData, 'horas_extras'),
    horas_extras_feriado:  num(formData, 'horas_extras_feriado'),
    adicional_noturno:     num(formData, 'adicional_noturno'),
    bonus:                 num(formData, 'bonus'),
    desconto_faltas:       num(formData, 'desconto_faltas'),
    desconto_inss:         num(formData, 'desconto_inss'),
    desconto_irrf:         num(formData, 'desconto_irrf'),
    desconto_vt:           num(formData, 'desconto_vt'),
    desconto_adiantamento: num(formData, 'desconto_adiantamento'),
    desconto_outros:       num(formData, 'desconto_outros'),
    salario_liquido:       liquido,
    dias_trabalhados:      formData.get('dias_trabalhados') ? parseInt(formData.get('dias_trabalhados') as string) : null,
    status,
    observacao:            (formData.get('observacao') as string) || null,
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

export async function generatePayrollForMonthAction(companyId: string, mesAno: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()

  type EmpBenefit = {
    valor_override: number | null
    benefit: { valor: number; por_dia_trabalhado: boolean; desconta_salario: boolean }
  }

  const [{ data: employees }, { data: existing }] = await Promise.all([
    admin
      .from('employees')
      .select(`
        id, salario, tem_periculosidade,
        employee_benefits(
          valor_override,
          benefit:benefit_id(valor, por_dia_trabalhado, desconta_salario)
        )
      `)
      .eq('company_id', companyId)
      .in('status', ['ativo', 'experiencia']),
    admin
      .from('payroll_entries')
      .select('employee_id')
      .eq('company_id', companyId)
      .eq('mes_ano', mesAno),
  ])

  const existingIds = new Set((existing ?? []).map((e: { employee_id: string }) => e.employee_id))
  const toCreate = (employees ?? []).filter(
    (e: { id: string; salario: number | null }) => !existingIds.has(e.id) && (e.salario ?? 0) > 0
  )

  if (toCreate.length === 0) {
    return { success: true, created: 0, skipped: existingIds.size }
  }

  const DIAS_UTEIS = 22
  const INSS_FAIXAS = [
    { limite: 1412.00, aliq: 0.075 },
    { limite: 2666.68, aliq: 0.09 },
    { limite: 4000.03, aliq: 0.12 },
    { limite: 7786.02, aliq: 0.14 },
  ]

  function calcInss(salario: number): number {
    let inss = 0
    let limiteAnterior = 0
    const base = Math.min(salario, 7786.02)
    for (const { limite, aliq } of INSS_FAIXAS) {
      if (base <= limiteAnterior) break
      inss += (Math.min(base, limite) - limiteAnterior) * aliq
      limiteAnterior = limite
    }
    return Math.round(inss * 100) / 100
  }

  type EmpRow = { id: string; salario: number; tem_periculosidade: boolean; employee_benefits: EmpBenefit[] }
  const entries = (toCreate as unknown as EmpRow[]).map(emp => {
    const sal = emp.salario ?? 0
    const pericul = emp.tem_periculosidade ? Math.round(sal * 0.30 * 100) / 100 : 0
    const bruto = sal + pericul
    const descontoOutros = Math.round(
      (emp.employee_benefits ?? [])
        .filter(eb => eb.benefit.desconta_salario)
        .reduce((s, eb) => {
          const v = eb.valor_override ?? eb.benefit.valor
          return s + (eb.benefit.por_dia_trabalhado ? v * DIAS_UTEIS : v)
        }, 0) * 100
    ) / 100
    const inss = calcInss(bruto)
    const liquido = Math.max(0, bruto - inss - descontoOutros)
    return {
      company_id: companyId,
      employee_id: emp.id,
      mes_ano: mesAno,
      salario_base: sal,
      periculosidade_valor: pericul,
      horas_extras: 0,
      horas_extras_feriado: 0,
      adicional_noturno: 0,
      bonus: 0,
      desconto_faltas: 0,
      desconto_inss: inss,
      desconto_irrf: 0,
      desconto_vt: 0,
      desconto_adiantamento: 0,
      desconto_outros: descontoOutros,
      salario_liquido: Math.round(liquido * 100) / 100,
      dias_trabalhados: null,
      status: 'rascunho',
      observacao: null,
    }
  })

  const { error } = await admin.from('payroll_entries').insert(entries)
  if (error) return { error: error.message }

  revalidatePath('/pessoas/folha-de-pagamento')
  return { success: true, created: toCreate.length, skipped: existingIds.size }
}

export async function deletePayrollEntryAction(entryId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()

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
