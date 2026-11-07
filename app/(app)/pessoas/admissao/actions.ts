'use server'

import { revalidatePath } from 'next/cache'
import { requireGestor } from '@/lib/auth/gestor'
import type { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { avisarEntrevista, avisarExame, avisarReprovacao, enviarCartaProposta } from '@/lib/admissao-email'
import { cancelarEntrevistasFuturas, removerDaAdmissao } from '@/lib/admissao-remover'
import { registrarAceite } from '@/lib/admissao-aceite'
import { salvarDadosAdmissao } from '@/lib/admissao-dados'
import { seguirEtapa } from '@/lib/admissao-concluir'
import {
  ASO_MAX_BYTES, CONTRATO_MAX_BYTES, GUIA_TIPOS, cartaSchema, type CartaInput, entrevistaParaIso, entrevistaSchema, exameSchema, fmtDataHora, preencherModelo, resultadoExameSchema,
} from '@/lib/validations/admissao'
import {
  ETAPA_CARTA, ETAPA_EXAME, ETAPA_FINAL, ETAPA_INICIAL, ETAPA_RESULTADO_EXAME,
  ETAPA_AGUARDAR_CONTABILIDADE, ETAPA_CONTABILIDADE, ETAPA_CONTRATO,
  indiceEtapa, isPersonalizada, labelEtapa,
} from './etapas'
import { getConfigAdmissao, getEtapasAdmissao } from './queries'
import { normalizarValor } from '../funcionarios/components/ficha/ficha-config'

const FORA_DO_KANBAN = 'Esta admissão não está mais no kanban.'
const SAIR_DO_RESULTADO = 'Abra a ficha de admissão e registre o resultado do exame: o card segue sozinho.'
const SAIR_DO_EXAME = 'Abra a ficha de admissão e encaminhe o candidato para o exame: o card segue sozinho.'

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
    .select('id, nome, email, cargo, admission_stage')
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
    ...(emp as { id: string; nome: string; email: string | null; cargo: string | null; admission_stage: string | null }),
    applicationId: (cand?.id as string | undefined) ?? null,
    vagaTitulo: (cand?.job_openings as unknown as { titulo: string } | null)?.titulo ?? null,
  }
}

async function nomeDe(admin: Admin, profileId: string) {
  const { data } = await admin.from('profiles').select('name').eq('id', profileId).maybeSingle()
  return (data?.name as string | undefined) || 'Usuário'
}

const autorDe = async (admin: Admin, profileId: string) => ({ id: profileId, nome: await nomeDe(admin, profileId) })

/** Linha do tempo da ficha: por padrão, um evento registrado pelo sistema */
async function registrarAnotacao(admin: Admin, opcoes: { companyId: string; employeeId: string; applicationId: string | null; autorId: string; texto: string; tipo?: 'anotacao' | 'evento' }) {
  return admin.from('admission_notes').insert({
    company_id: opcoes.companyId,
    employee_id: opcoes.employeeId,
    application_id: opcoes.applicationId,
    texto: opcoes.texto,
    tipo: opcoes.tipo ?? 'evento',
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

/** Grava uma carta nova (com o assunto e a validade das configurações); a anterior deixa de valer */
async function criarCarta(admin: Admin, opcoes: {
  companyId: string
  emp: { id: string; nome: string; applicationId: string | null; vagaTitulo: string | null }
  d: CartaInput
  autorId: string
}) {
  const { companyId, emp, d, autorId } = opcoes
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
    .eq('employee_id', emp.id)
    .eq('company_id', companyId)
    .eq('status', 'enviada')
  if (errAntiga) return { error: errAntiga.message }

  const { data: carta, error } = await admin
    .from('admission_offers')
    .insert({
      company_id: companyId,
      employee_id: emp.id,
      application_id: emp.applicationId,
      assunto,
      conteudo: d.conteudo,
      cargo: d.cargo || null,
      salario: d.salario ? Number(normalizarValor(d.salario)) : null,
      data_inicio: d.data_inicio,
      local_trabalho: d.local_trabalho || null,
      beneficios: d.beneficios || null,
      expira_em: expiraEm,
      enviada_por: autorId,
    })
    .select('id, token')
    .single()
  if (error || !carta) return { error: error?.message ?? 'Não foi possível criar a carta.' }
  return { carta: carta as { id: string; token: string }, assunto, expiraEm }
}

/**
 * Aceite registrado no painel: o candidato aceitou pessoalmente. Com os dados do formulário, grava a carta e já a
 * marca como aceita; sem eles, usa a carta enviada que está aguardando resposta.
 */
export async function registrarAceiteAction(companyId: string, employeeId: string, data: unknown | null) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin, user } = auth

  const emp = await buscarEmAdmissao(admin, employeeId, companyId)
  if (!emp) return { error: FORA_DO_KANBAN }
  if (emp.admission_stage !== ETAPA_CARTA) return { error: 'Este candidato não está na etapa da carta proposta.' }
  if (await cartaAceita(admin, employeeId, companyId)) return { error: 'A carta proposta já foi aceita.' }

  let cartaId: string
  if (data) {
    const parsed = cartaSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0].message }
    const criada = await criarCarta(admin, { companyId, emp, d: parsed.data, autorId: user.id })
    if ('error' in criada) return { error: criada.error }
    cartaId = criada.carta.id
  } else {
    const { data: enviada } = await admin
      .from('admission_offers')
      .select('id')
      .eq('employee_id', employeeId)
      .eq('company_id', companyId)
      .eq('status', 'enviada')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!enviada) return { error: 'Não há carta aguardando resposta.' }
    cartaId = enviada.id as string
  }

  const r = await registrarAceite(admin, { cartaId, ip: null, registradoPor: { id: user.id, nome: await nomeDe(admin, user.id) } })
  if ('error' in r) return { error: r.error }
  revalidatePath('/pessoas/admissao')
  return { success: true as const }
}

