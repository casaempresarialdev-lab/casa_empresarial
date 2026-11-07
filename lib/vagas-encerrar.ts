import type { createAdminClient } from '@/lib/supabase/server'
import { avisarProcessoEncerrado } from '@/lib/vagas-email'

type Admin = ReturnType<typeof createAdminClient>

/**
 * Encerra (desativa) a vaga: nada é apagado e ela não reabre. Quem ainda não foi selecionado recebe o aviso e
 * fica como "Processo encerrado"; os dados seguem guardados até o prazo do aceite (lib/candidaturas-retencao.ts).
 * Quem já está no kanban de admissão segue o fluxo normalmente.
 */
export async function encerrarVaga(admin: Admin, companyId: string, vagaId: string) {
  const agora = new Date().toISOString()
  const { data: vaga, error } = await admin
    .from('job_openings')
    .update({ status: 'encerrada', encerrada_em: agora, updated_at: agora })
    .eq('id', vagaId)
    .eq('company_id', companyId)
    .neq('status', 'encerrada')
    .select('titulo')
    .maybeSingle()
  if (error) return { error: error.message }
  if (!vaga) return { error: 'Vaga não encontrada ou já encerrada.' }

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
  return { success: true as const, titulo: vaga.titulo as string, enviados, falhas }
}

/**
 * Chamada ao finalizar uma admissão que veio de uma vaga: encerra a vaga quando todas as posições
 * foram preenchidas (contratados = candidaturas cujo cadastro já saiu da admissão).
 * Retorna o título da vaga encerrada, ou null se ela continua aberta.
 */
export async function encerrarVagaSePreenchida(admin: Admin, companyId: string, vagaId: string) {
  const { data: vaga } = await admin
    .from('job_openings')
    .select('posicoes, status')
    .eq('id', vagaId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (!vaga || vaga.status === 'encerrada') return null

  const { data: cands } = await admin
    .from('job_applications')
    .select('employee_id')
    .eq('vaga_id', vagaId)
    .eq('company_id', companyId)
    .not('employee_id', 'is', null)
  const ids = (cands ?? []).map(c => c.employee_id as string)
  if (ids.length === 0) return null

  const { count } = await admin
    .from('employees')
    .select('id', { count: 'exact', head: true })
    .in('id', ids)
    .eq('company_id', companyId)
    .neq('status', 'admissao')
  if ((count ?? 0) < ((vaga.posicoes as number | null) ?? 1)) return null

  const res = await encerrarVaga(admin, companyId, vagaId)
  return 'success' in res ? res.titulo : null
}
