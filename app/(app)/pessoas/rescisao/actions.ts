'use server'

import { revalidatePath } from 'next/cache'
import { requireGestor } from '@/lib/auth/gestor'
import type { createAdminClient } from '@/lib/supabase/server'
import { avisarExame } from '@/lib/admissao-email'
import { anotarRescisao, seguirEtapaRescisao, type Autor } from '@/lib/rescisao-fluxo'
import { ASO_MAX_BYTES, CONTRATO_MAX_BYTES, GUIA_TIPOS, entrevistaParaIso, exameSchema, fmtDataHora } from '@/lib/validations/admissao'
import { avisoPrevioSchema, iniciarRescisaoSchema, retornoExameSchema } from '@/lib/validations/rescisao'
import { getConfigAdmissao } from '../admissao/queries'
import { isPjOuAutonomo } from '../funcionarios/components/ficha/ficha-config'
import {
  R_AGUARDAR_CONTABILIDADE, R_AVISO, R_CONTABILIDADE, R_EXAME, R_FINAL, R_RETORNO_EXAME, R_TRCT,
  indiceEtapa, isPersonalizada, labelEtapa, modalidadeAvisoLabel, primeiraEtapaRescisao, tipoDesligamentoLabel,
} from './etapas'
import { getConfigRescisao, getEtapasRescisao } from './queries'

type Admin = ReturnType<typeof createAdminClient>

const FORA = 'Esta rescisão não está mais em andamento.'
const fmtData = (d: string) => d.split('-').reverse().join('/')

function revalidar(id?: string) {
  revalidatePath('/pessoas/rescisao')
  if (id) revalidatePath(`/pessoas/rescisao/${id}`)
  revalidatePath('/pessoas/funcionarios', 'layout')
}

async function autorDe(admin: Admin, profileId: string): Promise<Autor> {
  const { data } = await admin.from('profiles').select('name').eq('id', profileId).maybeSingle()
  return { id: profileId, nome: (data?.name as string | undefined) || 'Usuário' }
}

/** Rescisão em andamento desta empresa, com quem está saindo */
async function buscar(admin: Admin, companyId: string, id: string) {
  const { data } = await admin
    .from('employee_terminations')
    .select('id, etapa, employee_id, employee:employee_id(nome, email, cargo, tipo_contrato)')
    .eq('id', id)
    .eq('company_id', companyId)
    .eq('status', 'em_andamento')
    .maybeSingle()
  if (!data) return null
  const emp = data.employee as unknown as { nome: string; email: string | null; cargo: string | null; tipo_contrato: string | null }
  return { id: data.id as string, etapa: data.etapa as string, employeeId: data.employee_id as string, ...emp, pj: isPjOuAutonomo(emp.tipo_contrato) }
}

/** Resultado de uma etapa concluída, com o nome da próxima para a tela */
async function seguir(admin: Admin, companyId: string, r: NonNullable<Awaited<ReturnType<typeof buscar>>>, autor: Autor, de: string, campos?: Record<string, unknown>, dataDesligamento?: string) {
  const res = await seguirEtapaRescisao(admin, { companyId, rescisaoId: r.id, de, pj: r.pj, autor, campos, dataDesligamento })
  if ('error' in res) return { error: res.error }
  revalidar(r.id)
  return { ...res, proxima: labelEtapa(await getEtapasRescisao(companyId), res.proxima) }
}

// ── Início, cancelamento e kanban ────────────────────────────────────────────

