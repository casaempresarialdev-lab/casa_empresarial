'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { DEFAULT_BRAND_COLOR } from '@/lib/theme'
import { requireGestor } from '@/lib/auth/gestor'
import { z } from 'zod'
import { GUIA_MAX_BYTES, GUIA_TIPOS, clinicaSchema, configAdmissaoSchema } from '@/lib/validations/admissao'
import { configRescisaoSchema } from '@/lib/validations/rescisao'
import { ETAPA_LABEL_MAX, isPersonalizada, montarEtapasDe, paraSalvarDe, type DefProcesso, type Etapa } from '@/lib/etapas-processo'
import { DEF_ADMISSAO } from '../pessoas/admissao/etapas'
import { getEtapasAdmissao } from '../pessoas/admissao/queries'
import { DEF_RESCISAO } from '../pessoas/rescisao/etapas'
import { getEtapasRescisao } from '../pessoas/rescisao/queries'
import { semAcesso } from '@/lib/auth/acesso'

type Admin = ReturnType<typeof createAdminClient>

/** Configurações de admissão da empresa */
export async function salvarConfigAdmissaoAction(companyId: string, data: unknown) {
  const negado = await semAcesso('sistema.configuracoes', companyId)
  if (negado) return negado

  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }

  const parsed = configAdmissaoSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { error } = await auth.admin.from('admission_settings').upsert({
    company_id: companyId,
    carta_assunto: parsed.data.carta_assunto,
    carta_modelo: parsed.data.carta_modelo,
    carta_validade_dias: Number(parsed.data.carta_validade_dias),
    reprovacao_notificar: parsed.data.reprovacao_notificar,
    reprovacao_assunto: parsed.data.reprovacao_assunto,
    reprovacao_modelo: parsed.data.reprovacao_modelo,
    exame_notificar: parsed.data.exame_notificar,
    exame_assunto: parsed.data.exame_assunto,
    exame_modelo: parsed.data.exame_modelo,
    exame_reprovacao_notificar: parsed.data.exame_reprovacao_notificar,
    exame_reprovacao_assunto: parsed.data.exame_reprovacao_assunto,
    exame_reprovacao_modelo: parsed.data.exame_reprovacao_modelo,
    updated_at: new Date().toISOString(),
  })
  if (error) return { error: error.message }

  revalidatePath('/configuracoes')
  revalidatePath('/pessoas/admissao')
  return { success: true as const }
}

// ── Etapas dos processos (admissão e rescisão) ───────────────────────────────

const etapasSchema = z.array(z.object({
  key: z.string().min(1).max(80),
  label: z.string().max(ETAPA_LABEL_MAX).optional(),
  ativo: z.boolean().optional(),
})).max(40)

/**
 * Etapas da empresa (admissão ou rescisão): as padrão só ativam ou inativam (a ordem é fixa); as personalizadas
 * entram em qualquer posição. Uma personalizada com alguém nela não pode ser excluída; etapa inativa com alguém
 * nela segue aparecendo no kanban até esvaziar.
 */
async function salvarEtapas(companyId: string, data: unknown, p: {
  def: DefProcesso
  anteriores: (companyId: string) => Promise<Etapa[]>
  /** Etapas personalizadas (entre as informadas) que ainda têm alguém */
  ocupadas: (admin: Admin, companyId: string, keys: string[]) => Promise<string[]>
  tabela: 'admission_settings' | 'termination_settings'
  rota: string
}) {
  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin } = auth
  const { def } = p

  const parsed = etapasSchema.safeParse(data)
  if (!parsed.success) return { error: 'Lista de etapas inválida.' }
  if (parsed.data.some((e) => isPersonalizada(e.key) && !e.label?.trim())) return { error: 'Dê um nome a cada etapa personalizada.' }
  if (parsed.data.some((e) => !isPersonalizada(e.key) && !def.etapas.some((x) => x.key === e.key))) return { error: 'Lista de etapas inválida.' }

  // Conferido no que veio (montarEtapasDe reativaria a reserva sozinho)
  if (!parsed.data.some((e) => e.key !== def.final && (isPersonalizada(e.key) || e.ativo !== false))) {
    return { error: 'Deixe pelo menos uma etapa ativa antes de "Finalizado".' }
  }
  const etapas = montarEtapasDe(def, parsed.data)
  const nomes = etapas.map((e) => e.label.toLocaleLowerCase('pt-BR'))
  if (new Set(nomes).size !== nomes.length) return { error: 'Há duas etapas com o mesmo nome.' }

  // Personalizada excluída com gente nela: o card ficaria sem etapa
  const removidas = (await p.anteriores(companyId)).filter((a) => !a.padrao && !etapas.some((e) => e.key === a.key))
  if (removidas.length) {
    const ocupadas = await p.ocupadas(admin, companyId, removidas.map((r) => r.key))
    const ocupada = removidas.find((r) => ocupadas.includes(r.key))
    if (ocupada) return { error: `Ainda há pessoas em "${ocupada.label}". Mova-as para outra etapa antes de excluir.` }
  }

  const { error } = await admin.from(p.tabela).upsert({
    company_id: companyId,
    etapas: paraSalvarDe(def, etapas),
    updated_at: new Date().toISOString(),
  })
  if (error) return { error: error.message }

  revalidatePath('/configuracoes')
  revalidatePath(p.rota, 'layout')
  return { success: true as const }
}