/** Preenchimento dos dados no painel, por quem acompanha a admissão (mesmo formulário do candidato) */
export async function preencherDadosAction(companyId: string, employeeId: string, formData: FormData) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin, user } = auth

  const emp = await buscarEmAdmissao(admin, employeeId, companyId)
  if (!emp) return { error: FORA_DO_KANBAN }

  const r = await salvarDadosAdmissao(admin, { employeeId, companyId, formData, autor: { id: user.id, nome: await nomeDe(admin, user.id) } })
  if (r.error) return { error: r.error }
  revalidatePath('/pessoas/admissao')
  revalidatePath('/pessoas/funcionarios')
  return { success: true as const }
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

  const criada = await criarCarta(admin, { companyId, emp, d, autorId: user.id })
  if ('error' in criada) return { error: criada.error }
  const { carta, assunto, expiraEm } = criada

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
 * Move o card entre as etapas: arrastando, só para trás. Para frente, cada etapa avança pela própria ação na ficha;
 * o fim é pelo finalizarAdmissaoAction, com o contrato assinado.
 */
export async function moverEtapaAction(employeeId: string, companyId: string, etapa: string) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const etapas = await getEtapasAdmissao(companyId)
  const destino = etapas.find((e) => e.key === etapa)
  if (!destino || etapa === ETAPA_FINAL) return { error: 'Etapa inválida.' }
  if (!destino.ativo) return { error: 'Esta etapa está inativa nas configurações.' }

  const emp = await buscarEmAdmissao(auth.admin, employeeId, companyId)
  if (!emp) return { error: FORA_DO_KANBAN }
  if (emp.admission_stage === ETAPA_INICIAL && etapa !== ETAPA_INICIAL) {
    return { error: 'Abra o card para aprovar ou reprovar a entrevista.' }
  }
  const avancando = indiceEtapa(etapas, etapa) > indiceEtapa(etapas, emp.admission_stage)
  // Da carta só se sai preenchendo os dados (o card avança sozinho ao concluir)
  if (emp.admission_stage === ETAPA_CARTA && avancando) {
    return { error: 'Abra a ficha de admissão: a etapa avança ao concluir o preenchimento dos dados.' }
  }
  // Do exame só se sai encaminhando o candidato (o card segue sozinho)
  if (emp.admission_stage === ETAPA_EXAME && avancando) return { error: SAIR_DO_EXAME }
  if (emp.admission_stage === ETAPA_RESULTADO_EXAME && avancando) return { error: SAIR_DO_RESULTADO }
  // Daqui em diante cada etapa avança pela própria ação na ficha
  if (avancando) return { error: 'Abra a ficha de admissão: cada etapa avança pela ação dela.' }

  const { error } = await auth.admin
    .from('employees')
    .update({ admission_stage: etapa })
    .eq('id', employeeId)
    .eq('company_id', companyId)
    .eq('status', 'admissao')

  if (error) return { error: error.message }
  await registrarAnotacao(auth.admin, {
    companyId, employeeId, applicationId: emp.applicationId, autorId: auth.user.id,
    texto: `Movido para "${destino.label}".`,
  })
  revalidatePath('/pessoas/admissao')
  return { success: true as const }
}

