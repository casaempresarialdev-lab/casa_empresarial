'use server'

import { revalidatePath } from 'next/cache'
import { requireGestor } from '@/lib/auth/gestor'
import type { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { avisarEntrevista, enviarCartaProposta } from '@/lib/admissao-email'
import { cancelarEntrevistasFuturas, removerDaAdmissao } from '@/lib/admissao-remover'
import { cartaSchema, entrevistaParaIso, entrevistaSchema, fmtDataHora, preencherModelo } from '@/lib/validations/admissao'
import { ETAPAS, ETAPA_CARTA, ETAPA_FINAL, ETAPA_INICIAL, isEtapa } from './etapas'
import { getConfigAdmissao } from './queries'
import { addDays, normalizarValor } from '../funcionarios/components/ficha/ficha-config'

const FORA_DO_KANBAN = 'Esta admissão não está mais no kanban.'

type Admin = ReturnType<typeof createAdminClient>

function revalidar() {
  revalidatePath('/pessoas/admissao')
  revalidatePath('/pessoas/vagas', 'layout')
  revalidatePath('/pessoas/funcionarios')
}

/** Cadastro em admissão desta empresa, com a candidatura e a vaga de origem */
async function buscarEmAdmissao(admin: Admin, employeeId: string, companyId: string) {
  const { data: emp } = await admin
    .from('employees')
    .select('id, nome, email, admission_stage')
    .eq('id', employeeId)
    .eq('company_id', companyId)
    .eq('status', 'admissao')
    .maybeSingle()
  if (!emp) return null

  const { data: cand } = await admin
    .from('job_applications')
    .select('id, job_openings(titulo)')
    .eq('employee_id', employeeId)
    .eq('company_id', companyId)
    .maybeSingle()

  return {
    ...(emp as { id: string; nome: string; email: string | null; admission_stage: string | null }),
    applicationId: (cand?.id as string | undefined) ?? null,
    vagaTitulo: (cand?.job_openings as unknown as { titulo: string } | null)?.titulo ?? null,
  }
}

async function nomeDe(admin: Admin, profileId: string) {
  const { data } = await admin.from('profiles').select('name').eq('id', profileId).maybeSingle()
  return (data?.name as string | undefined) || 'Usuário'
}

async function registrarAnotacao(admin: Admin, opcoes: { companyId: string; employeeId: string; applicationId: string | null; autorId: string; texto: string }) {
  return admin.from('admission_notes').insert({
    company_id: opcoes.companyId,
    employee_id: opcoes.employeeId,
    application_id: opcoes.applicationId,
    texto: opcoes.texto,
    autor_id: opcoes.autorId,
    autor_nome: await nomeDe(admin, opcoes.autorId),
  })
}

async function cartaAceita(admin: Admin, employeeId: string, companyId: string) {
  const { count } = await admin
    .from('admission_offers')
    .select('id', { count: 'exact', head: true })
    .eq('employee_id', employeeId)
    .eq('company_id', companyId)
    .eq('status', 'aceita')
  return (count ?? 0) > 0
}

/**
 * Envia a carta proposta por e-mail, com o link público e a validade das configurações.
 * Uma carta nova substitui a anterior, cujo link deixa de valer.
 */
export async function enviarCartaAction(companyId: string, employeeId: string, data: unknown) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin, user } = auth

  const parsed = cartaSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const d = parsed.data

  const emp = await buscarEmAdmissao(admin, employeeId, companyId)
  if (!emp) return { error: FORA_DO_KANBAN }
  if (emp.admission_stage !== ETAPA_CARTA) return { error: 'Este candidato não está na etapa da carta proposta.' }
  if (!emp.email) return { error: 'Cadastre o e-mail do candidato na ficha antes de enviar a carta.' }
  if (await cartaAceita(admin, employeeId, companyId)) return { error: 'A carta proposta já foi aceita.' }

  const config = await getConfigAdmissao(companyId)
  const expiraEm = new Date(Date.now() + config.carta_validade_dias * 86_400_000).toISOString()
  const { data: empresa } = await admin.from('companies').select('nome_fantasia, razao_social').eq('id', companyId).maybeSingle()
  const assunto = preencherModelo(config.carta_assunto, {
    nome: emp.nome,
    empresa: empresa?.nome_fantasia || empresa?.razao_social || '',
    vaga: emp.vagaTitulo ?? '',
    cargo: d.cargo,
  })

  const { error: errAntiga } = await admin
    .from('admission_offers')
    .update({ status: 'substituida' })
    .eq('employee_id', employeeId)
    .eq('company_id', companyId)
    .eq('status', 'enviada')
  if (errAntiga) return { error: errAntiga.message }

  const { data: carta, error } = await admin
    .from('admission_offers')
    .insert({
      company_id: companyId,
      employee_id: employeeId,
      application_id: emp.applicationId,
      assunto,
      conteudo: d.conteudo,
      cargo: d.cargo || null,
      salario: d.salario ? Number(normalizarValor(d.salario)) : null,
      data_inicio: d.data_inicio,
      local_trabalho: d.local_trabalho || null,
      beneficios: d.beneficios || null,
      expira_em: expiraEm,
      enviada_por: user.id,
    })
    .select('token')
    .single()
  if (error || !carta) return { error: error?.message ?? 'Não foi possível criar a carta.' }

  const hdrs = await headers()
  const link = `${hdrs.get('x-forwarded-proto') ?? 'http'}://${hdrs.get('host') ?? 'localhost:3000'}/carta/${carta.token}`
  const envio = await enviarCartaProposta({
    companyId,
    nome: emp.nome,
    email: emp.email,
    assunto,
    link,
    validaAte: fmtDataHora(expiraEm),
  })

  await registrarAnotacao(admin, { companyId, employeeId, applicationId: emp.applicationId, autorId: user.id, texto: 'Carta proposta enviada.' })
  revalidatePath('/pessoas/admissao')
  return { success: true as const, emailEnviado: envio.status === 'enviado', link }
}