export async function salvarEtapasAdmissaoAction(companyId: string, data: unknown) {
  const negado = await semAcesso('sistema.configuracoes', companyId)
  if (negado) return negado

  return salvarEtapas(companyId, data, {
    def: DEF_ADMISSAO,
    anteriores: getEtapasAdmissao,
    ocupadas: async (admin, cid, keys) => {
      const { data: rows } = await admin.from('employees').select('admission_stage').eq('company_id', cid).eq('status', 'admissao').in('admission_stage', keys)
      return (rows ?? []).map((r) => r.admission_stage as string)
    },
    tabela: 'admission_settings',
    rota: '/pessoas/admissao',
  })
}

export async function salvarEtapasRescisaoAction(companyId: string, data: unknown) {
  const negado = await semAcesso('sistema.configuracoes', companyId)
  if (negado) return negado

  return salvarEtapas(companyId, data, {
    def: DEF_RESCISAO,
    anteriores: getEtapasRescisao,
    ocupadas: async (admin, cid, keys) => {
      const { data: rows } = await admin.from('employee_terminations').select('etapa').eq('company_id', cid).eq('status', 'em_andamento').in('etapa', keys)
      return (rows ?? []).map((r) => r.etapa as string)
    },
    tabela: 'termination_settings',
    rota: '/pessoas/rescisao',
  })
}

/** E-mail do exame demissional (as clínicas e a guia geral são as da admissão) */
export async function salvarConfigRescisaoAction(companyId: string, data: unknown) {
  const negado = await semAcesso('sistema.configuracoes', companyId)
  if (negado) return negado

  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }

  const parsed = configRescisaoSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { error } = await auth.admin.from('termination_settings').upsert({
    company_id: companyId,
    exame_notificar: parsed.data.exame_notificar,
    exame_assunto: parsed.data.exame_assunto,
    exame_modelo: parsed.data.exame_modelo,
    updated_at: new Date().toISOString(),
  })
  if (error) return { error: error.message }

  revalidatePath('/configuracoes')
  return { success: true as const }
}

// ── Exame admissional: clínicas e guias de encaminhamento ────────────────────

/** Confere o arquivo da guia e o grava no bucket privado "documentos" */
async function subirGuia(admin: Admin, companyId: string, file: File) {
  if (!GUIA_TIPOS.includes(file.type)) return { error: 'A guia precisa ser PDF, JPG ou PNG.' }
  if (file.size > GUIA_MAX_BYTES) return { error: 'A guia pode ter até 4 MB.' }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf'
  const path = `${companyId}/admissao/guias/${crypto.randomUUID()}.${ext}`
  const { error } = await admin.storage.from('documentos').upload(path, await file.arrayBuffer(), { contentType: file.type })
  if (error) return { error: `Não foi possível enviar a guia: ${error.message}` }
  return { path, nome: file.name }
}

async function apagarArquivo(admin: Admin, path: string | null | undefined) {
  if (path) await admin.storage.from('documentos').remove([path])
}