/**
 * Etapa personalizada (controle interno, sem integração): a anotação, se houver, entra no histórico
 * e o card segue para a próxima etapa ativa.
 */
export async function avancarEtapaPersonalizadaAction(companyId: string, employeeId: string, anotacao?: string, dataAdmissao?: string) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin, user } = auth
  if (dataAdmissao && !/^\d{4}-\d{2}-\d{2}$/.test(dataAdmissao)) return { error: 'Data de admissão inválida.' }

  const emp = await buscarEmAdmissao(admin, employeeId, companyId)
  if (!emp) return { error: FORA_DO_KANBAN }
  if (!isPersonalizada(emp.admission_stage)) return { error: 'Esta etapa avança pela ação dela na ficha.' }

  const etapas = await getEtapasAdmissao(companyId)
  const atual = emp.admission_stage!

  const limpo = anotacao?.trim().slice(0, 5000)
  if (limpo) await registrarAnotacao(admin, { companyId, employeeId, applicationId: emp.applicationId, autorId: user.id, texto: limpo, tipo: 'anotacao' })
  await registrarAnotacao(admin, { companyId, employeeId, applicationId: emp.applicationId, autorId: user.id, texto: `"${labelEtapa(etapas, atual)}" concluída.` })

  const r = await seguirEtapa(admin, { companyId, employeeId, de: atual, autor: await autorDe(admin, user.id), dataAdmissao })
  if ('error' in r) return { error: r.error }
  revalidar()
  return { ...r, proxima: labelEtapa(etapas, r.proxima) }
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

  await registrarAnotacao(admin, {
    companyId, employeeId, applicationId: emp.applicationId, autorId: user.id,
    texto: `Entrevista ${entrevistaId ? 'remarcada' : 'marcada'} para ${fmtDataHora(dataHora)} com ${entrevistadorNome}.`,
  })
  revalidatePath('/pessoas/admissao')
  return { success: true as const, candidatoAvisado: aviso?.status === 'enviado' }
}

export async function cancelarEntrevistaAction(companyId: string, entrevistaId: string) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin, user } = auth

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

  if (emp) {
    await registrarAnotacao(admin, {
      companyId, employeeId: emp.id, applicationId: emp.applicationId, autorId: user.id,
      texto: `Entrevista de ${fmtDataHora(entrevista.data_hora as string)} cancelada.`,
    })
  }
  revalidatePath('/pessoas/admissao')
  return { success: true as const, candidatoAvisado: aviso?.status === 'enviado' }
}

// ── Exame admissional ────────────────────────────────────────────────────────

/** Guia anexada ao e-mail: a da clínica ou, sem ela, a geral da empresa */
async function baixarGuia(admin: Admin, path: string | null, nome: string | null) {
  if (!path) return null
  const { data, error } = await admin.storage.from('documentos').download(path)
  if (error || !data) { console.error('[admissão] guia indisponível:', error?.message); return null }
  const ext = path.split('.').pop()
  return { filename: nome || `guia-de-encaminhamento.${ext}`, content: Buffer.from(await data.arrayBuffer()) }
}

/**
 * Encaminha o candidato para o exame (ou troca o encaminhamento): grava com uma cópia dos dados da clínica e,
 * se a configuração mandar, envia o e-mail com a guia. Não entra na agenda: quem vai ao exame é o candidato.
 */