/**
 * Move o card entre as etapas. Da entrevista só se sai aprovando ou reprovando;
 * ir para o fim é pelo finalizarAdmissaoAction, que coloca a pessoa na Equipe.
 */
export async function moverEtapaAction(employeeId: string, companyId: string, etapa: string) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  if (!isEtapa(etapa) || etapa === ETAPA_FINAL) return { error: 'Etapa inválida.' }

  const emp = await buscarEmAdmissao(auth.admin, employeeId, companyId)
  if (!emp) return { error: FORA_DO_KANBAN }
  if (emp.admission_stage === ETAPA_INICIAL && etapa !== ETAPA_INICIAL) {
    return { error: 'Abra o card para aprovar ou reprovar a entrevista.' }
  }
  const avancando = ETAPAS.findIndex((e) => e.key === etapa) > ETAPAS.findIndex((e) => e.key === emp.admission_stage)
  if (emp.admission_stage === ETAPA_CARTA && avancando && !(await cartaAceita(auth.admin, employeeId, companyId))) {
    return { error: 'A carta proposta precisa ser aceita antes de avançar.' }
  }

  const { error } = await auth.admin
    .from('employees')
    .update({ admission_stage: etapa })
    .eq('id', employeeId)
    .eq('company_id', companyId)
    .eq('status', 'admissao')

  if (error) return { error: error.message }
  revalidatePath('/pessoas/admissao')
  return { success: true as const }
}

/** "Deixar em espera": o card fica na etapa, oculto até pedir para exibir */
export async function definirEsperaAction(employeeId: string, companyId: string, emEspera: boolean) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin, user } = auth

  const emp = await buscarEmAdmissao(admin, employeeId, companyId)
  if (!emp) return { error: FORA_DO_KANBAN }

  const { error } = await admin
    .from('employees')
    .update({ admissao_em_espera: emEspera })
    .eq('id', employeeId)
    .eq('company_id', companyId)
  if (error) return { error: error.message }

  await registrarAnotacao(admin, {
    companyId, employeeId, applicationId: emp.applicationId, autorId: user.id,
    texto: emEspera ? 'Deixado em espera.' : 'Retomado da espera.',
  })
  revalidatePath('/pessoas/admissao')
  return { success: true as const }
}

// ── Entrevista ───────────────────────────────────────────────────────────────

