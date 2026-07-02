'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const BUCKET = 'documentos'
const MAX_DOC_SIZE = 20 * 1024 * 1024

const DOC_KEYS = [
  'foto', 'rg_cnh_frente', 'rg_verso', 'exame_admissional', 'cpf',
  'comprovante_residencia', 'titulo_eleitor', 'ctps', 'pis', 'certidao',
] as const

type DocKey = typeof DOC_KEYS[number]

function keyToCol(key: DocKey): string {
  return key === 'foto' ? 'foto_path' : `doc_${key}_path`
}

async function uploadEmployeeDocs(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  employeeId: string,
  formData: FormData,
  existing: Partial<Record<DocKey, string | null>>,
): Promise<{ updates: Record<string, string | null>; error?: string }> {
  const updates: Record<string, string | null> = {}
  const toRemove: string[] = []

  for (const key of DOC_KEYS) {
    const file = formData.get(`doc_${key}`) as File | null
    const remove = formData.get(`remove_${key}`) === 'true'
    const col = keyToCol(key)
    const existingPath = existing[key] ?? null

    if (file && file.size > 0) {
      if (file.size > MAX_DOC_SIZE) return { updates, error: `"${file.name}" excede 20 MB.` }
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
      const path = `funcionarios/${companyId}/${employeeId}/${key}_${Date.now()}.${ext}`
      const bytes = await file.arrayBuffer()
      const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })
      if (error) return { updates, error: `Erro no upload de "${file.name}": ${error.message}` }
      if (existingPath) toRemove.push(existingPath)
      updates[col] = path
    } else if (remove && existingPath) {
      toRemove.push(existingPath)
      updates[col] = null
    }
  }

  if (toRemove.length > 0) await admin.storage.from(BUCKET).remove(toRemove)
  return { updates }
}

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

  const vctoFeriasRaw = (formData.get('vcto_ferias') as string) || null
  const vcto_ferias = vctoFeriasRaw || (dataAdmissao ? addDays(dataAdmissao, 364) : null)
  const conceder_ferias_ate = vcto_ferias ? addDays(vcto_ferias, 330) : null

  const depRaw = parseInt((formData.get('dependentes') as string) || '0')

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
    salario: dec(formData, 'salario'),
    plano_saude: formData.get('plano_saude') === 'true',
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
    serie_ctps: (formData.get('serie_ctps') as string) || null,
    certificado_reservista: (formData.get('certificado_reservista') as string) || null,
    dependentes: isNaN(depRaw) ? 0 : depRaw,
    dados_bancarios: (formData.get('dados_bancarios') as string) || null,
    grau_instrucao: (formData.get('grau_instrucao') as string) || null,
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

  const { updates, error: docErr } = await uploadEmployeeDocs(admin, companyId, data.id, formData, {})
  if (docErr) return { error: docErr }
  if (Object.keys(updates).length > 0) {
    await admin.from('employees').update(updates).eq('id', data.id)
  }

  revalidatePath('/pessoas/funcionarios')
  revalidatePath('/pessoas/beneficios')
  return { success: true as const, employeeId: data.id }
}

export async function updateEmployeeAction(employeeId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseEmployeeFields(formData)
  if (!fields.nome) return { error: 'Nome é obrigatório.' }

  const admin = createAdminClient()
  const { data: current } = await admin
    .from('employees')
    .select('company_id, foto_path, doc_rg_cnh_frente_path, doc_rg_verso_path, doc_exame_admissional_path, doc_cpf_path, doc_comprovante_residencia_path, doc_titulo_eleitor_path, doc_ctps_path, doc_pis_path, doc_certidao_path')
    .eq('id', employeeId)
    .single()

  if (!current) return { error: 'Funcionário não encontrado.' }

  const existingDocs: Partial<Record<DocKey, string | null>> = {
    foto: current.foto_path,
    rg_cnh_frente: current.doc_rg_cnh_frente_path,
    rg_verso: current.doc_rg_verso_path,
    exame_admissional: current.doc_exame_admissional_path,
    cpf: current.doc_cpf_path,
    comprovante_residencia: current.doc_comprovante_residencia_path,
    titulo_eleitor: current.doc_titulo_eleitor_path,
    ctps: current.doc_ctps_path,
    pis: current.doc_pis_path,
    certidao: current.doc_certidao_path,
  }

  const { updates: docUpdates, error: docErr } = await uploadEmployeeDocs(admin, current.company_id, employeeId, formData, existingDocs)
  if (docErr) return { error: docErr }

  const { error } = await admin.from('employees').update({ ...fields, ...docUpdates }).eq('id', employeeId)
  if (error) return { error: error.message }

  await syncEmployeeBenefits(admin, current.company_id, employeeId, formData)

  revalidatePath('/pessoas/funcionarios')
  revalidatePath('/pessoas/beneficios')
  revalidatePath('/pessoas/folha-de-pagamento')
  return { success: true }
}

export async function generateOnboardingTokenAction(
  employeeId: string,
): Promise<{ url?: string; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { data: emp } = await admin.from('employees').select('company_id').eq('id', employeeId).single()
  if (!emp) return { error: 'Funcionário não encontrado.' }

  const { data: tokenData, error } = await admin
    .from('employee_onboarding_tokens')
    .insert({ employee_id: employeeId, company_id: emp.company_id })
    .select('token')
    .single()

  if (error) return { error: error.message }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return { url: `${baseUrl}/auto-cadastro/${tokenData.token}` }
}

export async function getEmployeeDocUrlAction(storagePath: string): Promise<{ url?: string; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(storagePath, 3600)
  if (error) return { error: error.message }
  return { url: data.signedUrl }
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