export async function encaminharExameAction(companyId: string, employeeId: string, data: unknown) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin, user } = auth

  const parsed = exameSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const d = parsed.data

  const dataHora = d.data ? entrevistaParaIso(d.data, d.hora) : null
  if (dataHora && (Number.isNaN(Date.parse(dataHora)) || Date.parse(dataHora) <= Date.now())) return { error: 'Escolha uma data e hora futuras.' }

  const emp = await buscarEmAdmissao(admin, employeeId, companyId)
  if (!emp) return { error: FORA_DO_KANBAN }
  // Na etapa do resultado ainda dá para reencaminhar (exame remarcado ou em outra clínica)
  const reencaminhando = emp.admission_stage === ETAPA_RESULTADO_EXAME
  if (emp.admission_stage !== ETAPA_EXAME && !reencaminhando) return { error: 'Este candidato não está na etapa do exame.' }

  const { data: clinica } = await admin
    .from('admission_clinics')
    .select('id, nome, endereco, telefone, guia_path, guia_nome')
    .eq('id', d.clinic_id)
    .eq('company_id', companyId)
    .eq('ativo', true)
    .maybeSingle()
  if (!clinica) return { error: 'Escolha uma das clínicas cadastradas.' }

  const { error: errAnterior } = await admin
    .from('admission_exams')
    .update({ status: 'substituido' })
    .eq('employee_id', employeeId)
    .eq('company_id', companyId)
    .eq('status', 'encaminhado')
  if (errAnterior) return { error: errAnterior.message }

  const orientacoes = d.orientacoes || null
  const { data: exame, error } = await admin
    .from('admission_exams')
    .insert({
      company_id: companyId,
      employee_id: employeeId,
      application_id: emp.applicationId,
      clinic_id: clinica.id,
      clinica_nome: clinica.nome,
      clinica_endereco: clinica.endereco,
      clinica_telefone: clinica.telefone,
      data_hora: dataHora,
      orientacoes,
      created_by: user.id,
    })
    .select('id')
    .single()
  if (error || !exame) return { error: error?.message ?? 'Não foi possível registrar o encaminhamento.' }

  // E-mail: falha no envio não desfaz o encaminhamento; a tela avisa para combinar por outro meio
  const config = await getConfigAdmissao(companyId)
  let email: 'enviado' | 'falhou' | 'desligado' | 'sem_email' = 'desligado'
  if (config.exame_notificar) {
    if (!emp.email) email = 'sem_email'
    else {
      const guia = clinica.guia_path
        ? await baixarGuia(admin, clinica.guia_path as string, clinica.guia_nome as string | null)
        : await baixarGuia(admin, config.exame_guia_path, config.exame_guia_nome)
      const envio = await avisarExame({
        companyId,
        assunto: config.exame_assunto,
        modelo: config.exame_modelo,
        nome: emp.nome,
        email: emp.email,
        vagaTitulo: emp.vagaTitulo,
        cargo: emp.cargo,
        clinica: { nome: clinica.nome as string, endereco: clinica.endereco as string | null, telefone: clinica.telefone as string | null },
        dataHora,
        orientacoes,
        guia,
      })
      email = envio.status === 'enviado' ? 'enviado' : 'falhou'
      if (email === 'enviado') await admin.from('admission_exams').update({ email_enviado: true }).eq('id', exame.id)
    }
  }

  // Encaminhado: o card segue para o registro do resultado
  if (!reencaminhando) {
    const { error: errEtapa } = await admin
      .from('employees')
      .update({ admission_stage: ETAPA_RESULTADO_EXAME })
      .eq('id', employeeId)
      .eq('company_id', companyId)
    if (errEtapa) return { error: errEtapa.message }
  }

  const quando = dataHora ? `para ${fmtDataHora(dataHora)}` : 'por ordem de chegada'
  await registrarAnotacao(admin, {
    companyId, employeeId, applicationId: emp.applicationId, autorId: user.id,
    texto: `${reencaminhando ? 'Reencaminhado' : 'Encaminhado'} para exame na ${clinica.nome}, ${quando}.${email === 'enviado' ? ' Candidato avisado por e-mail.' : ''}`,
  })
  revalidatePath('/pessoas/admissao')
  return { success: true as const, email, reencaminhando }
}

/**
 * Resultado do exame, com o ASO (obrigatório para apto).
 * Apto: o ASO vira o "Exame Admissional" do funcionário e o card segue para a contabilidade.
 * Inapto: novo exame (volta para o encaminhamento) ou reprovação, com o e-mail da reprovação no exame.
 */
