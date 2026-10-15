'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function createSupportTicketAction(companyId: string, mensagem: string) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Sessão inválida. Faça login novamente.' }
  if (!mensagem.trim()) return { error: 'Escreva uma mensagem antes de enviar.' }

  const admin = createAdminClient()
  const { error } = await admin.from('support_tickets').insert({
    company_id: companyId,
    created_by: user.id,
    mensagem: mensagem.trim(),
  })

  if (error) return { error: `Erro ao registrar chamado: ${error.message}` }
  revalidatePath('/suporte')
  return { success: true }
}
