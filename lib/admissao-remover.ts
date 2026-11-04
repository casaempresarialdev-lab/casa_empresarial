import type { createAdminClient } from '@/lib/supabase/server'

type Admin = ReturnType<typeof createAdminClient>

const COLS_ARQUIVOS = 'foto_path, doc_rg_cnh_frente_path, doc_rg_verso_path, doc_exame_admissional_path, doc_cpf_path, doc_comprovante_residencia_path, doc_titulo_eleitor_path, doc_ctps_path, doc_pis_path, doc_certidao_path, doc_carta_proposta_path'

/** Cancela as entrevistas ainda por acontecer e tira os eventos da agenda (a pessoa saiu da etapa) */
export async function cancelarEntrevistasFuturas(admin: Admin, employeeId: string, companyId: string) {
  const { data } = await admin
    .from('admission_interviews')
    .update({ status: 'cancelada' })
    .eq('employee_id', employeeId)
    .eq('company_id', companyId)
    .eq('status', 'agendada')
    .gt('data_hora', new Date().toISOString())
    .select('reminder_id')
  const eventos = (data ?? []).map((e) => e.reminder_id as string | null).filter((id): id is string => !!id)
  if (eventos.length) await admin.from('reminders').delete().in('id', eventos)
}

/**
 * Tira a pessoa do kanban: a candidatura volta para a vaga com o status indicado (reprovada ou desistiu) e o
 * cadastro em admissão é apagado, com os arquivos. O histórico fica na candidatura; sem vaga, é apagado junto.
 */
export async function removerDaAdmissao(admin: Admin, opcoes: {
  employeeId: string
  companyId: string
  statusCandidatura: 'reprovada' | 'desistiu'
  motivo: string | null
  /** Registro no histórico */
  texto: string
  autorId: string | null
  autorNome: string
}): Promise<{ error?: string }> {
  const { employeeId, companyId, statusCandidatura, motivo, texto, autorId, autorNome } = opcoes

  const { data: emp } = await admin
    .from('employees')
    .select(`id, ${COLS_ARQUIVOS}`)
    .eq('id', employeeId)
    .eq('company_id', companyId)
    .eq('status', 'admissao')
    .maybeSingle()
  if (!emp) return { error: 'Esta admissão não está mais no kanban.' }

  await cancelarEntrevistasFuturas(admin, employeeId, companyId)
  // Cartas ainda válidas deixam de valer
  await admin.from('admission_offers').update({ status: 'substituida' }).eq('employee_id', employeeId).eq('company_id', companyId).eq('status', 'enviada')

  const { data: cand } = await admin
    .from('job_applications')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (cand) {
    await admin.from('admission_notes').insert({
      company_id: companyId, employee_id: employeeId, application_id: cand.id, texto, autor_id: autorId, autor_nome: autorNome,
    })
    const { error } = await admin
      .from('job_applications')
      .update({ status: statusCandidatura, motivo, employee_id: null })
      .eq('id', cand.id as string)
    if (error) return { error: error.message }
  } else {
    await admin.from('admission_notes').delete().eq('employee_id', employeeId).eq('company_id', companyId)
    await admin.from('admission_interviews').delete().eq('employee_id', employeeId).eq('company_id', companyId)
    await admin.from('admission_offers').delete().eq('employee_id', employeeId).eq('company_id', companyId)
  }

  const { error } = await admin.from('employees').delete().eq('id', employeeId).eq('company_id', companyId)
  if (error) return { error: error.message }

  const arquivos = Object.entries(emp as unknown as Record<string, unknown>)
    .filter(([k, v]) => k !== 'id' && typeof v === 'string' && v)
    .map(([, v]) => v as string)
  if (arquivos.length) await admin.storage.from('documentos').remove(arquivos)
  return {}
}
