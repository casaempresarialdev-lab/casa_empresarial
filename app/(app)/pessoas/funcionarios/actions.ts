'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/auth/viewer'
import { ETAPA_FINAL, primeiraEtapa } from '../admissao/etapas'
import { getEtapasAdmissao } from '../admissao/queries'
import { findUserIdByEmail, adicionarContaExistente, enviarConvite } from '@/lib/invitations'
import { semAcesso } from '@/lib/auth/acesso'
import { buscarCargo } from '@/lib/estrutura'
import { criarAcessoFuncionario } from '@/lib/admissao-acesso'

async function getAppUrl() {
  const hdrs = await headers()
  const host = hdrs.get('host') ?? 'localhost:3000'
  const proto = hdrs.get('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}`
}

const BUCKET = 'documentos'
const MAX_DOC_SIZE = 20 * 1024 * 1024

const DOC_KEYS = [
  'foto', 'rg_cnh_frente', 'rg_verso', 'exame_admissional', 'cpf',
  'comprovante_residencia', 'titulo_eleitor', 'ctps', 'pis', 'certidao', 'contrato',
  // Rescisão (migration 20261107000086)
  'exame_demissional', 'trct',
] as const

export type DocKey = typeof DOC_KEYS[number]

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

  const status = (formData.get('status') as string) || 'admissao'

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
    status,
    // Fora do fluxo de admissão: fica na etapa final, para aparecer na Equipe
    ...(status !== 'admissao' && { admission_stage: ETAPA_FINAL }),
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
    cnpj: (formData.get('cnpj') as string)?.replace(/\D/g, '') || null,
    servico: (formData.get('servico') as string) || null,
    valor_servico: dec(formData, 'valor_servico'),
  }
}

/** Cargo escolhido na ficha: cargo e departamento vêm do cadastro da Estrutura. Devolve o erro, se houver. */
async function aplicarCargo(admin: ReturnType<typeof createAdminClient>, companyId: string, fields: Record<string, unknown>, formData: FormData) {
  const positionId = (formData.get('position_id') as string) || ''
  if (!positionId) return null
  const cargo = await buscarCargo(admin, companyId, positionId)
  if (!cargo) return 'Escolha um dos cargos cadastrados.'
  fields.position_id = cargo.id
  fields.cargo = cargo.nome
  fields.departamento = cargo.departamento
  return null
}

/** Liga a admissão à vaga pela candidatura: quem já se candidatou com este CPF usa a dele. Devolve o erro, se houver. */
async function vincularCandidatura(
  admin: ReturnType<typeof createAdminClient>,
  opcoes: { companyId: string; vagaId: string; employeeId: string; nome: string; cpf: string | null; email: string | null; telefone: string | null },
) {
  const { companyId, vagaId, employeeId, nome, cpf, email, telefone } = opcoes
  if (cpf) {
    const { data: existente } = await admin.from('job_applications').select('id, employee_id').eq('vaga_id', vagaId).eq('cpf', cpf).maybeSingle()
    if (existente?.employee_id) return 'Este CPF já está em admissão por esta vaga.'
    if (existente) {
      const { error } = await admin.from('job_applications').update({ status: 'selecionada', employee_id: employeeId }).eq('id', existente.id)
      return error?.message ?? null
    }
  }
  const { error } = await admin.from('job_applications').insert({
    company_id: companyId, vaga_id: vagaId, nome, cpf, email: email ?? '', telefone: telefone ?? '', status: 'selecionada', employee_id: employeeId,
  })
  return error?.message ?? null
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
  const negado = await semAcesso(['pessoas.funcionarios', 'pessoas.admissao', 'pessoas.rescisao'], companyId)
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  const viewerC = await getViewerContext(companyId)
  if (viewerC?.isColaborador) return { error: 'Sem permissão para esta ação.' }

  const fields = parseEmployeeFields(formData)
  if (!fields.nome) return { error: 'Nome é obrigatório.' }

  const admin = createAdminClient()
  const erroCargo = await aplicarCargo(admin, companyId, fields, formData)
  if (erroCargo) return { error: erroCargo }

  const vagaId = (formData.get('vaga_id') as string) || ''
  if (vagaId) {
    const { data: vaga } = await admin.from('job_openings').select('*, job_opening_benefits(benefit_id)').eq('id', vagaId).eq('company_id', companyId).maybeSingle()
    if (!vaga || vaga.status === 'encerrada') return { error: 'Esta vaga não está mais disponível.' }

    // O que a vaga definiu vale sobre o que veio do formulário
    const campos = fields as Record<string, unknown>
    const pj = vaga.tipo_contrato === 'pj' || vaga.tipo_contrato === 'autonomo'
    campos.tipo_contrato = vaga.tipo_contrato
    if (vaga.position_id) campos.position_id = vaga.position_id
    if (vaga.cargo) campos.cargo = vaga.cargo
    if (vaga.departamento) campos.departamento = vaga.departamento
    if (vaga.local_trabalho) campos.local_trabalho = vaga.local_trabalho
    if (vaga.salario != null) campos[pj ? 'valor_servico' : 'salario'] = vaga.salario
    const beneficios = (vaga.job_opening_benefits as { benefit_id: string }[]).map((b) => b.benefit_id)
    if (!pj && beneficios.length) formData.set('benefit_ids', JSON.stringify(beneficios))
  }

  const { data, error } = await admin
    .from('employees')
    // Entra no kanban na primeira etapa ativa; sem vaga, pula a entrevista
    .insert({ company_id: companyId, ...(fields.status === 'admissao' && { admission_stage: primeiraEtapa(await getEtapasAdmissao(companyId), !!vagaId) }), ...fields })
    .select('id')
    .single()

  if (error) return { error: error.message }

  if (vagaId) {
    const erroVaga = await vincularCandidatura(admin, {
      companyId, vagaId, employeeId: data.id, nome: fields.nome, cpf: fields.cpf, email: fields.email, telefone: fields.telefone,
    })
    if (erroVaga) {
      await admin.from('employees').delete().eq('id', data.id)
      return { error: erroVaga }
    }
    revalidatePath('/pessoas/vagas', 'layout')
    revalidatePath('/pessoas/admissao')
  }

  await syncEmployeeBenefits(admin, companyId, data.id, formData)

  const { updates, error: docErr } = await uploadEmployeeDocs(admin, companyId, data.id, formData, {})
  if (docErr) return { error: docErr }
  if (Object.keys(updates).length > 0) {
    await admin.from('employees').update(updates).eq('id', data.id)
  }

  // O colaborador admitido recebe na hora o e-mail para criar o usuário
  const acesso = await criarAcessoFuncionario(admin, { companyId, employeeId: data.id, email: fields.email, jaTemConta: false, autorId: user.id })

  revalidatePath('/pessoas/funcionarios')
  revalidatePath('/pessoas/beneficios')
  revalidatePath('/admin/usuarios')
  return { success: true as const, employeeId: data.id, acesso }
}