export async function registrarResultadoExameAction(companyId: string, employeeId: string, formData: FormData) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin, user } = auth

  const parsed = resultadoExameSchema.safeParse({
    resultado: formData.get('resultado') || undefined,
    data: formData.get('data') ?? '',
    observacoes: formData.get('observacoes') ?? '',
    decisao: formData.get('decisao') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const d = parsed.data
  const apto = d.resultado === 'apto'

  const aso = formData.get('aso') as File | null
  const temAso = !!aso && aso.size > 0
  if (apto && !temAso) return { error: 'Anexe o ASO para registrar o resultado apto.' }
  if (temAso && !GUIA_TIPOS.includes(aso.type)) return { error: 'O ASO precisa ser PDF, JPG ou PNG.' }
  if (temAso && aso.size > ASO_MAX_BYTES) return { error: 'O ASO pode ter até 10 MB.' }

  const emp = await buscarEmAdmissao(admin, employeeId, companyId)
  if (!emp) return { error: FORA_DO_KANBAN }
  if (emp.admission_stage !== ETAPA_RESULTADO_EXAME) return { error: 'Este candidato não está na etapa do resultado do exame.' }

  const { data: exame } = await admin
    .from('admission_exams')
    .select('id, clinica_nome')
    .eq('employee_id', employeeId)
    .eq('company_id', companyId)
    .eq('status', 'encaminhado')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!exame) return { error: 'Não há encaminhamento para exame aguardando resultado.' }

  let asoPath: string | null = null
  if (temAso) {
    const ext = aso.name.split('.').pop()?.toLowerCase() || 'pdf'
    asoPath = `funcionarios/${companyId}/${employeeId}/exame_admissional_${Date.now()}.${ext}`
    const { error } = await admin.storage.from('documentos').upload(asoPath, await aso.arrayBuffer(), { contentType: aso.type })
    if (error) return { error: `Não foi possível enviar o ASO: ${error.message}` }
  }

  const autorNome = await nomeDe(admin, user.id)
  const { error: errExame } = await admin
    .from('admission_exams')
    .update({
      status: 'realizado',
      realizado_em: new Date(`${d.data}T12:00:00-03:00`).toISOString(),
      resultado: d.resultado,
      resultado_data: d.data,
      resultado_observacoes: d.observacoes || null,
      aso_path: asoPath,
      resultado_por: autorNome,
      resultado_em: new Date().toISOString(),
    })
    .eq('id', exame.id)
  if (errExame) {
    if (asoPath) await admin.storage.from('documentos').remove([asoPath])
    return { error: errExame.message }
  }

  const obs = d.observacoes ? ` Observações: ${d.observacoes}` : ''

  if (apto) {
    const { data: ficha } = await admin.from('employees').select('doc_exame_admissional_path').eq('id', employeeId).maybeSingle()
    await registrarAnotacao(admin, {
      companyId, employeeId, applicationId: emp.applicationId, autorId: user.id,
      texto: `Apto no exame admissional (${exame.clinica_nome}).${obs}`,
    })
    const r = await seguirEtapa(admin, {
      companyId, employeeId, de: ETAPA_RESULTADO_EXAME, autor: { id: user.id, nome: autorNome },
      campos: { doc_exame_admissional_path: asoPath },
    })
    if ('error' in r) return { error: r.error }
    // ASO anterior do cadastro (ex.: enviado à mão) deixa de ser usado
    const anterior = ficha?.doc_exame_admissional_path as string | null | undefined
    if (anterior && anterior !== asoPath) await admin.storage.from('documentos').remove([anterior])

    revalidar()
    return { ...r, proxima: labelEtapa(await getEtapasAdmissao(companyId), r.proxima), resultado: 'apto' as const }
  }

  if (d.decisao === 'novo_exame') {
    const { error } = await admin
      .from('employees')
      .update({ admission_stage: ETAPA_EXAME })
      .eq('id', employeeId)
      .eq('company_id', companyId)
    if (error) return { error: error.message }
    await registrarAnotacao(admin, {
      companyId, employeeId, applicationId: emp.applicationId, autorId: user.id,
      texto: `Inapto no exame admissional (${exame.clinica_nome}). Novo exame solicitado.${obs}`,
    })
    revalidatePath('/pessoas/admissao')
    return { success: true as const, resultado: 'novo_exame' as const }
  }

  // Reprovado no exame: mesmo caminho da reprovação, com o e-mail próprio das configurações
  const r = await removerDaAdmissao(admin, {
    employeeId,
    companyId,
    statusCandidatura: 'reprovada',
    motivo: 'Inapto no exame admissional',
    texto: `Inapto no exame admissional (${exame.clinica_nome}). Reprovado.${obs}`,
    autorId: user.id,
    autorNome,
  })
  if (r.error) return { error: r.error }

  const config = await getConfigAdmissao(companyId)
  let avisoFalhou = false
  if (config.exame_reprovacao_notificar && emp.email) {
    const envio = await avisarReprovacao({
      companyId,
      assunto: config.exame_reprovacao_assunto,
      modelo: config.exame_reprovacao_modelo,
      nome: emp.nome,
      email: emp.email,
      vagaTitulo: emp.vagaTitulo,
      cargo: emp.cargo,
    })
    avisoFalhou = envio.status !== 'enviado'
  }
  revalidar()
  return { success: true as const, resultado: 'reprovado' as const, avisoFalhou }
}