/** "Iniciar rescisão" na ficha do funcionário: a pessoa segue na Equipe até finalizar */
export async function iniciarRescisaoAction(companyId: string, employeeId: string, data: unknown) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin, user } = auth

  const parsed = iniciarRescisaoSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { data: emp } = await admin.from('employees').select('id, status, tipo_contrato').eq('id', employeeId).eq('company_id', companyId).maybeSingle()
  if (!emp) return { error: 'Funcionário não encontrado.' }
  if (['admissao', 'inativo', 'demitido'].includes(emp.status as string)) return { error: 'Só quem está na Equipe pode ter a rescisão iniciada.' }

  const etapas = await getEtapasRescisao(companyId)
  const { data: criada, error } = await admin
    .from('employee_terminations')
    .insert({
      company_id: companyId,
      employee_id: employeeId,
      etapa: primeiraEtapaRescisao(etapas, isPjOuAutonomo(emp.tipo_contrato as string | null)),
      tipo: parsed.data.tipo,
      motivo: parsed.data.motivo || null,
      iniciada_por: user.id,
    })
    .select('id')
    .single()
  if (error) {
    // Índice único: só um processo em andamento por pessoa
    if (error.code === '23505') return { error: 'Já existe uma rescisão em andamento para esta pessoa.' }
    return { error: error.message }
  }

  await anotarRescisao(admin, {
    companyId, rescisaoId: criada.id, autor: await autorDe(admin, user.id),
    texto: `Rescisão iniciada: ${tipoDesligamentoLabel(parsed.data.tipo)}.${parsed.data.motivo ? ` Motivo: ${parsed.data.motivo}` : ''}`,
  })
  revalidar(criada.id)
  return { success: true as const, id: criada.id as string }
}

/** Desistência (ex.: pedido de demissão reconsiderado): o processo fica guardado como cancelado */
export async function cancelarRescisaoAction(companyId: string, id: string, motivo?: string) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin, user } = auth

  const r = await buscar(admin, companyId, id)
  if (!r) return { error: FORA }
  const limpo = motivo?.trim().slice(0, 1000) || null
  const { error } = await admin
    .from('employee_terminations')
    .update({ status: 'cancelada', cancelada_motivo: limpo, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }

  await anotarRescisao(admin, { companyId, rescisaoId: id, autor: await autorDe(admin, user.id), texto: limpo ? `Rescisão cancelada. Motivo: ${limpo}` : 'Rescisão cancelada.' })
  revalidar(id)
  return { success: true as const }
}

/** Arrastando no kanban, só para trás: para frente, cada etapa avança pela ação dela na ficha */
export async function moverEtapaRescisaoAction(companyId: string, id: string, etapa: string) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin, user } = auth

  const etapas = await getEtapasRescisao(companyId)
  const destino = etapas.find((e) => e.key === etapa)
  if (!destino || etapa === R_FINAL) return { error: 'Etapa inválida.' }
  if (!destino.ativo) return { error: 'Esta etapa está inativa nas configurações.' }

  const r = await buscar(admin, companyId, id)
  if (!r) return { error: FORA }
  if (indiceEtapa(etapas, etapa) > indiceEtapa(etapas, r.etapa)) return { error: 'Abra a ficha da rescisão: cada etapa avança pela ação dela.' }

  const { error } = await admin.from('employee_terminations').update({ etapa, updated_at: new Date().toISOString() }).eq('id', id).eq('etapa', r.etapa)
  if (error) return { error: error.message }
  await anotarRescisao(admin, { companyId, rescisaoId: id, autor: await autorDe(admin, user.id), texto: `Movido para "${destino.label}".` })
  revalidar(id)
  return { success: true as const }
}

export async function adicionarAnotacaoRescisaoAction(companyId: string, id: string, texto: string) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const limpo = texto.trim().slice(0, 5000)
  if (!limpo) return { error: 'Escreva a anotação.' }
  const { data: existe } = await auth.admin.from('employee_terminations').select('id').eq('id', id).eq('company_id', companyId).maybeSingle()
  if (!existe) return { error: 'Rescisão não encontrada.' }
  const { error } = await anotarRescisao(auth.admin, { companyId, rescisaoId: id, autor: await autorDe(auth.admin, auth.user.id), texto: limpo, tipo: 'anotacao' })
  if (error) return { error: error.message }
  revalidar(id)
  return { success: true as const }
}

// ── Aviso prévio ─────────────────────────────────────────────────────────────

export async function registrarAvisoPrevioAction(companyId: string, id: string, data: unknown) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin, user } = auth

  const parsed = avisoPrevioSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const d = parsed.data

  const r = await buscar(admin, companyId, id)
  if (!r) return { error: FORA }
  if (r.etapa !== R_AVISO) return { error: 'Esta rescisão não está na etapa do aviso prévio.' }

  const autor = await autorDe(admin, user.id)
  await anotarRescisao(admin, {
    companyId, rescisaoId: id, autor,
    texto: `Aviso prévio ${modalidadeAvisoLabel(d.modalidade).toLowerCase()}: comunicado em ${fmtData(d.comunicacao)}, ${d.dias} dias, último dia ${fmtData(d.ultimo_dia)}.`,
  })
  return seguir(admin, companyId, r, autor, R_AVISO, {
    aviso_modalidade: d.modalidade,
    aviso_comunicacao: d.comunicacao,
    aviso_dias: Number(d.dias),
    ultimo_dia: d.ultimo_dia,
  })
}

