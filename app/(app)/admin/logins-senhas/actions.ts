'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { encrypt, decrypt } from '@/lib/crypto'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function createCredentialAction(companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const senha = formData.get('senha') as string
  if (!senha) return { error: 'Senha é obrigatória.' }

  const admin = createAdminClient()
  const { error } = await admin.from('credentials').insert({
    company_id: companyId,
    sistema: formData.get('sistema') as string,
    login: formData.get('login') as string,
    senha_enc: encrypt(senha),
    url: (formData.get('url') as string) || null,
    observacao: (formData.get('observacao') as string) || null,
  })

  if (error) return { error: error.message }
  revalidatePath('/admin/logins-senhas')
  return { success: true }
}

export async function updateCredentialAction(credentialId: string, companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()

  const updateData: Record<string, unknown> = {
    sistema: formData.get('sistema') as string,
    login: formData.get('login') as string,
    url: (formData.get('url') as string) || null,
    observacao: (formData.get('observacao') as string) || null,
  }

  const novaSenha = formData.get('senha') as string
  if (novaSenha) {
    updateData.senha_enc = encrypt(novaSenha)
  }

  const { error } = await admin
    .from('credentials')
    .update(updateData)
    .eq('id', credentialId)
    .eq('company_id', companyId)

  if (error) return { error: error.message }
  revalidatePath('/admin/logins-senhas')
  return { success: true }
}

export async function deleteCredentialAction(credentialId: string, companyId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('credentials')
    .delete()
    .eq('id', credentialId)
    .eq('company_id', companyId)

  if (error) return { error: error.message }
  revalidatePath('/admin/logins-senhas')
  return { success: true }
}

export async function revealPasswordAction(
  credentialId: string,
  companyId: string
): Promise<{ password?: string; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()

  // Verificar que o usuário tem acesso a esta empresa
  const { data: member } = await admin
    .from('company_members')
    .select('id')
    .eq('profile_id', user.id)
    .eq('company_id', companyId)
    .eq('status', 'active')
    .maybeSingle()

  if (!member) return { error: 'Acesso não autorizado.' }

  const { data } = await admin
    .from('credentials')
    .select('senha_enc')
    .eq('id', credentialId)
    .eq('company_id', companyId)
    .single()

  if (!data) return { error: 'Credencial não encontrada.' }

  try {
    const password = decrypt(data.senha_enc)
    return { password }
  } catch {
    return { error: 'Erro ao descriptografar a senha.' }
  }
}