/** Cria ou edita uma clínica. A guia é opcional: sem ela, vale a guia geral. */
export async function salvarClinicaAction(companyId: string, clinicaId: string | null, formData: FormData) {
  const negado = await semAcesso('sistema.configuracoes', companyId)
  if (negado) return negado

  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin } = auth

  const parsed = clinicaSchema.safeParse({
    nome: formData.get('nome') ?? '',
    endereco: formData.get('endereco') ?? '',
    telefone: formData.get('telefone') ?? '',
    orientacoes: formData.get('orientacoes') ?? '',
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  let atual: { guia_path: string | null } | null = null
  if (clinicaId) {
    const { data } = await admin.from('admission_clinics').select('guia_path').eq('id', clinicaId).eq('company_id', companyId).eq('ativo', true).maybeSingle()
    if (!data) return { error: 'Esta clínica não existe mais.' }
    atual = data as { guia_path: string | null }
  }

  const campos: Record<string, string | null> = {
    nome: parsed.data.nome,
    endereco: parsed.data.endereco || null,
    telefone: parsed.data.telefone || null,
    orientacoes: parsed.data.orientacoes || null,
  }

  const arquivo = formData.get('guia') as File | null
  let novaGuia: string | null = null
  if (arquivo && arquivo.size > 0) {
    const r = await subirGuia(admin, companyId, arquivo)
    if ('error' in r) return { error: r.error }
    novaGuia = r.path
    campos.guia_path = r.path
    campos.guia_nome = r.nome
  } else if (formData.get('remover_guia') === 'true') {
    campos.guia_path = null
    campos.guia_nome = null
  }

  const { error } = clinicaId
    ? await admin.from('admission_clinics').update(campos).eq('id', clinicaId).eq('company_id', companyId)
    : await admin.from('admission_clinics').insert({ ...campos, company_id: companyId })
  if (error) {
    await apagarArquivo(admin, novaGuia)
    return { error: error.message }
  }
  // Guia trocada ou removida: o arquivo antigo sai do armazenamento
  if ('guia_path' in campos && atual?.guia_path) await apagarArquivo(admin, atual.guia_path)

  revalidatePath('/configuracoes')
  return { success: true as const }
}

/** Some da lista; os encaminhamentos já feitos guardam uma cópia dos dados da clínica */
export async function excluirClinicaAction(companyId: string, clinicaId: string) {
  const negado = await semAcesso('sistema.configuracoes', companyId)
  if (negado) return negado

  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin } = auth

  const { data } = await admin.from('admission_clinics').select('guia_path').eq('id', clinicaId).eq('company_id', companyId).eq('ativo', true).maybeSingle()
  if (!data) return { error: 'Esta clínica não existe mais.' }

  const { error } = await admin.from('admission_clinics').update({ ativo: false, guia_path: null, guia_nome: null }).eq('id', clinicaId).eq('company_id', companyId)
  if (error) return { error: error.message }
  await apagarArquivo(admin, data.guia_path as string | null)

  revalidatePath('/configuracoes')
  return { success: true as const }
}

/** Guia geral da empresa: enviada (com o arquivo) ou removida (sem ele) */
export async function salvarGuiaGeralAction(companyId: string, formData: FormData) {
  const negado = await semAcesso('sistema.configuracoes', companyId)
  if (negado) return negado

  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  const { admin } = auth

  const { data: atual } = await admin.from('admission_settings').select('exame_guia_path').eq('company_id', companyId).maybeSingle()

  const arquivo = formData.get('guia') as File | null
  let campos: { exame_guia_path: string | null; exame_guia_nome: string | null } = { exame_guia_path: null, exame_guia_nome: null }
  if (arquivo && arquivo.size > 0) {
    const r = await subirGuia(admin, companyId, arquivo)
    if ('error' in r) return { error: r.error }
    campos = { exame_guia_path: r.path, exame_guia_nome: r.nome }
  }

  // Sem configurações gravadas ainda: cria a linha (o restante usa o padrão do sistema)
  const { error } = atual
    ? await admin.from('admission_settings').update(campos).eq('company_id', companyId)
    : await admin.from('admission_settings').insert({ company_id: companyId, ...campos })
  if (error) {
    await apagarArquivo(admin, campos.exame_guia_path)
    return { error: error.message }
  }
  await apagarArquivo(admin, atual?.exame_guia_path as string | null | undefined)

  revalidatePath('/configuracoes')
  return { success: true as const }
}

/** Abre uma guia (da empresa ou de uma clínica dela) */
export async function getGuiaUrlAction(companyId: string, path: string) {
  const negado = await semAcesso('sistema.configuracoes', companyId)
  if (negado) return negado

  const auth = await requireGestor(companyId)
  if ('error' in auth) return { error: auth.error }
  if (!path.startsWith(`${companyId}/admissao/guias/`)) return { error: 'Arquivo não encontrado.' }
  const { data, error } = await auth.admin.storage.from('documentos').createSignedUrl(path, 300)
  if (error || !data) return { error: 'Não foi possível abrir a guia.' }
  return { url: data.signedUrl }
}