/** Abre o ASO de um exame da empresa */
export async function getAsoUrlAction(companyId: string, exameId: string) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { data } = await auth.admin.from('admission_exams').select('aso_path').eq('id', exameId).eq('company_id', companyId).maybeSingle()
  if (!data?.aso_path) return { error: 'Arquivo não encontrado.' }
  const { data: url } = await auth.admin.storage.from('documentos').createSignedUrl(data.aso_path as string, 300)
  if (!url) return { error: 'Não foi possível abrir o ASO.' }
  return { url: url.signedUrl }
}

export async function adicionarAnotacaoAction(companyId: string, employeeId: string, texto: string) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin, user } = auth

  const limpo = texto.trim().slice(0, 5000)
  if (!limpo) return { error: 'Escreva a anotação.' }

  const emp = await buscarEmAdmissao(admin, employeeId, companyId)
  if (!emp) return { error: FORA_DO_KANBAN }

  const { error } = await registrarAnotacao(admin, { companyId, employeeId, applicationId: emp.applicationId, autorId: user.id, texto: limpo, tipo: 'anotacao' })
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

  await registrarAnotacao(admin, { companyId, employeeId, applicationId: emp.applicationId, autorId: user.id, texto: 'Aprovado na entrevista.' })
  const r = await seguirEtapa(admin, { companyId, employeeId, de: ETAPA_INICIAL, autor: await autorDe(admin, user.id), campos: { admissao_em_espera: false } })
  if ('error' in r) return { error: r.error }

  await cancelarEntrevistasFuturas(admin, employeeId, companyId)
  revalidar()
  return { ...r, proxima: labelEtapa(await getEtapasAdmissao(companyId), r.proxima) }
}

/** Reprovado: a candidatura volta para a vaga e o cadastro em admissão é apagado (ver removerDaAdmissao) */
export async function reprovarAdmissaoAction(employeeId: string, companyId: string, motivo?: string) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin, user } = auth

  // Lido antes: o cadastro é apagado na reprovação
  const emp = await buscarEmAdmissao(admin, employeeId, companyId)
  const { data: ficha } = await admin.from('employees').select('cargo').eq('id', employeeId).eq('company_id', companyId).maybeSingle()

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

  // Configuração ligada: o aviso sai direto; falha no e-mail não desfaz a reprovação
  const config = await getConfigAdmissao(companyId)
  let avisoFalhou = false
  if (config.reprovacao_notificar && emp?.email) {
    const envio = await avisarReprovacao({
      companyId,
      assunto: config.reprovacao_assunto,
      modelo: config.reprovacao_modelo,
      nome: emp.nome,
      email: emp.email,
      vagaTitulo: emp.vagaTitulo,
      cargo: (ficha?.cargo as string | null) ?? null,
    })
    avisoFalhou = envio.status !== 'enviado'
  }

  revalidar()
  return { success: true as const, avisoFalhou }
}

// ── Contabilidade e contrato ─────────────────────────────────────────────────

/** A ficha foi enviada à contabilidade (por fora do sistema): o card passa a aguardar o retorno */
export async function registrarEnvioContabilidadeAction(companyId: string, employeeId: string) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin, user } = auth

  const emp = await buscarEmAdmissao(admin, employeeId, companyId)
  if (!emp) return { error: FORA_DO_KANBAN }
  if (emp.admission_stage !== ETAPA_CONTABILIDADE) return { error: 'Este candidato não está na etapa de envio para a contabilidade.' }

  const autorNome = await nomeDe(admin, user.id)
  const { error } = await admin
    .from('employees')
    .update({
      admission_stage: ETAPA_AGUARDAR_CONTABILIDADE,
      admissao_contabilidade_enviada_em: new Date().toISOString(),
      admissao_contabilidade_enviada_por: autorNome,
      admissao_contabilidade_retorno_em: null,
    })
    .eq('id', employeeId)
    .eq('company_id', companyId)
  if (error) return { error: error.message }

  await registrarAnotacao(admin, { companyId, employeeId, applicationId: emp.applicationId, autorId: user.id, texto: 'Ficha enviada à contabilidade.' })
  revalidatePath('/pessoas/admissao')
  return { success: true as const }
}

