'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { semAcesso } from '@/lib/auth/acesso'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function createMediaAssetAction(companyId: string, formData: FormData) {
  const negado = await semAcesso('marketing.bancomidia', companyId)
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const arquivo = formData.get('arquivo') as File
  if (!arquivo || arquivo.size === 0) return { error: 'Selecione um arquivo.' }

  const nome = (formData.get('nome') as string) || arquivo.name
  const area = (formData.get('area') as string) || 'geral'
  const tema = (formData.get('tema') as string) || null

  const admin = createAdminClient()
  const { data: inserted, error: insertErr } = await admin
    .from('media_assets')
    .insert({ company_id: companyId, nome, area, tema, url: '', tamanho: arquivo.size, mime_type: arquivo.type })
    .select('id')
    .single()
  if (insertErr) return { error: insertErr.message }

  const ext = arquivo.name.split('.').pop() || 'bin'
  const path = `${companyId}/${inserted.id}.${ext}`
  const bytes = await arquivo.arrayBuffer()
  const { error: uploadErr } = await admin.storage
    .from('midia-marketing')
    .upload(path, bytes, { contentType: arquivo.type, upsert: true })
  if (uploadErr) {
    await admin.from('media_assets').delete().eq('id', inserted.id)
    return { error: uploadErr.message }
  }

  const { data: urlData } = admin.storage.from('midia-marketing').getPublicUrl(path)
  await admin.from('media_assets').update({ url: urlData.publicUrl }).eq('id', inserted.id)

  revalidatePath('/marketing/banco-de-midia')
  return { success: true }
}

export async function updateMediaAssetAction(id: string, formData: FormData) {
  const negado = await semAcesso('marketing.bancomidia')
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const nome = formData.get('nome') as string
  const area = (formData.get('area') as string) || 'geral'
  const tema = (formData.get('tema') as string) || null
  if (!nome) return { error: 'Nome é obrigatório.' }

  const admin = createAdminClient()
  const { error } = await admin.from('media_assets').update({ nome, area, tema }).eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/marketing/banco-de-midia')
  return { success: true }
}

export async function deleteMediaAssetAction(id: string) {
  const negado = await semAcesso('marketing.bancomidia')
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('media_assets').delete().eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/marketing/banco-de-midia')
  return { success: true }
}
