'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/auth/viewer'
import { semAcesso } from '@/lib/auth/acesso'
import { desmarcarDias, diasEntre, gravarAusencia, marcarDias, observacaoAusencia } from '@/lib/ponto-marcacao'
import { notificarFuncionario, periodoTexto } from '@/lib/notificacoes'
import { rotuloAusencia } from '@/lib/validations/ausencias'

// Atestados e ausências: quem tem acesso a Registro de Ponto abona, recusa e lança

async function gestor(companyId: string): Promise<{ error: string } | { id: string; nome: string }> {
  const negado = await semAcesso('pessoas.registro-de-ponto', companyId)
  if (negado) return negado
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const viewer = await getViewerContext(companyId)
  if (viewer?.isColaborador) return { error: 'Sem permissão para esta ação.' }
  const { data } = await createAdminClient().from('profiles').select('name').eq('id', user.id).maybeSingle()
  return { id: user.id, nome: (data?.name as string | undefined) ?? 'Usuário' }
}

function revalidar() {
  revalidatePath('/pessoas/registro-de-ponto')
  revalidatePath('/meu-ponto')
  revalidatePath('/pessoas/folha-de-pagamento')
}

/** Lança direto, já abonado: é o responsável quem está registrando */
export async function lancarAusenciaAction(companyId: string, employeeId: string, formData: FormData) {
  const autor = await gestor(companyId)
  if ('error' in autor) return autor
  const admin = createAdminClient()
  const { data: funcionario } = await admin.from('employees').select('id').eq('id', employeeId).eq('company_id', companyId).maybeSingle()
  if (!funcionario) return { error: 'Selecione o funcionário.' }

  const r = await gravarAusencia(admin, { companyId, employeeId, formData, origem: 'gestor', status: 'abonado', autor })
  if ('error' in r) return r
  const { id, tipo, motivo, data_inicio, data_fim } = r.ausencia
  const erro = await marcarDias(admin, companyId, employeeId, diasEntre(data_inicio, data_fim), 'atestado', observacaoAusencia(tipo, motivo))
  if (erro) {
    await admin.from('time_absences').delete().eq('id', id)
    return { error: erro }
  }
  await notificarFuncionario(admin, {
    companyId, employeeId, autorId: autor.id, tipo: 'ausencia',
    titulo: `${rotuloAusencia(tipo)} lançado`, mensagem: `A área de Pessoas lançou e abonou ${periodoTexto(data_inicio, data_fim)}.`, link: '/meu-ponto?aba=ausencias',
  })
  revalidar()
  return { success: true as const }
}

export async function decidirAusenciaAction(companyId: string, id: string, decisao: 'abonado' | 'recusado', resposta?: string) {
  const autor = await gestor(companyId)
  if ('error' in autor) return autor
  if (decisao !== 'abonado' && decisao !== 'recusado') return { error: 'Decisão inválida.' }

  const admin = createAdminClient()
  // Marca primeiro: dois cliques, ou duas pessoas, não decidem a mesma ausência
  const { data: a, error } = await admin
    .from('time_absences')
    .update({ status: decisao, resposta: resposta?.trim().slice(0, 500) || null, decidido_por: autor.id, decidido_por_nome: autor.nome, decidido_em: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', companyId)
    .eq('status', 'pendente')
    .select('employee_id, tipo, motivo, data_inicio, data_fim')
    .maybeSingle()
  if (error) return { error: error.message }
  if (!a) return { error: 'Esta ausência já foi decidida.' }

  if (decisao === 'abonado') {
    const erro = await marcarDias(admin, companyId, a.employee_id as string, diasEntre(a.data_inicio as string, a.data_fim as string), 'atestado', observacaoAusencia(a.tipo as string, a.motivo as string | null))
    if (erro) {
      await admin.from('time_absences').update({ status: 'pendente', resposta: null, decidido_por: null, decidido_por_nome: null, decidido_em: null }).eq('id', id)
      return { error: erro }
    }
  }
  const texto = resposta?.trim()
  await notificarFuncionario(admin, {
    companyId, employeeId: a.employee_id as string, autorId: autor.id, tipo: 'ausencia',
    titulo: `${rotuloAusencia(a.tipo as string)} ${decisao}`,
    mensagem: `${periodoTexto(a.data_inicio as string, a.data_fim as string)} foi ${decisao === 'abonado' ? 'abonado' : 'recusado'}${texto ? `: ${texto}` : '.'}`,
    link: '/meu-ponto?aba=ausencias',
  })
  revalidar()
  return { success: true as const }
}

/** Volta para análise; se estava abonada, os dias voltam a contar como antes */
export async function reverterAusenciaAction(companyId: string, id: string) {
  const autor = await gestor(companyId)
  if ('error' in autor) return autor

  const admin = createAdminClient()
  const { data: a } = await admin.from('time_absences').select('employee_id, status, tipo, data_inicio, data_fim').eq('id', id).eq('company_id', companyId).maybeSingle()
  if (!a || a.status === 'pendente') return { error: 'Esta ausência já está em análise.' }

  if (a.status === 'abonado') {
    const erro = await desmarcarDias(admin, companyId, a.employee_id as string, diasEntre(a.data_inicio as string, a.data_fim as string), 'atestado')
    if (erro) return { error: erro }
  }
  const { error } = await admin.from('time_absences').update({ status: 'pendente', resposta: null, decidido_por: null, decidido_por_nome: null, decidido_em: null }).eq('id', id)
  if (error) return { error: error.message }
  await notificarFuncionario(admin, {
    companyId, employeeId: a.employee_id as string, autorId: autor.id, tipo: 'ausencia',
    titulo: `${rotuloAusencia(a.tipo as string)} voltou para análise`, mensagem: `A decisão sobre ${periodoTexto(a.data_inicio as string, a.data_fim as string)} foi desfeita e será analisada de novo.`, link: '/meu-ponto?aba=ausencias',
  })
  revalidar()
  return { success: true as const }
}

export async function urlAnexoAusenciaAction(companyId: string, id: string) {
  const autor = await gestor(companyId)
  if ('error' in autor) return autor
  const admin = createAdminClient()
  const { data } = await admin.from('time_absences').select('anexo_path').eq('id', id).eq('company_id', companyId).maybeSingle()
  if (!data?.anexo_path) return { error: 'Arquivo não encontrado.' }
  const { data: url } = await admin.storage.from('documentos').createSignedUrl(data.anexo_path as string, 300)
  if (!url) return { error: 'Não foi possível abrir o arquivo.' }
  return { url: url.signedUrl }
}
