'use server'

import { revalidatePath } from 'next/cache'
import { requireGestor as autorizar } from '@/lib/auth/gestor'
import { vagaSchema } from '@/lib/validations/vaga'
import { ETAPA_INICIAL } from '../admissao/etapas'
import { getHistoricoCandidatura } from '../admissao/queries'
import { isPjOuAutonomo, maskCpf } from '../funcionarios/components/ficha/ficha-config'
import { avisarProcessoEncerrado } from '@/lib/vagas-email'
import { normalizarValor } from '../funcionarios/components/ficha/ficha-config'

const BUCKET = 'documentos'

function revalidar(vagaId?: string) {
  revalidatePath('/pessoas/vagas')
  if (vagaId) revalidatePath(`/pessoas/vagas/${vagaId}`)
}

export async function salvarVagaAction(companyId: string, vagaId: string | null, data: unknown) {
  const auth = await autorizar(companyId)
  if ('error' in auth) return { error: auth.error }
  const { user, admin } = auth

  const parsed = vagaSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { benefit_ids, ...d } = parsed.data

  const campos = {
    titulo: d.titulo,
    descricao: d.descricao || null,
    cargo: d.cargo || null,
    departamento: d.departamento || null,
    local_trabalho: d.local_trabalho || null,
    tipo_contrato: d.tipo_contrato,
    salario: d.salario ? Number(normalizarValor(d.salario)) : null,
    exibir_salario: d.exibir_salario,
    posicoes: Number(d.posicoes),
    data_limite: d.data_limite || null,
    updated_at: new Date().toISOString(),
  }

  // Benefícios só do catálogo desta empresa
  const { data: catalogo } = benefit_ids.length
    ? await admin.from('company_benefits').select('id').eq('company_id', companyId).in('id', benefit_ids)
    : { data: [] as { id: string }[] }

  let id = vagaId
  if (id) {
    const { data: atualizada, error } = await admin
      .from('job_openings')
      .update(campos)
      .eq('id', id)
      .eq('company_id', companyId)
      .neq('status', 'encerrada')
      .select('id')
      .maybeSingle()
    if (error) return { error: error.message }
    if (!atualizada) return { error: 'Vaga não encontrada ou já encerrada.' }
  } else {
    const { data: criada, error } = await admin
      .from('job_openings')
      .insert({ ...campos, company_id: companyId, created_by: user.id })
      .select('id')
      .single()
    if (error) return { error: error.message }
    id = criada.id as string
  }

  const { error: errDel } = await admin.from('job_opening_benefits').delete().eq('vaga_id', id)
  if (errDel) return { error: `Vaga salva, mas os benefícios não foram atualizados: ${errDel.message}` }
  if (catalogo?.length) {
    const { error: errIns } = await admin
      .from('job_opening_benefits')
      .insert(catalogo.map((b) => ({ vaga_id: id, benefit_id: b.id, company_id: companyId })))
    if (errIns) return { error: `Vaga salva, mas os benefícios não foram atualizados: ${errIns.message}` }
  }

  revalidar(id)
  return { success: true as const, id }
}

/** Pausar (o link deixa de aceitar candidaturas) ou reabrir. Vaga encerrada não reabre. */
export async function alterarStatusVagaAction(vagaId: string, companyId: string, status: 'aberta' | 'pausada') {
  const auth = await autorizar(companyId)
  if ('error' in auth) return { error: auth.error }

  const { data, error } = await auth.admin
    .from('job_openings')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', vagaId)
    .eq('company_id', companyId)
    .neq('status', 'encerrada')
    .select('id')
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { error: 'Vaga não encontrada ou já encerrada.' }
  revalidar(vagaId)
  return { success: true as const }
}

/**
 * Encerra (desativa) a vaga: nada é apagado e ela não reabre. Quem ainda não foi selecionado recebe o aviso e
 * fica como "Processo encerrado"; os dados seguem guardados até o prazo do aceite (lib/candidaturas-retencao.ts).
 */