/** Marca (ou remarca) a entrevista: grava, cria o evento na agenda do entrevistador e avisa o candidato */
export async function salvarEntrevistaAction(companyId: string, employeeId: string, entrevistaId: string | null, data: unknown) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin, user } = auth

  const parsed = entrevistaSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const d = parsed.data

  const dataHora = entrevistaParaIso(d.data, d.hora)
  if (Number.isNaN(Date.parse(dataHora)) || Date.parse(dataHora) <= Date.now()) return { error: 'Escolha uma data e hora futuras.' }

  const emp = await buscarEmAdmissao(admin, employeeId, companyId)
  if (!emp) return { error: FORA_DO_KANBAN }

  // O entrevistador precisa ser usuário ativo desta empresa
  const { data: membro } = await admin
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('profile_id', d.entrevistador_id)
    .eq('status', 'active')
    .maybeSingle()
  if (!membro || membro.role === 'colaborador') return { error: 'Escolha um entrevistador da empresa.' }

  const duracao = Number(d.duracao_min)
  const link = d.link_reuniao || null
  const entrevistadorNome = await nomeDe(admin, d.entrevistador_id)

  const evento = {
    profile_id: d.entrevistador_id,
    titulo: `Entrevista: ${emp.nome}`,
    descricao: emp.vagaTitulo ? `Vaga: ${emp.vagaTitulo}` : 'Admissão',
    data_hora: dataHora,
    duracao_min: duracao,
    link_reuniao: link,
    notificar: true,
    antecedencia_min: 30,
    notificar_email: true,
  }

  let reminderId: string | null = null
  if (entrevistaId) {
    const { data: atual } = await admin
      .from('admission_interviews')
      .select('reminder_id')
      .eq('id', entrevistaId)
      .eq('employee_id', employeeId)
      .eq('company_id', companyId)
      .eq('status', 'agendada')
      .maybeSingle()
    if (!atual) return { error: 'Esta entrevista não pode mais ser alterada.' }
    reminderId = atual.reminder_id as string | null
  }

  // Remarcou: o aviso volta a valer para o novo horário. Evento apagado na agenda: cria outro.
  if (reminderId) {
    const { error } = await admin.from('reminders').update({ ...evento, email_enviado_em: null, aviso_visto_em: null, concluido: false }).eq('id', reminderId)
    if (error) return { error: `Não foi possível atualizar o evento da agenda: ${error.message}` }
  } else {
    const { data: criado, error } = await admin.from('reminders').insert(evento).select('id').single()
    if (error || !criado) return { error: `Não foi possível criar o evento na agenda: ${error?.message ?? ''}` }
    reminderId = criado.id as string
  }

  const campos = {
    entrevistador_id: d.entrevistador_id,
    entrevistador_nome: entrevistadorNome,
    data_hora: dataHora,
    duracao_min: duracao,
    link_reuniao: link,
    reminder_id: reminderId,
  }
  const { error } = entrevistaId
    ? await admin.from('admission_interviews').update(campos).eq('id', entrevistaId).eq('company_id', companyId)
    : await admin.from('admission_interviews').insert({
        ...campos,
        company_id: companyId,
        employee_id: employeeId,
        application_id: emp.applicationId,
        created_by: user.id,
      })
  if (error) {
    // Sem a entrevista, um evento recém-criado ficaria solto na agenda
    if (!entrevistaId) await admin.from('reminders').delete().eq('id', reminderId)
    return { error: error.message }
  }

  const aviso = emp.email
    ? await avisarEntrevista({
        tipo: entrevistaId ? 'remarcada' : 'agendada',
        companyId,
        nome: emp.nome,
        email: emp.email,
        vagaTitulo: emp.vagaTitulo,
        dataHora,
        link,
      })
    : null

  revalidatePath('/pessoas/admissao')
  return { success: true as const, candidatoAvisado: aviso?.status === 'enviado' }
}

export async function cancelarEntrevistaAction(companyId: string, entrevistaId: string) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin } = auth

  const { data: entrevista } = await admin
    .from('admission_interviews')
    .update({ status: 'cancelada' })
    .eq('id', entrevistaId)
    .eq('company_id', companyId)
    .eq('status', 'agendada')
    .select('employee_id, data_hora, reminder_id')
    .maybeSingle()
  if (!entrevista) return { error: 'Esta entrevista não pode mais ser cancelada.' }

  if (entrevista.reminder_id) await admin.from('reminders').delete().eq('id', entrevista.reminder_id as string)

  const emp = entrevista.employee_id ? await buscarEmAdmissao(admin, entrevista.employee_id as string, companyId) : null
  const aviso = emp?.email
    ? await avisarEntrevista({
        tipo: 'cancelada',
        companyId,
        nome: emp.nome,
        email: emp.email,
        vagaTitulo: emp.vagaTitulo,
        dataHora: entrevista.data_hora as string,
        link: null,
      })
    : null

  revalidatePath('/pessoas/admissao')
  return { success: true as const, candidatoAvisado: aviso?.status === 'enviado' }
}

