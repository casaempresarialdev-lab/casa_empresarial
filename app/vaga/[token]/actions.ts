'use server'

import { randomUUID } from 'crypto'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { ANEXO_MAX_BYTES, ANEXO_TIPOS, candidaturaSchema, extensaoAnexo } from '@/lib/validations/vaga'

const BUCKET = 'documentos'
// Por IP, por vaga e por hora (redes compartilhadas têm vários candidatos no mesmo IP)
const MAX_POR_HORA = 20

type Arquivo = { nome: string; tamanho: number }
type Admin = ReturnType<typeof createAdminClient>

async function ipDoCliente() {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null
}

/** Vaga que ainda aceita candidaturas */
async function vagaAberta(admin: Admin, token: string) {
  const { data: vaga } = await admin
    .from('job_openings')
    .select('id, company_id, status, data_limite')
    .eq('token', token)
    .maybeSingle()

  if (!vaga || vaga.status !== 'aberta') return null
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  if (vaga.data_limite && vaga.data_limite < hoje) return null
  return vaga as { id: string; company_id: string }
}

const ENCERRADA = 'Esta vaga não está mais recebendo candidaturas.'

/**
 * Primeira parte do envio: valida os dados e devolve a autorização para enviar o anexo direto ao armazenamento
 * (arquivos grandes passariam do limite de envio da Vercel se viessem pelo servidor).
 * CPF repetido na mesma vaga responde como enviado: a página pública não revela quem já se candidatou.
 */
export async function iniciarCandidaturaAction(token: string, dados: unknown, arquivo: Arquivo) {
  const parsed = candidaturaSchema.safeParse(dados)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  // Robô preencheu o campo escondido: responde como enviado, sem gravar
  if (parsed.data.site) return { jaEnviada: true as const }

  const ext = extensaoAnexo(arquivo.nome)
  if (!ext) return { error: 'Envie o anexo em PDF, Word ou imagem (JPG, PNG ou WEBP).' }
  if (arquivo.tamanho <= 0 || arquivo.tamanho > ANEXO_MAX_BYTES) return { error: 'O anexo precisa ter até 10 MB.' }

  const admin = createAdminClient()
  const vaga = await vagaAberta(admin, token)
  if (!vaga) return { error: ENCERRADA }

  const cpf = parsed.data.cpf.replace(/\D/g, '')
  const { data: repetida } = await admin
    .from('job_applications').select('id').eq('vaga_id', vaga.id).eq('cpf', cpf).maybeSingle()
  if (repetida) return { jaEnviada: true as const }

  const ip = await ipDoCliente()
  if (ip) {
    const umaHoraAtras = new Date(Date.now() - 3_600_000).toISOString()
    const { count } = await admin
      .from('job_applications')
      .select('id', { count: 'exact', head: true })
      .eq('vaga_id', vaga.id)
      .eq('aceite_ip', ip)
      .gte('created_at', umaHoraAtras)
    if ((count ?? 0) >= MAX_POR_HORA) return { error: 'Muitos envios em pouco tempo. Tente novamente mais tarde.' }
  }

  const path = `candidaturas/${vaga.company_id}/${vaga.id}/${randomUUID()}.${ext}`
  const { data: upload, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error || !upload) return { error: 'Não foi possível preparar o envio do anexo. Tente novamente.' }

  return { path, uploadToken: upload.token, contentType: ANEXO_TIPOS[ext] }
}

/** Segunda parte: com o anexo no armazenamento, confere o arquivo e grava a candidatura */
export async function concluirCandidaturaAction(token: string, dados: unknown, path: string, nomeArquivo: string) {
  const parsed = candidaturaSchema.safeParse(dados)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const admin = createAdminClient()
  const vaga = await vagaAberta(admin, token)
  if (!vaga) return { error: ENCERRADA }

  // O caminho volta do navegador: precisa ser desta vaga e no formato gerado na primeira parte
  const prefixo = `candidaturas/${vaga.company_id}/${vaga.id}/`
  const nome = path.startsWith(prefixo) ? path.slice(prefixo.length) : ''
  if (!/^[0-9a-f-]{36}\.[a-z]+$/.test(nome)) return { error: 'Envio inválido. Tente novamente.' }
  const ext = extensaoAnexo(nome)
  if (!ext) return { error: 'Envio inválido. Tente novamente.' }

  // O tamanho declarado antes não garante o tamanho enviado
  const { data: lista } = await admin.storage.from(BUCKET).list(prefixo.slice(0, -1), { search: nome, limit: 1 })
  const enviado = lista?.find((f) => f.name === nome)
  if (!enviado) return { error: 'O anexo não chegou. Tente enviar novamente.' }
  if (Number(enviado.metadata?.size ?? 0) > ANEXO_MAX_BYTES) {
    await admin.storage.from(BUCKET).remove([path])
    return { error: 'O anexo precisa ter até 10 MB.' }
  }

  const { error } = await admin.from('job_applications').insert({
    company_id: vaga.company_id,
    vaga_id: vaga.id,
    nome: parsed.data.nome.replace(/\s+/g, ' '),
    cpf: parsed.data.cpf.replace(/\D/g, ''),
    email: parsed.data.email,
    telefone: parsed.data.telefone,
    anexo_path: path,
    anexo_nome: nomeArquivo.slice(0, 200),
    anexo_tipo: ANEXO_TIPOS[ext],
    aceite_ip: await ipDoCliente(),
  })

  if (error) {
    await admin.storage.from(BUCKET).remove([path])
    // Dois envios simultâneos do mesmo CPF: o primeiro vale
    if (error.code === '23505') return { success: true as const }
    return { error: 'Não foi possível enviar a candidatura. Tente novamente.' }
  }
  return { success: true as const }
}
