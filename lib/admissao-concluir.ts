import type { createAdminClient } from '@/lib/supabase/server'
import { ETAPA_FINAL, proximaEtapa } from '@/app/(app)/pessoas/admissao/etapas'
import { getEtapasAdmissao } from '@/app/(app)/pessoas/admissao/queries'
import { addDays } from '@/app/(app)/pessoas/funcionarios/components/ficha/ficha-config'
import { encerrarVagaSePreenchida } from '@/lib/vagas-encerrar'

type Admin = ReturnType<typeof createAdminClient>
type Autor = { id: string | null; nome: string }

const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

async function anotar(admin: Admin, companyId: string, employeeId: string, applicationId: string | null, autor: Autor, texto: string) {
  await admin.from('admission_notes').insert({
    company_id: companyId, employee_id: employeeId, application_id: applicationId,
    texto, tipo: 'evento', autor_id: autor.id, autor_nome: autor.nome,
  })
}

/**
 * Fim do fluxo: a pessoa entra na Equipe. CLT começa em experiência (datas calculadas pela admissão); os demais, ativos.
 * Data de admissão: a informada, senão a já gravada (ex.: no contrato), a de início da carta aceita ou hoje.
 * Admissão que começou por uma vaga: com as posições preenchidas, a vaga é encerrada.
 */
export async function concluirAdmissao(admin: Admin, opcoes: { companyId: string; employeeId: string; autor: Autor; dataAdmissao?: string | null }) {
  const { companyId, employeeId, autor } = opcoes
  const { data: emp } = await admin.from('employees').select('*').eq('id', employeeId).eq('company_id', companyId).eq('status', 'admissao').maybeSingle()
  if (!emp) return { error: 'Esta admissão não está mais no kanban.' }

  let dataAdmissao = opcoes.dataAdmissao || (emp.data_admissao as string | null)
  if (!dataAdmissao) {
    const { data: carta } = await admin
      .from('admission_offers').select('data_inicio')
      .eq('employee_id', employeeId).eq('company_id', companyId).eq('status', 'aceita')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    dataAdmissao = (carta?.data_inicio as string | null | undefined) || hoje()
  }

  const clt = emp.tipo_contrato === 'clt'
  const pj = emp.tipo_contrato === 'pj' || emp.tipo_contrato === 'autonomo'
  const fim1 = emp.fim_experiencia_1 ?? addDays(dataAdmissao, 44)
  const vcto = emp.vcto_ferias ?? addDays(dataAdmissao, 364)
  const status = clt ? 'experiencia' : 'ativo'

  const { error } = await admin
    .from('employees')
    .update({
      status,
      admission_stage: ETAPA_FINAL,
      admissao_em_espera: false,
      data_admissao: dataAdmissao,
      ...(clt && { fim_experiencia_1: fim1, fim_experiencia_2: emp.fim_experiencia_2 ?? addDays(fim1, 45) }),
      ...(!pj && { vcto_ferias: vcto, conceder_ferias_ate: emp.conceder_ferias_ate ?? addDays(vcto, 330) }),
    })
    .eq('id', employeeId)
    .eq('company_id', companyId)
  if (error) return { error: error.message }

  const { data: cand } = await admin.from('job_applications').select('id, vaga_id').eq('employee_id', employeeId).eq('company_id', companyId).maybeSingle()
  const applicationId = (cand?.id as string | undefined) ?? null
  await anotar(admin, companyId, employeeId, applicationId, autor, `Admissão finalizada em ${dataAdmissao.split('-').reverse().join('/')}.`)

  const vagaId = (cand?.vaga_id as string | undefined) ?? null
  const vagaEncerrada = vagaId ? await encerrarVagaSePreenchida(admin, companyId, vagaId) : null
  if (vagaEncerrada) await anotar(admin, companyId, employeeId, applicationId, autor, `Vaga "${vagaEncerrada}" encerrada: todas as posições foram preenchidas.`)

  return { success: true as const, status, vagaEncerrada }
}

/**
 * Fim de uma etapa: grava os campos dela e segue para a próxima etapa ativa. Se não houver mais nenhuma
 * antes de "Finalizado", conclui a admissão. Só age se o card ainda estiver na etapa "de" (evita duplo clique).
 */
export async function seguirEtapa(admin: Admin, opcoes: {
  companyId: string
  employeeId: string
  de: string
  autor: Autor
  campos?: Record<string, unknown>
  dataAdmissao?: string | null
}): Promise<{ error: string } | { success: true; finalizado: boolean; proxima: string; vagaEncerrada: string | null }> {
  const { companyId, employeeId, de, autor, campos = {} } = opcoes
  const proxima = proximaEtapa(await getEtapasAdmissao(companyId), de)
  const finalizar = proxima === ETAPA_FINAL

  const { data: movido, error } = await admin
    .from('employees')
    // Concluindo, a etapa fica para concluirAdmissao; o update nunca vai vazio (a etapa personalizada não tem campos)
    .update({ ...campos, ...(finalizar ? { admissao_em_espera: false } : { admission_stage: proxima }) })
    .eq('id', employeeId)
    .eq('company_id', companyId)
    .eq('status', 'admissao')
    .eq('admission_stage', de)
    .select('id')
    .maybeSingle()
  if (error) return { error: error.message }
  if (!movido) return { error: 'O card já mudou de etapa. Atualize a página.' }

  if (!finalizar) return { success: true, finalizado: false, proxima, vagaEncerrada: null }
  const r = await concluirAdmissao(admin, { companyId, employeeId, autor, dataAdmissao: opcoes.dataAdmissao })
  if ('error' in r) return { error: r.error! }
  return { success: true, finalizado: true, proxima, vagaEncerrada: r.vagaEncerrada ?? null }
}