// ── Exame demissional ────────────────────────────────────────────────────────

async function baixarGuia(admin: Admin, path: string | null, nome: string | null) {
  if (!path) return null
  const { data, error } = await admin.storage.from('documentos').download(path)
  if (error || !data) { console.error('[rescisão] guia indisponível:', error?.message); return null }
  return { filename: nome || `guia-de-encaminhamento.${path.split('.').pop()}`, content: Buffer.from(await data.arrayBuffer()) }
}

/** Encaminha para o exame demissional (clínicas da admissão); encaminhado, segue para o retorno */
export async function encaminharExameRescisaoAction(companyId: string, id: string, data: unknown) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin, user } = auth

  const parsed = exameSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const d = parsed.data
  const dataHora = d.data ? entrevistaParaIso(d.data, d.hora) : null
  if (dataHora && (Number.isNaN(Date.parse(dataHora)) || Date.parse(dataHora) <= Date.now())) return { error: 'Escolha uma data e hora futuras.' }

  const r = await buscar(admin, companyId, id)
  if (!r) return { error: FORA }
  const reencaminhando = r.etapa === R_RETORNO_EXAME
  if (r.etapa !== R_EXAME && !reencaminhando) return { error: 'Esta rescisão não está na etapa do exame.' }

  const { data: clinica } = await admin
    .from('admission_clinics')
    .select('id, nome, endereco, telefone, guia_path, guia_nome')
    .eq('id', d.clinic_id).eq('company_id', companyId).eq('ativo', true)
    .maybeSingle()
  if (!clinica) return { error: 'Escolha uma das clínicas cadastradas.' }

  const { error: errAnterior } = await admin.from('termination_exams').update({ status: 'substituido' }).eq('termination_id', id).eq('status', 'encaminhado')
  if (errAnterior) return { error: errAnterior.message }

  const orientacoes = d.orientacoes || null
  const { data: exame, error } = await admin
    .from('termination_exams')
    .insert({
      company_id: companyId,
      termination_id: id,
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

  // E-mail com o texto da rescisão e a guia da clínica (ou a geral da admissão); falha não desfaz o encaminhamento
  const config = await getConfigRescisao(companyId)
  let email: 'enviado' | 'falhou' | 'desligado' | 'sem_email' = 'desligado'
  if (config.exame_notificar) {
    if (!r.email) email = 'sem_email'
    else {
      const geral = await getConfigAdmissao(companyId)
      const guia = clinica.guia_path
        ? await baixarGuia(admin, clinica.guia_path as string, clinica.guia_nome as string | null)
        : await baixarGuia(admin, geral.exame_guia_path, geral.exame_guia_nome)
      const envio = await avisarExame({
        companyId,
        assunto: config.exame_assunto,
        modelo: config.exame_modelo,
        nome: r.nome,
        email: r.email,
        vagaTitulo: null,
        cargo: r.cargo,
        clinica: { nome: clinica.nome as string, endereco: clinica.endereco as string | null, telefone: clinica.telefone as string | null },
        dataHora,
        orientacoes,
        guia,
      })
      email = envio.status === 'enviado' ? 'enviado' : 'falhou'
      if (email === 'enviado') await admin.from('termination_exams').update({ email_enviado: true }).eq('id', exame.id)
    }
  }

  if (!reencaminhando) {
    const { error: errEtapa } = await admin.from('employee_terminations').update({ etapa: R_RETORNO_EXAME, updated_at: new Date().toISOString() }).eq('id', id)
    if (errEtapa) return { error: errEtapa.message }
  }

  const quando = dataHora ? `para ${fmtDataHora(dataHora)}` : 'por ordem de chegada'
  await anotarRescisao(admin, {
    companyId, rescisaoId: id, autor: await autorDe(admin, user.id),
    texto: `${reencaminhando ? 'Reencaminhado' : 'Encaminhado'} para exame demissional na ${clinica.nome}, ${quando}.${email === 'enviado' ? ' Avisado por e-mail.' : ''}`,
  })
  revalidar(id)
  return { success: true as const, email, reencaminhando }
}

/** Retorno do exame demissional: o ASO vira o "Exame Demissional" do funcionário e a rescisão segue */
export async function registrarRetornoExameRescisaoAction(companyId: string, id: string, formData: FormData) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin, user } = auth

  const parsed = retornoExameSchema.safeParse({
    resultado: formData.get('resultado') || undefined,
    data: formData.get('data') ?? '',
    observacoes: formData.get('observacoes') ?? '',
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const d = parsed.data

  const aso = formData.get('aso') as File | null
  if (!aso || aso.size === 0) return { error: 'Anexe o ASO demissional.' }
  if (!GUIA_TIPOS.includes(aso.type)) return { error: 'O ASO precisa ser PDF, JPG ou PNG.' }
  if (aso.size > ASO_MAX_BYTES) return { error: 'O ASO pode ter até 10 MB.' }

  const r = await buscar(admin, companyId, id)
  if (!r) return { error: FORA }
  if (r.etapa !== R_RETORNO_EXAME) return { error: 'Esta rescisão não está na etapa do retorno do exame.' }

  const { data: exame } = await admin
    .from('termination_exams').select('id, clinica_nome')
    .eq('termination_id', id).eq('status', 'encaminhado')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!exame) return { error: 'Não há encaminhamento para exame aguardando retorno.' }

  const ext = aso.name.split('.').pop()?.toLowerCase() || 'pdf'
  const asoPath = `funcionarios/${companyId}/${r.employeeId}/exame_demissional_${Date.now()}.${ext}`
  const { error: errUp } = await admin.storage.from('documentos').upload(asoPath, await aso.arrayBuffer(), { contentType: aso.type })
  if (errUp) return { error: `Não foi possível enviar o ASO: ${errUp.message}` }

  const autor = await autorDe(admin, user.id)
  const { error: errExame } = await admin
    .from('termination_exams')
    .update({ status: 'realizado', resultado: d.resultado, resultado_data: d.data, resultado_observacoes: d.observacoes || null, aso_path: asoPath, resultado_por: autor.nome })
    .eq('id', exame.id)
  if (errExame) {
    await admin.storage.from('documentos').remove([asoPath])
    return { error: errExame.message }
  }

  const { data: ficha } = await admin.from('employees').select('doc_exame_demissional_path').eq('id', r.employeeId).maybeSingle()
  await admin.from('employees').update({ doc_exame_demissional_path: asoPath }).eq('id', r.employeeId)
  const anterior = ficha?.doc_exame_demissional_path as string | null | undefined
  if (anterior && anterior !== asoPath) await admin.storage.from('documentos').remove([anterior])

  await anotarRescisao(admin, {
    companyId, rescisaoId: id, autor,
    texto: `Exame demissional realizado em ${fmtData(d.data)} (${exame.clinica_nome}): ${d.resultado === 'apto' ? 'apto' : 'inapto'}.${d.observacoes ? ` Observações: ${d.observacoes}` : ''}`,
  })
  return seguir(admin, companyId, r, autor, R_RETORNO_EXAME)
}

