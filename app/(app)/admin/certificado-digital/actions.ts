'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/crypto'

export async function updateCertificadoAction(companyId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Sessão inválida. Faça login novamente.' }

  const admin = createAdminClient()
  const senha = (formData.get('certificado_digital_senha') as string) || ''

  if (senha) {
    const { error } = await admin
      .from('companies')
      .update({ certificado_digital_senha_enc: encrypt(senha) })
      .eq('id', companyId)
    if (error) return { error: `Erro ao salvar senha: ${error.message}` }
  }

  const certFile = formData.get('certificado_file') as File
  if (certFile && certFile.size > 0) {
    const ext = certFile.name.split('.').pop() || 'pfx'
    const path = `${companyId}/certificado.${ext}`
    const bytes = await certFile.arrayBuffer()
    const { error: uploadErr } = await admin.storage
      .from('certificados')
      .upload(path, bytes, { contentType: certFile.type || 'application/octet-stream', upsert: true })
    if (uploadErr) return { error: `Erro ao enviar certificado: ${uploadErr.message}` }

    const { error } = await admin.from('companies').update({ certificado_digital_url: path }).eq('id', companyId)
    if (error) return { error: `Erro ao salvar certificado: ${error.message}` }
  }

  revalidatePath('/admin/certificado-digital')
  return { success: true }
}
