'use server'

import { createAdminClient } from '@/lib/supabase/server'

const BUCKET = 'documentos'
const MAX_DOC_SIZE = 20 * 1024 * 1024

const DOC_KEYS = [
  'foto', 'rg_cnh_frente', 'rg_verso', 'exame_admissional', 'cpf',
  'comprovante_residencia', 'titulo_eleitor', 'ctps', 'pis', 'certidao',
] as const

function keyToCol(key: string): string {
  return key === 'foto' ? 'foto_path' : `doc_${key}_path`
}

export async function submitOnboardingAction(
  token: string,
  formData: FormData,
): Promise<{ success?: true; error?: string }> {
  const admin = createAdminClient()

  // Valida token
  const { data: tokenRow } = await admin
    .from('employee_onboarding_tokens')
    .select('employee_id, company_id, expires_at, used_at')
    .eq('token', token)
    .single()

  if (!tokenRow) return { error: 'Link inválido.' }
  if (tokenRow.used_at) return { error: 'Este link já foi utilizado.' }
  if (new Date(tokenRow.expires_at) < new Date()) return { error: 'Este link expirou.' }

  const { employee_id, company_id } = tokenRow

  // Campos pessoais
  const depRaw = parseInt((formData.get('dependentes') as string) || '0')
  const fields = {
    cpf:                    (formData.get('cpf') as string)?.replace(/\D/g, '') || null,
    rg:                     (formData.get('rg') as string) || null,
    nascimento:             (formData.get('nascimento') as string) || null,
    telefone:               (formData.get('telefone') as string) || null,
    email:                  (formData.get('email') as string) || null,
    grau_instrucao:         (formData.get('grau_instrucao') as string) || null,
    dependentes:            isNaN(depRaw) ? 0 : depRaw,
    pis_pasep:              (formData.get('pis_pasep') as string) || null,
    serie_ctps:             (formData.get('serie_ctps') as string) || null,
    certificado_reservista: (formData.get('certificado_reservista') as string) || null,
    dados_bancarios:        (formData.get('dados_bancarios') as string) || null,
  }

  // Upload de documentos
  const docUpdates: Record<string, string | null> = {}
  for (const key of DOC_KEYS) {
    const file = formData.get(`doc_${key}`) as File | null
    if (!file || file.size === 0) continue
    if (file.size > MAX_DOC_SIZE) return { error: `"${file.name}" excede 20 MB.` }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const path = `funcionarios/${company_id}/${employee_id}/${key}_${Date.now()}.${ext}`
    const bytes = await file.arrayBuffer()
    const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
    if (error) return { error: `Erro no upload: ${error.message}` }
    docUpdates[keyToCol(key)] = path
  }

  // Atualiza funcionário
  const { error: updateError } = await admin
    .from('employees')
    .update({ ...fields, ...docUpdates })
    .eq('id', employee_id)

  if (updateError) return { error: updateError.message }

  // Marca token como usado
  await admin
    .from('employee_onboarding_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token)

  return { success: true }
}