export async function getAsoRescisaoUrlAction(companyId: string, exameId: string) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { data } = await auth.admin.from('termination_exams').select('aso_path').eq('id', exameId).eq('company_id', companyId).maybeSingle()
  if (!data?.aso_path) return { error: 'Arquivo não encontrado.' }
  const { data: url } = await auth.admin.storage.from('documentos').createSignedUrl(data.aso_path as string, 300)
  if (!url) return { error: 'Não foi possível abrir o ASO.' }
  return { url: url.signedUrl }
}

// ── Contabilidade ────────────────────────────────────────────────────────────

export async function registrarEnvioContabilidadeRescisaoAction(companyId: string, id: string) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin, user } = auth

  const r = await buscar(admin, companyId, id)
  if (!r) return { error: FORA }
  if (r.etapa !== R_CONTABILIDADE) return { error: 'Esta rescisão não está na etapa de envio para a contabilidade.' }

  const autor = await autorDe(admin, user.id)
  const { error } = await admin
    .from('employee_terminations')
    .update({ etapa: R_AGUARDAR_CONTABILIDADE, contabilidade_enviada_em: new Date().toISOString(), contabilidade_enviada_por: autor.nome, contabilidade_retorno_em: null, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  await anotarRescisao(admin, { companyId, rescisaoId: id, autor, texto: 'Dados enviados à contabilidade.' })
  revalidar(id)
  return { success: true as const }
}

export async function registrarRetornoContabilidadeRescisaoAction(companyId: string, id: string) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin, user } = auth

  const r = await buscar(admin, companyId, id)
  if (!r) return { error: FORA }
  if (r.etapa !== R_AGUARDAR_CONTABILIDADE) return { error: 'Esta rescisão não está aguardando o retorno da contabilidade.' }

  const autor = await autorDe(admin, user.id)
  await anotarRescisao(admin, { companyId, rescisaoId: id, autor, texto: 'Retorno da contabilidade recebido.' })
  return seguir(admin, companyId, r, autor, R_AGUARDAR_CONTABILIDADE, { contabilidade_retorno_em: new Date().toISOString() })
}

