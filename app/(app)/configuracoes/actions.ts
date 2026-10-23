'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { DEFAULT_BRAND_COLOR } from '@/lib/theme'

type Admin = ReturnType<typeof createAdminClient>

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
