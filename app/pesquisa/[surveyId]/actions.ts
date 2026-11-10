'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { hojeBrasil, limparRespostas, motivoFechada } from '@/lib/pesquisa'
import type { SurveyQuestion } from '@/app/(app)/pessoas/pesquisas/queries'

const FECHADA: Record<string, string> = {
  rascunho: 'Esta pesquisa ainda não foi aberta.',
  encerrada: 'Esta pesquisa foi encerrada e não recebe mais respostas.',
  antes: 'Esta pesquisa ainda não começou.',
  depois: 'O prazo desta pesquisa terminou.',
  sem_perguntas: 'Esta pesquisa ainda não tem perguntas.',
}

export async function submitSurveyResponseAction(surveyId: string, respostas: Record<string, unknown>) {
  if (!/^[0-9a-f-]{36}$/i.test(surveyId) || !respostas || typeof respostas !== 'object') return { error: 'Pesquisa inválida.' }

  const admin = createAdminClient()
  const { data: s } = await admin.from('surveys').select('status, data_inicio, data_fim, perguntas').eq('id', surveyId).maybeSingle()
  if (!s) return { error: 'Pesquisa não encontrada.' }
  const perguntas = (s.perguntas ?? []) as SurveyQuestion[]
  const motivo = motivoFechada({ ...s, perguntas } as { status: string; data_inicio: string | null; data_fim: string | null; perguntas: SurveyQuestion[] }, hojeBrasil())
  if (motivo) return { error: FECHADA[motivo] }

  const limpas = limparRespostas(perguntas, respostas)
  if (!Object.keys(limpas).length) return { error: 'Responda pelo menos uma pergunta.' }

  // Logado: uma resposta por pessoa. Só o fato de ter participado fica registrado, sem ligação com a resposta.
  let userId: string | null = null
  try {
    const { data: { user } } = await (await createClient()).auth.getUser()
    userId = user?.id ?? null
  } catch {
    // Sem sessão: resposta anônima de quem recebeu o link
  }
  if (userId) {
    const { data: ja, error: semTabela } = await admin.from('survey_participations').select('survey_id').eq('survey_id', surveyId).eq('profile_id', userId).maybeSingle()
    if (ja && !semTabela) return { error: 'Você já respondeu esta pesquisa. Obrigado!' }
  }

  const { error } = await admin.from('survey_responses').insert({ survey_id: surveyId, respostas: limpas })
  if (error) return { error: 'Não foi possível enviar agora. Tente de novo.' }

  if (userId) {
    // Sem a migration 20261110000104 não há onde marcar: a resposta já foi gravada
    await admin.from('survey_participations').upsert({ survey_id: surveyId, profile_id: userId }, { onConflict: 'survey_id,profile_id', ignoreDuplicates: true })
  }
  return { success: true as const }
}