// ── TRCT ─────────────────────────────────────────────────────────────────────

/** TRCT assinado anexado, com a data do desligamento: vira o "TRCT assinado" do funcionário */
export async function assinarTrctAction(companyId: string, id: string, formData: FormData) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin, user } = auth

  const data = String(formData.get('data_desligamento') ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { error: 'Informe a data do desligamento.' }
  const trct = formData.get('trct') as File | null
  if (!trct || trct.size === 0) return { error: 'Anexe o TRCT assinado.' }
  if (!GUIA_TIPOS.includes(trct.type)) return { error: 'O TRCT precisa ser PDF, JPG ou PNG.' }
  if (trct.size > CONTRATO_MAX_BYTES) return { error: 'O TRCT pode ter até 20 MB.' }

  const r = await buscar(admin, companyId, id)
  if (!r) return { error: FORA }
  if (r.etapa !== R_TRCT) return { error: 'Esta rescisão não está na etapa do TRCT.' }

  const ext = trct.name.split('.').pop()?.toLowerCase() || 'pdf'
  const path = `funcionarios/${companyId}/${r.employeeId}/trct_${Date.now()}.${ext}`
  const { error: errUp } = await admin.storage.from('documentos').upload(path, await trct.arrayBuffer(), { contentType: trct.type })
  if (errUp) return { error: `Não foi possível enviar o TRCT: ${errUp.message}` }

  const autor = await autorDe(admin, user.id)
  await anotarRescisao(admin, { companyId, rescisaoId: id, autor, texto: `TRCT assinado anexado. Desligamento em ${fmtData(data)}.` })
  const res = await seguir(admin, companyId, r, autor, R_TRCT, { trct_path: path, data_desligamento: data }, data)
  if ('error' in res) {
    await admin.storage.from('documentos').remove([path])
    return res
  }
  const { data: ficha } = await admin.from('employees').select('doc_trct_path').eq('id', r.employeeId).maybeSingle()
  await admin.from('employees').update({ doc_trct_path: path }).eq('id', r.employeeId)
  const anterior = ficha?.doc_trct_path as string | null | undefined
  if (anterior && anterior !== path) await admin.storage.from('documentos').remove([anterior])
  return res
}

// ── Etapa personalizada ──────────────────────────────────────────────────────

export async function avancarEtapaPersonalizadaRescisaoAction(companyId: string, id: string, anotacao?: string, dataDesligamento?: string) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin, user } = auth
  if (dataDesligamento && !/^\d{4}-\d{2}-\d{2}$/.test(dataDesligamento)) return { error: 'Data do desligamento inválida.' }

  const r = await buscar(admin, companyId, id)
  if (!r) return { error: FORA }
  if (!isPersonalizada(r.etapa)) return { error: 'Esta etapa avança pela ação dela na ficha.' }

  const autor = await autorDe(admin, user.id)
  const etapas = await getEtapasRescisao(companyId)
  const limpo = anotacao?.trim().slice(0, 5000)
  if (limpo) await anotarRescisao(admin, { companyId, rescisaoId: id, autor, texto: limpo, tipo: 'anotacao' })
  await anotarRescisao(admin, { companyId, rescisaoId: id, autor, texto: `"${labelEtapa(etapas, r.etapa)}" concluída.` })
  return seguir(admin, companyId, r, autor, r.etapa, undefined, dataDesligamento)
}
