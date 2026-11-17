'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { semAcesso } from '@/lib/auth/acesso'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function createMetricaRedeSocialAction(companyId: string, formData: FormData) {
  const negado = await semAcesso('marketing.metricas', companyId)
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const rede = formData.get('rede') as string
  const mesInput = formData.get('mes') as string // 'YYYY-MM'
  const seguidoresRaw = formData.get('seguidores') as string
  const alcanceRaw = formData.get('alcance') as string
  const engajamentoRaw = formData.get('engajamento') as string
  const observacao = (formData.get('observacao') as string) || null

  if (!mesInput) return { error: 'Mês é obrigatório.' }
  const seguidores = parseInt(seguidoresRaw.replace(/\D/g, ''), 10)
  if (isNaN(seguidores)) return { error: 'Seguidores é obrigatório.' }

  const admin = createAdminClient()
  const { error } = await admin.from('metricas_redes_sociais').insert({
    company_id: companyId,
    rede,
    mes: `${mesInput}-01`,
    seguidores,
    alcance: alcanceRaw ? parseInt(alcanceRaw.replace(/\D/g, ''), 10) : null,
    engajamento: engajamentoRaw ? parseFloat(engajamentoRaw.replace(',', '.')) : null,
    observacao,
  })

  if (error) {
    if (error.code === '23505') return { error: 'Já existe um registro dessa rede neste mês.' }
    return { error: error.message }
  }
  revalidatePath('/marketing/metricas')
  return { success: true }
}

export async function deleteMetricaRedeSocialAction(id: string) {
  const negado = await semAcesso('marketing.metricas')
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('metricas_redes_sociais').delete().eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/marketing/metricas')
  return { success: true }
}