// Sobe a imagem para o bucket "logos" e devolve a URL pública. O ?v= evita que o
// navegador continue mostrando a versão antiga (o caminho do arquivo é sempre o mesmo).
async function uploadLogo(admin: Admin, companyId: string, file: File, name: string) {
  const ext = file.name.split('.').pop() || 'png'
  const path = `${companyId}/${name}.${ext}`
  const bytes = await file.arrayBuffer()
  const { error } = await admin.storage
    .from('logos')
    .upload(path, bytes, { contentType: file.type, upsert: true })
  if (error) return { error: error.message }
  const { data } = admin.storage.from('logos').getPublicUrl(path)
  return { url: `${data.publicUrl}?v=${Date.now()}` }
}

// PNG com canal de transparência: tipo de cor 4/6 (com alfa) no IHDR, ou chunk tRNS
function isPngWithAlpha(bytes: Uint8Array) {
  const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length < 33 || !PNG_SIGNATURE.every((b, i) => bytes[i] === b)) return false
  const colorType = bytes[25] // 8 (assinatura) + 4 (tamanho) + 4 ("IHDR") + 4 (largura) + 4 (altura) + 1 (profundidade)
  if (colorType === 4 || colorType === 6) return true
  for (let i = 33; i < bytes.length - 4; i++) {
    if (bytes[i] === 0x74 && bytes[i + 1] === 0x52 && bytes[i + 2] === 0x4e && bytes[i + 3] === 0x53) return true // "tRNS"
    if (bytes[i] === 0x49 && bytes[i + 1] === 0x44 && bytes[i + 2] === 0x41 && bytes[i + 3] === 0x54) return false // "IDAT": tRNS viria antes
  }
  return false
}

export async function updateIdentidadeVisualAction(companyId: string, formData: FormData) {
  const negado = await semAcesso('sistema.configuracoes', companyId)
  if (negado) return negado

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()

  // Logo completa (logo_url), reduzida (logo_reduzida_url) e ícone (icone_url — só PNG transparente)
  const logos = [
    { field: 'logo_url',          file: 'logo_file',          remove: 'remove_logo',          name: 'logo',          pngOnly: false },
    { field: 'logo_reduzida_url', file: 'logo_reduzida_file', remove: 'remove_logo_reduzida', name: 'logo-reduzida', pngOnly: false },
    { field: 'icone_url',         file: 'icone_file',         remove: 'remove_icone',         name: 'icone',         pngOnly: true },
  ] as const

  // Valida tudo antes de gravar qualquer coisa
  for (const l of logos) {
    const file = formData.get(l.file) as File | null
    if (l.pngOnly && file && file.size > 0 && !isPngWithAlpha(new Uint8Array(await file.arrayBuffer()))) {
      return { error: 'O ícone precisa ser um PNG com fundo transparente.' }
    }
  }

  const corPrimaria = (formData.get('cor_primaria') as string) || DEFAULT_BRAND_COLOR

  // cor_fundo só vem quando a coluna existe (a tela não envia antes da migration 20261023000055)
  const corFundo = formData.get('cor_fundo') as string | null
  if (corFundo !== null && !/^#[0-9a-fA-F]{6}$/.test(corFundo)) return { error: 'Cor de fundo inválida.' }

  const { error } = await admin
    .from('companies')
    .update({ cor_primaria: corPrimaria, ...(corFundo !== null ? { cor_fundo: corFundo } : {}) })
    .eq('id', companyId)

  if (error) return { error: error.message }

  for (const l of logos) {
    if (formData.get(l.remove) === 'true') {
      const { error: removeErr } = await admin.from('companies').update({ [l.field]: null }).eq('id', companyId)
      if (removeErr) return { error: removeErr.message }
    }

    const file = formData.get(l.file) as File | null
    if (file && file.size > 0) {
      const uploaded = await uploadLogo(admin, companyId, file, l.name)
      if ('error' in uploaded) return { error: `Erro ao enviar a imagem: ${uploaded.error}` }
      const { error: updateErr } = await admin.from('companies').update({ [l.field]: uploaded.url }).eq('id', companyId)
      if (updateErr) return { error: updateErr.message }
    }
  }

  revalidatePath('/configuracoes')
  return { success: true }
}