/** A contabilidade respondeu: segue para a assinatura do contrato */
export async function registrarRetornoContabilidadeAction(companyId: string, employeeId: string) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin, user } = auth

  const emp = await buscarEmAdmissao(admin, employeeId, companyId)
  if (!emp) return { error: FORA_DO_KANBAN }
  if (emp.admission_stage !== ETAPA_AGUARDAR_CONTABILIDADE) return { error: 'Este candidato não está aguardando o retorno da contabilidade.' }

  await registrarAnotacao(admin, { companyId, employeeId, applicationId: emp.applicationId, autorId: user.id, texto: 'Retorno da contabilidade recebido.' })
  const r = await seguirEtapa(admin, {
    companyId, employeeId, de: ETAPA_AGUARDAR_CONTABILIDADE, autor: await autorDe(admin, user.id),
    campos: { admissao_contabilidade_retorno_em: new Date().toISOString() },
  })
  if ('error' in r) return { error: r.error }
  revalidar()
  return { ...r, proxima: labelEtapa(await getEtapasAdmissao(companyId), r.proxima) }
}

/**
 * Contrato assinado anexado, com a data de admissão: segue para a próxima etapa ativa ou, sendo a última,
 * a pessoa entra na Equipe (ver lib/admissao-concluir.ts).
 */
export async function finalizarAdmissaoAction(companyId: string, employeeId: string, formData: FormData) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin, user } = auth

  const dataAdmissao = String(formData.get('data_admissao') ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataAdmissao)) return { error: 'Informe a data de admissão.' }
  const contrato = formData.get('contrato') as File | null
  if (!contrato || contrato.size === 0) return { error: 'Anexe o contrato assinado.' }
  if (!GUIA_TIPOS.includes(contrato.type)) return { error: 'O contrato precisa ser PDF, JPG ou PNG.' }
  if (contrato.size > CONTRATO_MAX_BYTES) return { error: 'O contrato pode ter até 20 MB.' }

  const { data: emp } = await admin
    .from('employees')
    // '*': doc_contrato_path pode ainda não existir (migration 20261106000084)
    .select('*')
    .eq('id', employeeId)
    .eq('company_id', companyId)
    .eq('status', 'admissao')
    .maybeSingle()
  if (!emp) return { error: FORA_DO_KANBAN }
  if (emp.admission_stage !== ETAPA_CONTRATO) return { error: 'Abra a ficha de admissão: a admissão termina na etapa "Assinar contrato".' }

  const ext = contrato.name.split('.').pop()?.toLowerCase() || 'pdf'
  const contratoPath = `funcionarios/${companyId}/${employeeId}/contrato_${Date.now()}.${ext}`
  const { error: errUpload } = await admin.storage.from('documentos').upload(contratoPath, await contrato.arrayBuffer(), { contentType: contrato.type })
  if (errUpload) return { error: `Não foi possível enviar o contrato: ${errUpload.message}` }

  const { data: cand } = await admin.from('job_applications').select('id').eq('employee_id', employeeId).eq('company_id', companyId).maybeSingle()
  await registrarAnotacao(admin, {
    companyId, employeeId, applicationId: (cand?.id as string | undefined) ?? null, autorId: user.id,
    texto: `Contrato assinado anexado. Data de admissão: ${dataAdmissao.split('-').reverse().join('/')}.`,
  })
  const r = await seguirEtapa(admin, {
    companyId, employeeId, de: ETAPA_CONTRATO, autor: await autorDe(admin, user.id),
    campos: { data_admissao: dataAdmissao, doc_contrato_path: contratoPath },
    dataAdmissao,
  })
  if ('error' in r) {
    await admin.storage.from('documentos').remove([contratoPath])
    return { error: r.error }
  }
  // Contrato anterior (ex.: enviado à mão nos dados cadastrais) deixa de ser usado
  if (emp.doc_contrato_path && emp.doc_contrato_path !== contratoPath) await admin.storage.from('documentos').remove([emp.doc_contrato_path as string])

  revalidar()
  return { ...r, proxima: labelEtapa(await getEtapasAdmissao(companyId), r.proxima) }
}