export async function encerrarVagaAction(vagaId: string, companyId: string) {
  const auth = await autorizar(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin } = auth

  const { data: vaga } = await admin
    .from('job_openings')
    .select('titulo')
    .eq('id', vagaId)
    .eq('company_id', companyId)
    .neq('status', 'encerrada')
    .maybeSingle()
  if (!vaga) return { error: 'Vaga não encontrada.' }

  const agora = new Date().toISOString()
  const { error } = await admin
    .from('job_openings')
    .update({ status: 'encerrada', encerrada_em: agora, updated_at: agora })
    .eq('id', vagaId)
    .eq('company_id', companyId)
  if (error) return { error: error.message }

  const { data: encerradas, error: errCand } = await admin
    .from('job_applications')
    .update({ status: 'processo_encerrado' })
    .eq('vaga_id', vagaId)
    .eq('company_id', companyId)
    .eq('status', 'nova')
    .select('nome, email')
  if (errCand) return { error: `Vaga encerrada, mas as candidaturas não foram atualizadas: ${errCand.message}` }

  const { enviados, falhas } = await avisarProcessoEncerrado({
    companyId,
    vagaTitulo: vaga.titulo as string,
    candidatos: (encerradas ?? []) as { nome: string; email: string }[],
  })

  revalidar(vagaId)
  return { success: true as const, enviados, falhas }
}

/** Reprovar uma candidatura nova, ou devolver uma reprovada para as novas */
export async function avaliarCandidaturaAction(id: string, companyId: string, status: 'nova' | 'reprovada', motivo?: string) {
  const auth = await autorizar(companyId)
  if ('error' in auth) return { error: auth.error }

  // Vaga encerrada não muda mais: uma candidatura devolvida para "nova" ficaria sem processo
  const { data: atual } = await auth.admin
    .from('job_applications')
    .select('job_openings(status)')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()
  const vagaDaCandidatura = atual?.job_openings as unknown as { status: string } | null | undefined
  if (vagaDaCandidatura?.status === 'encerrada') return { error: 'Esta vaga está encerrada.' }

  const { data, error } = await auth.admin
    .from('job_applications')
    .update({ status, motivo: status === 'reprovada' ? motivo?.trim().slice(0, 1000) || null : null })
    .eq('id', id)
    .eq('company_id', companyId)
    .in('status', status === 'reprovada' ? ['nova'] : ['reprovada'])
    .select('vaga_id')
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { error: 'Esta candidatura não pode mais ser alterada.' }
  revalidar(data.vaga_id as string)
  return { success: true as const }
}

/**
 * Seleciona o candidato: cria o cadastro em admissão (invisível na Equipe até finalizar), com os dados da
 * candidatura e da vaga, e o card entra no kanban na primeira etapa.
 */
