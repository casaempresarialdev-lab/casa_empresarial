'use server'

import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { companySchema } from '@/lib/validations/company'

export async function createCompanyAction(formData: FormData) {
  // Verificar autenticação com o client do usuário
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: `Sessão inválida: ${authError?.message ?? 'usuário não encontrado'}. Faça login novamente.` }
  }

  const raw = {
    cnpj: formData.get('cnpj') as string,
    razao_social: formData.get('razao_social') as string,
    nome_fantasia: formData.get('nome_fantasia') as string || undefined,
    regime_tributario: formData.get('regime_tributario') as string || undefined,
    telefone: formData.get('telefone') as string || undefined,
    email: formData.get('email') as string || undefined,
  }

  const parsed = companySchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  // Inserções via admin client (service role) — RLS bypassed, auth já verificada acima
  const admin = createAdminClient()

  const { data: company, error: companyError } = await admin
    .from('companies')
    .insert({
      cnpj: parsed.data.cnpj.replace(/\D/g, ''),
      razao_social: parsed.data.razao_social,
      nome_fantasia: parsed.data.nome_fantasia,
      regime_tributario: parsed.data.regime_tributario,
      telefone: parsed.data.telefone,
      email: parsed.data.email,
    })
    .select('id')
    .single()

  if (companyError) {
    if (companyError.code === '23505') {
      return { error: 'Este CNPJ já está cadastrado.' }
    }
    return { error: `[companies] ${companyError.code}: ${companyError.message}` }
  }

  const { error: memberError } = await admin.from('company_members').insert({
    company_id: company.id,
    profile_id: user.id,
    role: 'owner',
    status: 'active',
  })

  if (memberError) {
    return { error: `[company_members] ${memberError.code}: ${memberError.message}` }
  }

  redirect('/dashboard')
}
