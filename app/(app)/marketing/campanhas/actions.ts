'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { semAcesso } from '@/lib/auth/acesso'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function parseCampanhaFields(formData: FormData) {
  const orcamentoRaw = formData.get('orcamento') as string
  const leadsRaw = formData.get('leads_gerados') as string
  const vendasRaw = formData.get('vendas_geradas') as string

  return {
    nome: formData.get('nome') as string,
    objetivo: (formData.get('objetivo') as string) || 'outro',
    canal: (formData.get('canal') as string) || null,
    data_inicio: formData.get('data_inicio') as string,
    data_fim: (formData.get('data_fim') as string) || null,
    orcamento: orcamentoRaw ? parseFloat(orcamentoRaw.replace(/\./g, '').replace(',', '.')) : null,
    leads_gerados: leadsRaw ? parseInt(leadsRaw.replace(/\D/g, ''), 10) : null,
    vendas_geradas: vendasRaw ? parseFloat(vendasRaw.replace(/\./g, '').replace(',', '.')) : null,
    notas: (formData.get('notas') as string) || null,
  }
}

export async function createCampanhaMarketingAction(companyId: string, formData: FormData) {
  const negado = await semAcesso('marketing.campanhas', companyId)
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseCampanhaFields(formData)
  if (!fields.nome) return { error: 'Nome da campanha é obrigatório.' }
  if (!fields.data_inicio) return { error: 'Data de início é obrigatória.' }

  const admin = createAdminClient()
  const { error } = await admin.from('campanhas_marketing').insert({ company_id: companyId, ...fields })

  if (error) return { error: error.message }
  revalidatePath('/marketing/campanhas')
  return { success: true }
}

export async function updateCampanhaMarketingAction(id: string, formData: FormData) {
  const negado = await semAcesso('marketing.campanhas')
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseCampanhaFields(formData)
  if (!fields.nome) return { error: 'Nome da campanha é obrigatório.' }
  if (!fields.data_inicio) return { error: 'Data de início é obrigatória.' }

  const admin = createAdminClient()
  const { error } = await admin.from('campanhas_marketing').update(fields).eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/marketing/campanhas')
  return { success: true }
}

export async function deleteCampanhaMarketingAction(id: string) {
  const negado = await semAcesso('marketing.campanhas')
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('campanhas_marketing').delete().eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/marketing/campanhas')
  return { success: true }
}
