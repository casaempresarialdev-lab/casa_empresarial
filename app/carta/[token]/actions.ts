'use server'

import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { registrarAceite } from '@/lib/admissao-aceite'
import { avisarRespostaCarta } from '@/lib/admissao-email'
import { removerDaAdmissao } from '@/lib/admissao-remover'

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

  const r = await registrarAceite(admin, { cartaId: carta.id as string, ip: await ipDoCliente() })
  if ('error' in r) return { error: r.error }
  const { companyId, employeeId } = r
  const emp = { nome: r.nome }

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
