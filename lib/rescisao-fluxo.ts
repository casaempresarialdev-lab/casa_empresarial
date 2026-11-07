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
 * Fim do processo: a pessoa sai da Equipe (Demitido; PJ e autônomo, Inativo).
 * Data do desligamento: a informada, senão a já gravada (TRCT), o último dia do aviso ou hoje.
 */
export async function concluirRescisao(admin: Admin, opcoes: { companyId: string; rescisaoId: string; autor: Autor; dataDesligamento?: string | null }) {
  const { companyId, rescisaoId, autor } = opcoes
  const { data: r } = await admin
    .from('employee_terminations')
    .select('employee_id, data_desligamento, ultimo_dia, employee:employee_id(tipo_contrato)')
    .eq('id', rescisaoId).eq('company_id', companyId).eq('status', 'em_andamento')
    .maybeSingle()
  if (!r) return { error: 'Esta rescisão não está mais em andamento.' }

  const data = opcoes.dataDesligamento || (r.data_desligamento as string | null) || (r.ultimo_dia as string | null) || hoje()
  const pj = isPjOuAutonomo((r.employee as unknown as { tipo_contrato: string | null } | null)?.tipo_contrato)
  const status = pj ? 'inativo' : 'demitido'

  const { error } = await admin
    .from('employees')
    .update({ status, data_demissao: data })
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
