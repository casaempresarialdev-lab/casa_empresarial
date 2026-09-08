import { createAdminClient } from '@/lib/supabase/server'

export type OrdemServicoItem = {
  descricao: string
  valor: number
}

export type ServiceOrder = {
  id: string
  company_id: string
  numero: number
  cliente_id: string | null
  data: string
  status: 'aberta' | 'concluida' | 'cancelada'
  itens: OrdemServicoItem[]
  valor_total: number
  forma_pagamento: string | null
  observacao: string | null
  created_at: string
  updated_at: string
  cliente?: { nome: string } | null
}

export async function getServiceOrders(companyId: string): Promise<ServiceOrder[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('service_orders')
    .select('*, cliente:contacts(nome)')
    .eq('company_id', companyId)
    .order('numero', { ascending: false })

  if (error) throw error
  return (data ?? []) as ServiceOrder[]
}

export async function getContacts(companyId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('contacts')
    .select('id, nome, tipo')
    .eq('company_id', companyId)
    .order('nome', { ascending: true })

  if (error) return []
  return (data ?? []) as { id: string; nome: string; tipo: string }[]
}
