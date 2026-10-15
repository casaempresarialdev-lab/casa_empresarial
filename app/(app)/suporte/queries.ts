import { createAdminClient } from '@/lib/supabase/server'

export type SupportTicket = {
  id: string
  mensagem: string
  status: 'aberto' | 'respondido' | 'fechado'
  created_at: string
}

export async function getSupportTickets(companyId: string): Promise<SupportTicket[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('support_tickets')
    .select('id, mensagem, status, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  return (data ?? []) as SupportTicket[]
}