export async function adicionarAnotacaoAction(companyId: string, employeeId: string, texto: string) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin, user } = auth

  const limpo = texto.trim().slice(0, 5000)
  if (!limpo) return { error: 'Escreva a anotação.' }

  const emp = await buscarEmAdmissao(admin, employeeId, companyId)
  if (!emp) return { error: FORA_DO_KANBAN }

  const { error } = await registrarAnotacao(admin, { companyId, employeeId, applicationId: emp.applicationId, autorId: user.id, texto: limpo })
  if (error) return { error: error.message }
  revalidatePath('/pessoas/admissao')
  return { success: true as const }
}

/** Aprovado na entrevista: segue para a etapa seguinte */
export async function aprovarEntrevistaAction(employeeId: string, companyId: string) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin, user } = auth

  const emp = await buscarEmAdmissao(admin, employeeId, companyId)
  if (!emp) return { error: FORA_DO_KANBAN }
  if (emp.admission_stage !== ETAPA_INICIAL) return { error: 'Este candidato não está na etapa de entrevista.' }

  const { error } = await admin
    .from('employees')
    .update({ admission_stage: 'enviar_carta_proposta', admissao_em_espera: false })
    .eq('id', employeeId)
    .eq('company_id', companyId)
  if (error) return { error: error.message }

  await cancelarEntrevistasFuturas(admin, employeeId, companyId)
  await registrarAnotacao(admin, { companyId, employeeId, applicationId: emp.applicationId, autorId: user.id, texto: 'Aprovado na entrevista.' })
  revalidatePath('/pessoas/admissao')
  return { success: true as const }
}

/** Reprovado: a candidatura volta para a vaga e o cadastro em admissão é apagado (ver removerDaAdmissao) */
export async function reprovarAdmissaoAction(employeeId: string, companyId: string, motivo?: string) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin, user } = auth

  const motivoLimpo = motivo?.trim().slice(0, 1000) || null
  const r = await removerDaAdmissao(admin, {
    employeeId,
    companyId,
    statusCandidatura: 'reprovada',
    motivo: motivoLimpo,
    texto: motivoLimpo ? `Reprovado. Motivo: ${motivoLimpo}` : 'Reprovado.',
    autorId: user.id,
    autorNome: await nomeDe(admin, user.id),
  })
  if (r.error) return { error: r.error }

  revalidar()
  return { success: true as const }
}

/** Fim do fluxo: entra na Equipe. CLT começa em experiência (datas calculadas pela admissão); os demais, ativos. */
export async function finalizarAdmissaoAction(employeeId: string, companyId: string, dataAdmissao: string) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataAdmissao)) return { error: 'Informe a data de admissão.' }
  const { admin } = auth

  const { data: emp } = await admin
    .from('employees')
    .select('tipo_contrato, admission_stage, fim_experiencia_1, fim_experiencia_2, vcto_ferias, conceder_ferias_ate')
    .eq('id', employeeId)
    .eq('company_id', companyId)
    .eq('status', 'admissao')
    .maybeSingle()
  if (!emp) return { error: FORA_DO_KANBAN }
  if (emp.admission_stage === ETAPA_INICIAL) return { error: 'Abra o card para aprovar ou reprovar a entrevista.' }
  if (emp.admission_stage === ETAPA_CARTA && !(await cartaAceita(admin, employeeId, companyId))) {
    return { error: 'A carta proposta precisa ser aceita antes de avançar.' }
  }

  const clt = emp.tipo_contrato === 'clt'
  const pj = emp.tipo_contrato === 'pj' || emp.tipo_contrato === 'autonomo'
  const fim1 = emp.fim_experiencia_1 ?? addDays(dataAdmissao, 44)
  const vcto = emp.vcto_ferias ?? addDays(dataAdmissao, 364)

  const { error } = await admin
    .from('employees')
    .update({
      status: clt ? 'experiencia' : 'ativo',
      admission_stage: ETAPA_FINAL,
      admissao_em_espera: false,
      data_admissao: dataAdmissao,
      ...(clt && { fim_experiencia_1: fim1, fim_experiencia_2: emp.fim_experiencia_2 ?? addDays(fim1, 45) }),
      ...(!pj && { vcto_ferias: vcto, conceder_ferias_ate: emp.conceder_ferias_ate ?? addDays(vcto, 330) }),
    })
    .eq('id', employeeId)
    .eq('company_id', companyId)

  if (error) return { error: error.message }
  revalidar()
  return { success: true as const, status: clt ? 'experiencia' : 'ativo' }
}
