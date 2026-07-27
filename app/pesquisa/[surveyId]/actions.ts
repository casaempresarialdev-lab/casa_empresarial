'use server'

import { createAdminClient } from '@/lib/supabase/server'

export async function submitSurveyResponseAction(
  surveyId: string,
  respostas: Record<string, string | string[] | number>
) {
  const admin = createAdminClient()
  const { error } = await admin.from('survey_responses').insert({ survey_id: surveyId, respostas })
  if (error) return { error: error.message }
  return { success: true }
}
