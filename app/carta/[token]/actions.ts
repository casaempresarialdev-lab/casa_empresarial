'use server'

import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { gerarCartaPdf } from '@/lib/admissao-carta-pdf'
import { avisarRespostaCarta } from '@/lib/admissao-email'
import { removerDaAdmissao } from '@/lib/admissao-remover'
import { fmtDataHora } from '@/lib/validations/admissao'

type Admin = ReturnType<typeof createAdminClient>

const INDISPONIVEL = 'Esta proposta não está mais disponível.'

async function ipDoCliente() {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null
}

async function urlBase() {
  const h = await headers()
  return `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host') ?? 'localhost:3000'}`
}

/** Carta ainda sem resposta e dentro da validade */
async function cartaValida(admin: Admin, token: string) {
  const { data } = await admin
    .from('admission_offers')
    .select('id, company_id, employee_id, conteudo, cargo, salario, data_inicio, local_trabalho, status, expira_em, enviada_por')
    .eq('token', token)
    .maybeSingle()
  if (!data || data.status !== 'enviada' || !data.employee_id || Date.parse(data.expira_em as string) < Date.now()) return null
  return data
}

/** Avisa quem enviou a carta; falha no aviso não desfaz a resposta do candidato */
async function avisarQuemEnviou(admin: Admin, opcoes: { enviadaPor: string | null; companyId: string; candidato: string; aceita: boolean; motivo?: string | null }) {
  if (!opcoes.enviadaPor) return
  const { data } = await admin.auth.admin.getUserById(opcoes.enviadaPor)
  if (!data.user?.email) return
  await avisarRespostaCarta({
    companyId: opcoes.companyId,
    para: data.user.email,
    candidato: opcoes.candidato,
    aceita: opcoes.aceita,
    motivo: opcoes.motivo,
    link: `${await urlBase()}/pessoas/admissao`,
  }).catch(() => undefined)
}

/**
 * Aceite: registra data, hora e IP, leva as condições da carta para o cadastro, guarda o PDF nos arquivos do
 * funcionário e devolve o link para o candidato preencher os dados.
 */
export async function aceitarCartaAction(token: string): Promise<{ url?: string; error?: string }> {
  const admin = createAdminClient()
  const carta = await cartaValida(admin, token)
  if (!carta) return { error: INDISPONIVEL }

  const { data: emp } = await admin
    .from('employees')
    .select('id, nome, tipo_contrato')
    .eq('id', carta.employee_id as string)
    .eq('status', 'admissao')
    .maybeSingle()
  if (!emp) return { error: INDISPONIVEL }

  const ip = await ipDoCliente()
  const agora = new Date().toISOString()

  // Só o primeiro aceite vale, mesmo com dois cliques
  const { data: aceita, error } = await admin
    .from('admission_offers')
    .update({ status: 'aceita', respondida_em: agora, resposta_ip: ip })
    .eq('id', carta.id as string)
    .eq('status', 'enviada')
    .select('id')
    .maybeSingle()
  if (error) return { error: 'Não foi possível registrar o aceite. Tente novamente.' }
  if (!aceita) return { error: INDISPONIVEL }

  const companyId = carta.company_id as string
  const employeeId = emp.id as string
  const pj = emp.tipo_contrato === 'pj' || emp.tipo_contrato === 'autonomo'

  const { error: errEmp } = await admin
    .from('employees')
    .update({
      cargo: carta.cargo,
      local_trabalho: carta.local_trabalho,
      data_admissao: carta.data_inicio,
      ...(carta.salario != null && (pj ? { valor_servico: carta.salario } : { salario: carta.salario })),
    })
    .eq('id', employeeId)
  if (errEmp) console.error('[carta] condições não copiadas para o cadastro:', errEmp.message)

  const { data: cand } = await admin.from('job_applications').select('id').eq('employee_id', employeeId).maybeSingle()
  await admin.from('admission_notes').insert({
    company_id: companyId,
    employee_id: employeeId,
    application_id: cand?.id ?? null,
    texto: `Carta proposta aceita${ip ? ` (IP ${ip})` : ''}.`,
    autor_nome: emp.nome,
  })

  // PDF: o aceite vale mesmo se o arquivo falhar (o texto e o registro ficam no banco)
  try {
    const { data: empresa } = await admin.from('companies').select('nome_fantasia, razao_social').eq('id', companyId).maybeSingle()
    const pdf = gerarCartaPdf({
      empresa: empresa?.nome_fantasia || empresa?.razao_social || '',
      candidato: emp.nome as string,
      conteudo: carta.conteudo as string,
      aceitaEm: fmtDataHora(agora),
      ip,
    })
    const path = `funcionarios/${companyId}/${employeeId}/carta_proposta_${Date.now()}.pdf`
    const { error: errUp } = await admin.storage.from('documentos').upload(path, pdf, { contentType: 'application/pdf', upsert: false })
    if (errUp) throw new Error(errUp.message)
    await admin.from('admission_offers').update({ pdf_path: path }).eq('id', carta.id as string)
    await admin.from('employees').update({ doc_carta_proposta_path: path }).eq('id', employeeId)
  } catch (e) {
    console.error('[carta] PDF não gerado:', e instanceof Error ? e.message : e)
  }

  const { data: link, error: errLink } = await admin
    .from('employee_onboarding_tokens')
    .insert({ employee_id: employeeId, company_id: companyId })
    .select('token')
    .single()

  await avisarQuemEnviou(admin, { enviadaPor: carta.enviada_por as string | null, companyId, candidato: emp.nome as string, aceita: true })

  if (errLink || !link) return { error: 'Seu aceite foi registrado, mas o formulário de dados não abriu. A empresa enviará um novo link.' }
  return { url: `/auto-cadastro/${link.token}` }
}

/** Recusa: a candidatura volta para a vaga como "Desistiu" e o cadastro em admissão é apagado */
export async function recusarCartaAction(token: string, motivo: string): Promise<{ success?: true; error?: string }> {
  const admin = createAdminClient()
  const carta = await cartaValida(admin, token)
  if (!carta) return { error: INDISPONIVEL }

  const { data: emp } = await admin.from('employees').select('nome').eq('id', carta.employee_id as string).maybeSingle()
  if (!emp) return { error: INDISPONIVEL }

  const motivoLimpo = motivo.trim().slice(0, 1000) || null

  const { data: recusada, error } = await admin
    .from('admission_offers')
    .update({ status: 'recusada', respondida_em: new Date().toISOString(), resposta_ip: await ipDoCliente(), motivo_recusa: motivoLimpo })
    .eq('id', carta.id as string)
    .eq('status', 'enviada')
    .select('id')
    .maybeSingle()
  if (error) return { error: 'Não foi possível registrar a resposta. Tente novamente.' }
  if (!recusada) return { error: INDISPONIVEL }

  const companyId = carta.company_id as string
  const r = await removerDaAdmissao(admin, {
    employeeId: carta.employee_id as string,
    companyId,
    statusCandidatura: 'desistiu',
    motivo: motivoLimpo,
    texto: motivoLimpo ? `Carta proposta recusada. Motivo: ${motivoLimpo}` : 'Carta proposta recusada.',
    autorId: null,
    autorNome: emp.nome as string,
  })
  if (r.error) console.error('[carta] recusa registrada, mas o cadastro não foi removido:', r.error)

  await avisarQuemEnviou(admin, { enviadaPor: carta.enviada_por as string | null, companyId, candidato: emp.nome as string, aceita: false, motivo: motivoLimpo })
  return { success: true }
}
