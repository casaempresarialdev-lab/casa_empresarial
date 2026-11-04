'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { ETAPA_APOS_CARTA, ETAPA_CARTA } from '@/app/(app)/pessoas/admissao/etapas'
import { docsObrigatorios } from '../docs-obrigatorios'

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

  // Campos pessoais: o que veio em branco não apaga o que já existe (ex.: dados da candidatura)
  const depRaw = parseInt((formData.get('dependentes') as string) || '')
  const preenchidos = Object.fromEntries(
    Object.entries({
      cpf:                    (formData.get('cpf') as string)?.replace(/\D/g, ''),
      rg:                     formData.get('rg') as string,
      nascimento:             formData.get('nascimento') as string,
      telefone:               formData.get('telefone') as string,
      email:                  formData.get('email') as string,
      grau_instrucao:         formData.get('grau_instrucao') as string,
      pis_pasep:              formData.get('pis_pasep') as string,
      serie_ctps:             formData.get('serie_ctps') as string,
      certificado_reservista: formData.get('certificado_reservista') as string,
      dados_bancarios:        formData.get('dados_bancarios') as string,
    }).filter(([, v]) => !!v),
  )
  const fields = { ...preenchidos, ...(!isNaN(depRaw) && { dependentes: depRaw }) }

  // Documentos obrigatórios: enviados agora ou já existentes no cadastro
  const { data: atual } = await admin
    .from('employees')
    .select('tipo_contrato, admission_stage, doc_cpf_path, doc_ctps_path, doc_comprovante_residencia_path')
    .eq('id', employee_id)
    .single()
  if (!atual) return { error: 'Cadastro não encontrado.' }
  const enviado = (key: string) => { const f = formData.get(`doc_${key}`) as File | null; return !!f && f.size > 0 }
  const faltando = docsObrigatorios(atual.tipo_contrato as string | null)
    .filter((d) => !enviado(d.key) && !(atual as Record<string, unknown>)[`doc_${d.key}_path`])
  if (faltando.length) return { error: `Envie: ${faltando.map((d) => d.label).join(', ')}.` }

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

  // Fim da etapa da carta: aceitou e preencheu, o card segue sozinho para o exame
  if (atual.admission_stage === ETAPA_CARTA) {
    const { data: pessoa } = await admin
      .from('employees')
      .update({ admission_stage: ETAPA_APOS_CARTA })
      .eq('id', employee_id)
      .eq('status', 'admissao')
      .select('nome')
      .maybeSingle()
    if (pessoa) {
      const { data: cand } = await admin.from('job_applications').select('id').eq('employee_id', employee_id).maybeSingle()
      await admin.from('admission_notes').insert({
        company_id, employee_id, application_id: cand?.id ?? null,
        texto: 'Dados e documentos preenchidos pelo candidato.',
        autor_nome: pessoa.nome,
      })
    }
  }

  return { success: true }
}