export async function iniciarAdmissaoAction(id: string, companyId: string) {
  const auth = await autorizar(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin } = auth

  const { data: cand } = await admin
    .from('job_applications')
    .select('vaga_id, nome, cpf, email, telefone, status, job_openings(status, cargo, departamento, local_trabalho, tipo_contrato, salario)')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()
  if (!cand) return { error: 'Candidatura não encontrada.' }
  const vaga = cand.job_openings as unknown as {
    status: string; cargo: string | null; departamento: string | null; local_trabalho: string | null
    tipo_contrato: string; salario: number | null
  } | null
  if (!vaga || vaga.status === 'encerrada') return { error: 'Esta vaga está encerrada.' }
  if (cand.status !== 'nova') return { error: 'Só candidaturas novas podem iniciar a admissão.' }

  // A mesma pessoa não pode ter dois cadastros em uso na empresa (quem saiu pode ser recontratado)
  const { data: existente } = await admin
    .from('employees')
    .select('id, status')
    .eq('company_id', companyId)
    .eq('cpf', cand.cpf as string)
    .not('status', 'in', '(inativo,demitido)')
    .limit(1)
    .maybeSingle()
  if (existente) {
    return { error: `Já existe um cadastro com o CPF ${maskCpf(cand.cpf as string)} ${existente.status === 'admissao' ? 'em admissão' : 'na Equipe'}.` }
  }

  // Reserva a candidatura antes de criar o cadastro: dois cliques não geram dois cadastros
  const { data: reservada, error: errReserva } = await admin
    .from('job_applications')
    .update({ status: 'selecionada' })
    .eq('id', id)
    .eq('company_id', companyId)
    .eq('status', 'nova')
    .select('id')
    .maybeSingle()
  if (errReserva) return { error: errReserva.message }
  if (!reservada) return { error: 'Só candidaturas novas podem iniciar a admissão.' }

  const pj = isPjOuAutonomo(vaga.tipo_contrato)
  const { data: emp, error } = await admin
    .from('employees')
    .insert({
      company_id: companyId,
      nome: (cand.nome as string).toUpperCase(),
      cpf: cand.cpf,
      email: cand.email,
      telefone: cand.telefone,
      cargo: vaga.cargo,
      departamento: vaga.departamento,
      local_trabalho: vaga.local_trabalho,
      tipo_contrato: vaga.tipo_contrato,
      ...(pj ? { valor_servico: vaga.salario } : { salario: vaga.salario }),
      status: 'admissao',
      admission_stage: ETAPA_INICIAL,
    })
    .select('id')
    .single()

  if (error || !emp) {
    await admin.from('job_applications').update({ status: 'nova' }).eq('id', id).eq('company_id', companyId)
    return { error: error?.message ?? 'Não foi possível iniciar a admissão.' }
  }

  const { error: errVinculo } = await admin.from('job_applications').update({ employee_id: emp.id }).eq('id', id).eq('company_id', companyId)
  if (errVinculo) return { error: `Admissão iniciada, mas a vaga não foi vinculada: ${errVinculo.message}` }

  // Benefícios da vaga
  const { data: beneficios } = await admin.from('job_opening_benefits').select('benefit_id').eq('vaga_id', cand.vaga_id as string)
  if (beneficios?.length && !pj) {
    const { error: errBen } = await admin
      .from('employee_benefits')
      .insert(beneficios.map((b) => ({ company_id: companyId, employee_id: emp.id, benefit_id: b.benefit_id })))
    if (errBen) return { error: `Admissão iniciada, mas os benefícios não foram vinculados: ${errBen.message}` }
  }

  revalidar(cand.vaga_id as string)
  revalidatePath('/pessoas/admissao')
  return { success: true as const }
}

/** Exclui a candidatura e o anexo (ex.: pedido do candidato). Quem foi selecionado segue o fluxo de admissão. */
export async function excluirCandidaturaAction(id: string, companyId: string) {
  const auth = await autorizar(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin } = auth

  const { data: cand } = await admin
    .from('job_applications')
    .select('vaga_id, anexo_path, status')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()
  if (!cand) return { error: 'Candidatura não encontrada.' }
  if (cand.status === 'selecionada') return { error: 'Este candidato está no processo de admissão.' }

  const { error } = await admin.from('job_applications').delete().eq('id', id).eq('company_id', companyId)
  if (error) return { error: error.message }

  await admin.storage.from(BUCKET).remove([cand.anexo_path as string])
  revalidar(cand.vaga_id as string)
  return { success: true as const }
}

/** Entrevistas e anotações guardadas na candidatura */
export async function getHistoricoCandidaturaAction(id: string, companyId: string) {
  const auth = await autorizar(companyId)
  if ('error' in auth) return { error: auth.error }
  return { historico: await getHistoricoCandidatura(companyId, id) }
}

/** Link temporário (1h) do anexo. O caminho vem do banco, nunca do cliente. */
export async function getAnexoCandidaturaUrlAction(id: string, companyId: string, download = false): Promise<{ url?: string; error?: string }> {
  const auth = await autorizar(companyId)
  if ('error' in auth) return { error: auth.error }

  const { data: cand } = await auth.admin
    .from('job_applications')
    .select('anexo_path, anexo_nome')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()
  if (!cand) return { error: 'Candidatura não encontrada.' }

  const { data, error } = await auth.admin.storage
    .from(BUCKET)
    .createSignedUrl(cand.anexo_path as string, 3600, download ? { download: cand.anexo_nome as string } : undefined)
  if (error) return { error: error.message }
  return { url: data.signedUrl }
}
