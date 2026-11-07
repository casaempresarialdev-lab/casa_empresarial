import type { createAdminClient } from '@/lib/supabase/server'
import { gerarCartaPdf } from '@/lib/admissao-carta-pdf'
import { fmtDataHora } from '@/lib/validations/admissao'
import { seguirEtapa } from '@/lib/admissao-concluir'
import { ETAPA_CARTA } from '@/app/(app)/pessoas/admissao/etapas'

type Admin = ReturnType<typeof createAdminClient>

/**
 * Aceite da carta, pelo link (candidato) ou pelo painel (quem registrou): grava data, hora e IP ou quem registrou,
 * leva as condições da carta para o cadastro, anota na linha do tempo, leva o card para a próxima etapa ativa
 * e guarda o PDF nos arquivos do funcionário.
 */
export async function registrarAceite(admin: Admin, opcoes: {
  cartaId: string
  ip: string | null
  /** Aceite registrado no painel por um usuário (candidato aceitou pessoalmente) */
  registradoPor?: { id: string; nome: string }
}): Promise<{ companyId: string; employeeId: string; nome: string } | { error: string }> {
  const { cartaId, ip, registradoPor } = opcoes
  const agora = new Date().toISOString()

  // Só o primeiro aceite vale, mesmo com dois cliques
  const aceitar = (comQuemRegistrou: boolean) => admin
    .from('admission_offers')
    .update({ status: 'aceita', respondida_em: agora, resposta_ip: ip, ...(comQuemRegistrou && registradoPor && { aceite_registrado_por: registradoPor.nome }) })
    .eq('id', cartaId)
    .eq('status', 'enviada')
    .select('company_id, employee_id, conteudo, cargo, salario, data_inicio, local_trabalho')
    .maybeSingle()

  let { data: carta, error } = await aceitar(true)
  // Sem a coluna aceite_registrado_por (migration 20261106000081 pendente): grava sem ela; quem registrou fica na linha do tempo
  if (error && registradoPor && error.message.includes('aceite_registrado_por')) {
    console.error('[carta] coluna aceite_registrado_por ausente; aplique a migration 20261106000081')
    ;({ data: carta, error } = await aceitar(false))
  }
  if (error) {
    console.error('[carta] aceite não registrado:', error.message)
    return { error: `Não foi possível registrar o aceite: ${error.message}` }
  }
  if (!carta?.employee_id) return { error: 'Esta proposta não está mais disponível.' }

  const companyId = carta.company_id as string
  const employeeId = carta.employee_id as string
  const { data: emp } = await admin.from('employees').select('nome, tipo_contrato').eq('id', employeeId).maybeSingle()
  const nome = (emp?.nome as string | undefined) ?? 'Candidato'
  const pj = emp?.tipo_contrato === 'pj' || emp?.tipo_contrato === 'autonomo'

  const { error: errEmp } = await admin
    .from('employees')
    .update({
      cargo: carta.cargo,
      local_trabalho: carta.local_trabalho,
      data_admissao: carta.data_inicio,
      ...(carta.salario != null && (pj ? { valor_servico: carta.salario } : { salario: carta.salario })),
    })
    .eq('id', employeeId)
  if (errEmp) console.error('[carta] condições não copiadas para o cadastro:', errEmp.message)

  const { data: cand } = await admin.from('job_applications').select('id').eq('employee_id', employeeId).maybeSingle()
  await admin.from('admission_notes').insert({
    company_id: companyId,
    employee_id: employeeId,
    application_id: cand?.id ?? null,
    texto: registradoPor ? 'Aceite da carta proposta registrado no painel.' : `Carta proposta aceita${ip ? ` (IP ${ip})` : ''}.`,
    tipo: 'evento',
    autor_id: registradoPor?.id ?? null,
    autor_nome: registradoPor?.nome ?? nome,
  })

  // Proposta aceita: o card segue para a próxima etapa ativa (os dados são preenchidos pelo link ou na ficha)
  const avanco = await seguirEtapa(admin, { companyId, employeeId, de: ETAPA_CARTA, autor: { id: registradoPor?.id ?? null, nome: registradoPor?.nome ?? nome } })
  if ('error' in avanco) console.error('[carta] card não avançou após o aceite:', avanco.error)

  // PDF: o aceite vale mesmo se o arquivo falhar (o texto e o registro ficam no banco)
  try {
    const { data: empresa } = await admin.from('companies').select('nome_fantasia, razao_social').eq('id', companyId).maybeSingle()
    const pdf = gerarCartaPdf({
      empresa: empresa?.nome_fantasia || empresa?.razao_social || '',
      candidato: nome,
      conteudo: carta.conteudo as string,
      aceitaEm: fmtDataHora(agora),
      ip,
      registradoPor: registradoPor?.nome,
    })
    const path = `funcionarios/${companyId}/${employeeId}/carta_proposta_${Date.now()}.pdf`
    const { error: errUp } = await admin.storage.from('documentos').upload(path, pdf, { contentType: 'application/pdf', upsert: false })
    if (errUp) throw new Error(errUp.message)
    await admin.from('admission_offers').update({ pdf_path: path }).eq('id', cartaId)
    await admin.from('employees').update({ doc_carta_proposta_path: path }).eq('id', employeeId)
  } catch (e) {
    console.error('[carta] PDF não gerado:', e instanceof Error ? e.message : e)
  }

  return { companyId, employeeId, nome }
}
