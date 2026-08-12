'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function updateIdentidadeVisualAction(companyId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()

  const corPrimaria = (formData.get('cor_primaria') as string) || '#C19A6B'

  const { error } = await admin
    .from('companies')
    .update({ cor_primaria: corPrimaria })
    .eq('id', companyId)

  if (error) return { error: error.message }

  // Remover logo
  if (formData.get('remove_logo') === 'true') {
    await admin.from('companies').update({ logo_url: null }).eq('id', companyId)
  }

  // Upload de logo
  const logoFile = formData.get('logo_file') as File
  if (logoFile && logoFile.size > 0) {
    const ext = logoFile.name.split('.').pop() || 'jpg'
    const path = `${companyId}/logo.${ext}`
    const bytes = await logoFile.arrayBuffer()
    const { error: uploadErr } = await admin.storage
      .from('logos')
      .upload(path, bytes, { contentType: logoFile.type, upsert: true })
    if (!uploadErr) {
      const { data: urlData } = admin.storage.from('logos').getPublicUrl(path)
      await admin.from('companies').update({ logo_url: urlData.publicUrl }).eq('id', companyId)
    }
  }

  revalidatePath('/configuracoes')
  return { success: true }
}