export async function updateEmployeeAction(employeeId: string, formData: FormData) {
  const negado = await semAcesso(['pessoas.funcionarios', 'pessoas.admissao', 'pessoas.rescisao'])
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { data: current } = await admin
    .from('employees')
    // '*': doc_contrato_path pode ainda não existir (migration 20261106000084)
    .select('*')
    .eq('id', employeeId)
    .single()

  if (!current) return { error: 'Funcionário não encontrado.' }
  const viewerU = await getViewerContext(current.company_id)
  if (viewerU?.isColaborador) return { error: 'Sem permissão para esta ação. Use "Meus Dados" para editar suas informações de contato.' }

  const fields = parseEmployeeFields(formData)
  if (!fields.nome) return { error: 'Nome é obrigatório.' }

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
    contrato: current.doc_contrato_path ?? null,
    exame_demissional: current.doc_exame_demissional_path ?? null,
    trct: current.doc_trct_path ?? null,
  }

  const { updates: docUpdates, error: docErr } = await uploadEmployeeDocs(admin, current.company_id, employeeId, formData, existingDocs)
  if (docErr) return { error: docErr }

  const erroCargo = await aplicarCargo(admin, current.company_id, fields, formData)
  if (erroCargo) return { error: erroCargo }
  // Cargo retirado na ficha
  const semCargo = 'position_id' in current && !(fields as Record<string, unknown>).position_id ? { position_id: null } : {}

  const { error } = await admin.from('employees').update({ ...fields, ...semCargo, ...docUpdates }).eq('id', employeeId)
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
  const negado = await semAcesso(['pessoas.funcionarios', 'pessoas.admissao', 'pessoas.rescisao'])
  if (negado) return negado

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

// Arquivos só de leitura: gerados pelo sistema, sem envio ou remoção pelo formulário
const DOC_KEYS_LEITURA = ['carta_proposta'] as const

/**
 * Link temporário (1h) de um arquivo do funcionário (foto ou documento).
 * O caminho vem do banco (nunca do cliente). Colaborador só abre os próprios arquivos.
 * downloadName: o link força o download com esse nome.
 */
