import type { createAdminClient } from '@/lib/supabase/server'
import { R_FINAL, proximaEtapaRescisao } from '@/app/(app)/pessoas/rescisao/etapas'
import { getEtapasRescisao } from '@/app/(app)/pessoas/rescisao/queries'
import { isPjOuAutonomo } from '@/app/(app)/pessoas/funcionarios/components/ficha/ficha-config'

type Admin = ReturnType<typeof createAdminClient>
export type Autor = { id: string | null; nome: string }

const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const fmtData = (d: string) => d.split('-').reverse().join('/')

export async function anotarRescisao(admin: Admin, opcoes: { companyId: string; rescisaoId: string; autor: Autor; texto: string; tipo?: 'anotacao' | 'evento' }) {
  return admin.from('termination_notes').insert({
    company_id: opcoes.companyId,
    termination_id: opcoes.rescisaoId,
    texto: opcoes.texto,
    tipo: opcoes.tipo ?? 'evento',
    autor_id: opcoes.autor.id,
    autor_nome: opcoes.autor.nome,
  })
}

/**
 * Tira da empresa o acesso de quem está saindo. A conta continua existindo, pois pode estar em outras empresas.
 * Pode repetir sem efeito colateral: roda antes de a rescisão ser marcada como finalizada.
 */
async function revogarAcesso(admin: Admin, companyId: string, emp: { id: string; email: string | null; profile_id: string | null }): Promise<{ error: string } | { acesso: 'revogado' | 'proprietario' | 'sem_conta' }> {
  // Convite pendente reativaria a pessoa no próximo login, e o login procura o convite pelo e-mail
  const filtros: [string, string][] = [['employee_id', emp.id]]
  if (emp.email) filtros.push(['email', emp.email.trim().toLowerCase()])
  for (const [coluna, valor] of filtros) {
    const { error } = await admin.from('invitations').update({ status: 'cancelled', token_hash: null }).eq('company_id', companyId).eq('status', 'pending').eq(coluna, valor)
    if (error) return { error: error.message }
  }
  if (!emp.profile_id) return { acesso: 'sem_conta' }

  const { data: membro, error: errMembro } = await admin.from('company_members').select('id, role').eq('company_id', companyId).eq('profile_id', emp.profile_id).maybeSingle()
  if (errMembro) return { error: errMembro.message }
  if (membro?.role === 'owner') return { acesso: 'proprietario' }

  if (membro) {
    const { error } = await admin.from('company_members').update({ status: 'inactive' }).eq('id', membro.id)
    if (error) return { error: error.message }
    await admin.from('member_access_profiles').delete().eq('member_id', membro.id)
  }

  // O cofre é da conta, não da empresa: senhas que colegas compartilharam continuariam visíveis
  const { data: colegas } = await admin.from('company_members').select('profile_id').eq('company_id', companyId)
  const ids = (colegas ?? []).map((c) => c.profile_id as string)
  if (ids.length) {
    const { error } = await admin.from('credential_shares').delete().eq('shared_with', emp.profile_id).in('owner_id', ids)
    if (error) return { error: error.message }
  }
  return { acesso: 'revogado' }
}

/**
 * Fim do processo: a pessoa sai da Equipe (Demitido; PJ e autônomo, Inativo) e perde o acesso ao sistema.
 * Data do desligamento: a informada, senão a já gravada (TRCT), o último dia do aviso ou hoje.
 */
export async function concluirRescisao(admin: Admin, opcoes: { companyId: string; rescisaoId: string; autor: Autor; dataDesligamento?: string | null }) {
  const { companyId, rescisaoId, autor } = opcoes
  const { data: r } = await admin
    .from('employee_terminations')
    .select('employee_id, data_desligamento, ultimo_dia, employee:employee_id(tipo_contrato, email, profile_id)')
    .eq('id', rescisaoId).eq('company_id', companyId).eq('status', 'em_andamento')
    .maybeSingle()
  if (!r) return { error: 'Esta rescisão não está mais em andamento.' }

  const data = opcoes.dataDesligamento || (r.data_desligamento as string | null) || (r.ultimo_dia as string | null) || hoje()
  const emp = r.employee as unknown as { tipo_contrato: string | null; email: string | null; profile_id: string | null } | null
  const pj = isPjOuAutonomo(emp?.tipo_contrato)
  const status = pj ? 'inativo' : 'demitido'

  const revogacao = await revogarAcesso(admin, companyId, { id: r.employee_id as string, email: emp?.email ?? null, profile_id: emp?.profile_id ?? null })
  if ('error' in revogacao) return { error: revogacao.error }

  const { error } = await admin
    .from('employees')
    // Sem o vínculo, a ficha deixa de indicar acesso; proprietário continua com o dele
    .update({ status, data_demissao: data, ...(revogacao.acesso === 'revogado' && { profile_id: null }) })
    .eq('id', r.employee_id as string)
    .eq('company_id', companyId)
  if (error) return { error: error.message }

  const agora = new Date().toISOString()
  const { error: errR } = await admin
    .from('employee_terminations')
    .update({ status: 'finalizada', etapa: R_FINAL, data_desligamento: data, finalizada_em: agora, em_espera: false, updated_at: agora })
    .eq('id', rescisaoId)
  if (errR) return { error: errR.message }

  await anotarRescisao(admin, { companyId, rescisaoId, autor, texto: `Rescisão finalizada. Desligamento em ${fmtData(data)}.` })
  if (revogacao.acesso === 'revogado') await anotarRescisao(admin, { companyId, rescisaoId, autor, texto: 'Acesso ao sistema revogado.' })
  if (revogacao.acesso === 'proprietario') await anotarRescisao(admin, { companyId, rescisaoId, autor, texto: 'Acesso ao sistema mantido: a pessoa é proprietária da empresa.' })
  return { success: true as const, status }
}

/**
 * Fim de uma etapa: grava os campos dela e segue para a próxima etapa ativa (pulando as que não valem para
 * PJ e autônomo). Sem mais nenhuma antes de "Finalizado", conclui a rescisão. Só age se a rescisão ainda
 * estiver na etapa "de" (evita duplo clique).
 */
export async function seguirEtapaRescisao(admin: Admin, opcoes: {
  companyId: string
  rescisaoId: string
  de: string
  pj: boolean
  autor: Autor
  campos?: Record<string, unknown>
  dataDesligamento?: string | null
}): Promise<{ error: string } | { success: true; finalizado: boolean; proxima: string }> {
  const { companyId, rescisaoId, de, pj, autor, campos = {} } = opcoes
  const proxima = proximaEtapaRescisao(await getEtapasRescisao(companyId), de, pj)
  const finalizar = proxima === R_FINAL

  const { data: movida, error } = await admin
    .from('employee_terminations')
    // O update nunca vai vazio: updated_at sempre muda
    .update({ ...campos, updated_at: new Date().toISOString(), ...(!finalizar && { etapa: proxima }) })
    .eq('id', rescisaoId)
    .eq('company_id', companyId)
    .eq('status', 'em_andamento')
    .eq('etapa', de)
    .select('id')
    .maybeSingle()
  if (error) return { error: error.message }
  if (!movida) return { error: 'A rescisão já mudou de etapa. Atualize a página.' }

  if (!finalizar) return { success: true, finalizado: false, proxima }
  const r = await concluirRescisao(admin, { companyId, rescisaoId, autor, dataDesligamento: opcoes.dataDesligamento })
  if ('error' in r) return { error: r.error! }
  return { success: true, finalizado: true, proxima }
}
