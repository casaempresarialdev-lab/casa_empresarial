import type { createAdminClient } from '@/lib/supabase/server'
import { ETAPA_CARTA } from '@/app/(app)/pessoas/admissao/etapas'
import { seguirEtapa } from '@/lib/admissao-concluir'
import { docsObrigatorios } from '@/app/auto-cadastro/docs-obrigatorios'

type Admin = ReturnType<typeof createAdminClient>

const BUCKET = 'documentos'
const MAX_DOC_SIZE = 20 * 1024 * 1024

const DOC_KEYS = [
  'foto', 'rg_cnh_frente', 'rg_verso', 'cpf', 'comprovante_residencia', 'titulo_eleitor', 'ctps', 'pis', 'certidao',
] as const

const coluna = (key: string) => (key === 'foto' ? 'foto_path' : `doc_${key}_path`)

/**
 * Preenchimento dos dados da admissão, pelo próprio candidato (link) ou por quem usa o painel.
 * O que vier em branco não apaga o que já existe (ex.: dados da candidatura). Normalmente o card já saiu da
 * carta no aceite; se ainda estiver nela, segue para a próxima etapa ativa.
 */
export async function salvarDadosAdmissao(admin: Admin, opcoes: {
  employeeId: string
  companyId: string
  formData: FormData
  /** Quem preencheu: sem autor, foi o candidato */
  autor?: { id: string; nome: string }
}): Promise<{ error?: string }> {
  const { employeeId, companyId, formData: fd, autor } = opcoes

  const depRaw = parseInt((fd.get('dependentes') as string) || '')
  const preenchidos = Object.fromEntries(
    Object.entries({
      cpf: (fd.get('cpf') as string)?.replace(/\D/g, ''),
      rg: fd.get('rg') as string,
      nascimento: fd.get('nascimento') as string,
      telefone: fd.get('telefone') as string,
      email: fd.get('email') as string,
      grau_instrucao: fd.get('grau_instrucao') as string,
      pis_pasep: fd.get('pis_pasep') as string,
      serie_ctps: fd.get('serie_ctps') as string,
      certificado_reservista: fd.get('certificado_reservista') as string,
      dados_bancarios: fd.get('dados_bancarios') as string,
    }).filter(([, v]) => !!v),
  )
  const campos = { ...preenchidos, ...(!isNaN(depRaw) && { dependentes: depRaw }) }

  const { data: atual } = await admin
    .from('employees')
    .select('nome, tipo_contrato, admission_stage, doc_cpf_path, doc_ctps_path, doc_comprovante_residencia_path')
    .eq('id', employeeId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (!atual) return { error: 'Cadastro não encontrado.' }

  // Documentos obrigatórios: enviados agora ou já existentes no cadastro
  const enviado = (key: string) => { const f = fd.get(`doc_${key}`) as File | null; return !!f && f.size > 0 }
  const faltando = docsObrigatorios(atual.tipo_contrato as string | null)
    .filter((d) => !enviado(d.key) && !(atual as Record<string, unknown>)[`doc_${d.key}_path`])
  if (faltando.length) return { error: `Envie: ${faltando.map((d) => d.label).join(', ')}.` }

  const arquivos: Record<string, string> = {}
  for (const key of DOC_KEYS) {
    const file = fd.get(`doc_${key}`) as File | null
    if (!file || file.size === 0) continue
    if (file.size > MAX_DOC_SIZE) return { error: `"${file.name}" excede 20 MB.` }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const path = `funcionarios/${companyId}/${employeeId}/${key}_${Date.now()}.${ext}`
    const { error } = await admin.storage.from(BUCKET).upload(path, await file.arrayBuffer(), {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
    if (error) return { error: `Erro no envio de "${file.name}": ${error.message}` }
    arquivos[coluna(key)] = path
  }

  const { error } = await admin.from('employees').update({ ...campos, ...arquivos }).eq('id', employeeId).eq('company_id', companyId)
  if (error) return { error: error.message }

  // Registro no histórico (a ficha usa para saber que os dados foram preenchidos)
  const quem = { id: autor?.id ?? null, nome: autor?.nome ?? (atual.nome as string) }
  const { data: cand } = await admin.from('job_applications').select('id').eq('employee_id', employeeId).maybeSingle()
  await admin.from('admission_notes').insert({
    company_id: companyId,
    employee_id: employeeId,
    application_id: cand?.id ?? null,
    texto: autor ? 'Dados e documentos preenchidos no painel.' : 'Dados e documentos preenchidos pelo candidato.',
    tipo: 'evento',
    autor_id: quem.id,
    autor_nome: quem.nome,
  })

  // Ainda na etapa da carta (dados preenchidos antes do aceite): o card segue para a próxima etapa ativa
  if (atual.admission_stage === ETAPA_CARTA) await seguirEtapa(admin, { companyId, employeeId, de: ETAPA_CARTA, autor: quem })
  return {}
}