export async function getEmployeeDocUrlAction(
  employeeId: string,
  key: DocKey | (typeof DOC_KEYS_LEITURA)[number],
  downloadName?: string,
): Promise<{ url?: string; error?: string }> {
  const negado = await semAcesso(['pessoas.funcionarios', 'pessoas.admissao', 'pessoas.rescisao'])
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  if (![...DOC_KEYS, ...DOC_KEYS_LEITURA].includes(key)) return { error: 'Documento inválido.' }

  const admin = createAdminClient()
  const col = key === 'foto' ? 'foto_path' : `doc_${key}_path`
  const { data: row } = await admin
    .from('employees')
    // '*': doc_contrato_path pode ainda não existir (migration 20261106000084)
    .select('*')
    .eq('id', employeeId)
    .single()
  const emp = row as (Record<string, string | null> & { company_id: string; profile_id: string | null }) | null
  if (!emp) return { error: 'Funcionário não encontrado.' }

  const { data: membership } = await admin
    .from('company_members').select('role')
    .eq('company_id', emp.company_id).eq('profile_id', user.id).eq('status', 'active').maybeSingle()
  if (!membership) return { error: 'Sem permissão para este arquivo.' }
  if (membership.role === 'colaborador' && emp.profile_id !== user.id) return { error: 'Sem permissão para este arquivo.' }

  const path = emp[col]
  if (!path) return { error: 'Arquivo não encontrado.' }

  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 3600, downloadName ? { download: downloadName } : undefined)
  if (error) return { error: error.message }
  return { url: data.signedUrl }
}

export async function grantSystemAccessAction(employeeId: string, companyId: string) {
  const negado = await semAcesso(['pessoas.funcionarios', 'pessoas.admissao', 'pessoas.rescisao'], companyId)
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  const viewerG = await getViewerContext(companyId)
  if (viewerG?.isColaborador) return { error: 'Sem permissão para esta ação.' }

  const admin = createAdminClient()

  const { data: employee } = await admin
    .from('employees')
    .select('nome, email, profile_id, company_id, status')
    .eq('id', employeeId)
    .eq('company_id', companyId)
    .single()

  if (!employee) return { error: 'Funcionário não encontrado.' }
  if (employee.status === 'demitido' || employee.status === 'inativo') return { error: 'Quem foi desligado não pode receber acesso ao sistema.' }
  if (!employee.email) return { error: 'Cadastre um e-mail para o funcionário antes de conceder acesso.' }
  if (employee.profile_id) return { error: 'Este funcionário já tem acesso ao sistema.' }

  const normalizedEmail = employee.email.trim().toLowerCase()
  const appUrl = await getAppUrl()

  // Já tem conta: entra direto como colaborador e o cadastro do funcionário passa a ser dela
  const existingUserId = await findUserIdByEmail(admin, normalizedEmail)
  if (existingUserId) {
    const r = await adicionarContaExistente(admin, {
      companyId, profileId: existingUserId, email: normalizedEmail, role: 'colaborador', employeeId, appUrl,
    })
    revalidatePath(`/pessoas/funcionarios/${employeeId}`)
    return r
  }

  const { data: existingInvite } = await admin
    .from('invitations')
    .select('id')
    .eq('company_id', companyId)
    .eq('email', normalizedEmail)
    .eq('status', 'pending')
    .maybeSingle()

  if (existingInvite) return { error: 'Já existe um convite pendente para este e-mail.' }

  const { data: inv, error: dbErr } = await admin.from('invitations').insert({
    company_id: companyId,
    email: normalizedEmail,
    role: 'colaborador',
    invited_by: user.id,
    status: 'pending',
    employee_id: employeeId,
  }).select('id').single()

  if (dbErr || !inv) return { error: dbErr?.message ?? 'Erro ao criar convite.' }

  // E-mail com link único para criar a senha (SMTP do sistema)
  const result = await enviarConvite(admin, inv.id, appUrl)
  revalidatePath(`/pessoas/funcionarios/${employeeId}`)
  return result
}

// Auto-edição do colaborador — só os campos de dados pessoais/contato.
// Nunca aceitar aqui campos administrativos (salário, status, contrato, datas, PIN etc.)
export async function updateOwnEmployeeDataAction(employeeId: string, formData: FormData) {
  const negado = await semAcesso(['pessoas.funcionarios', 'pessoas.admissao', 'pessoas.rescisao'])
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()

  const { data: employee } = await admin
    .from('employees')
    .select('profile_id, company_id')
    .eq('id', employeeId)
    .single()

  if (!employee || employee.profile_id !== user.id) {
    return { error: 'Você não tem permissão para editar este cadastro.' }
  }

  const updates = {
    telefone:        (formData.get('telefone') as string) || null,
    email:            (formData.get('email') as string) || null,
    dados_bancarios: (formData.get('dados_bancarios') as string) || null,
  }

  const { error } = await admin.from('employees').update(updates).eq('id', employeeId)
  if (error) return { error: error.message }

  revalidatePath(`/pessoas/funcionarios/${employeeId}`)
  return { success: true }
}

export async function deleteEmployeeAction(employeeId: string) {
  const negado = await semAcesso(['pessoas.funcionarios', 'pessoas.admissao', 'pessoas.rescisao'])
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()

  const { data: target } = await admin.from('employees').select('company_id').eq('id', employeeId).single()
  if (target) {
    const viewerD = await getViewerContext(target.company_id)
    if (viewerD?.isColaborador) return { error: 'Sem permissão para esta ação.' }
  }

  const { error } = await admin.from('employees').delete().eq('id', employeeId)

  if (error) return { error: error.message }
  revalidatePath('/pessoas/funcionarios')
  return { success: true }
}
