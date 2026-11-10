'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/auth/viewer'
import { semAcesso } from '@/lib/auth/acesso'
import { notificarFuncionario } from '@/lib/notificacoes'
import { ROTULO_DOCUMENTO, TIPOS_DOCUMENTO, type TipoDocumento } from '@/lib/folha/documentos'
import { rotuloMesAno } from './recibos'

// Holerites em PDF enviados pela contabilidade: quem tem acesso à Folha envia; o colaborador vê em Meu holerite

const MAX_BYTES = 10 * 1024 * 1024
const RE_MES_ANO = /^\d{4}-(0[1-9]|1[0-2])$/

async function autor(companyId: string) {
  const negado = await semAcesso('pessoas.folha-de-pagamento', companyId)
  if (negado) return negado
  const viewer = await getViewerContext(companyId)
  if (viewer?.isColaborador) return { error: 'Sem permissão para esta ação.' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const { data } = await createAdminClient().from('profiles').select('name').eq('id', user.id).maybeSingle()
  return { id: user.id, nome: (data?.name as string | undefined) ?? 'Usuário' }
}

export async function enviarHoleriteAction(companyId: string, formData: FormData) {
  const quem = await autor(companyId)
  if ('error' in quem) return quem

  const employeeId = String(formData.get('employee_id') ?? '')
  const competencia = String(formData.get('competencia') ?? '')
  const tipo = String(formData.get('tipo') ?? 'mensal') as TipoDocumento
  const arquivo = formData.get('arquivo') as File | null
  if (!RE_MES_ANO.test(competencia)) return { error: 'Competência inválida.' }
  if (!TIPOS_DOCUMENTO.includes(tipo)) return { error: 'Escolha o tipo do holerite.' }
  if (!arquivo || arquivo.size === 0) return { error: 'Escolha o arquivo do holerite.' }
  if (arquivo.type !== 'application/pdf') return { error: 'O holerite precisa ser um PDF.' }
  if (arquivo.size > MAX_BYTES) return { error: 'O arquivo pode ter até 10 MB.' }

  const admin = createAdminClient()
  const { data: funcionario } = await admin.from('employees').select('id').eq('id', employeeId).eq('company_id', companyId).maybeSingle()
  if (!funcionario) return { error: 'Funcionário não encontrado.' }

  const path = `funcionarios/${companyId}/${employeeId}/holerite_${competencia}_${tipo}_${Date.now()}.pdf`
  const { error: erroUp } = await admin.storage.from('documentos').upload(path, await arquivo.arrayBuffer(), { contentType: 'application/pdf' })
  if (erroUp) return { error: `Não foi possível enviar o arquivo: ${erroUp.message}` }

  const { error } = await admin.from('payroll_documents').insert({
    company_id: companyId, employee_id: employeeId, competencia, tipo, arquivo_path: path, arquivo_nome: arquivo.name.slice(0, 200), enviado_por_nome: quem.nome,
  })
  if (error) {
    await admin.storage.from('documentos').remove([path])
    return { error: ['42P01', 'PGRST205'].includes(error.code) ? 'Execute a migration 20261110000102 para enviar holerites.' : error.message }
  }

  await notificarFuncionario(admin, {
    companyId, employeeId, autorId: quem.id, tipo: 'folha',
    titulo: 'Holerite disponível', mensagem: `${ROTULO_DOCUMENTO[tipo]} de ${rotuloMesAno(competencia)} já está em Meu holerite.`, link: '/meu-holerite',
  })

  revalidatePath('/pessoas/folha-de-pagamento')
  revalidatePath('/meu-holerite')
  return { success: true as const }
}

export async function removerHoleriteAction(companyId: string, id: string) {
  const quem = await autor(companyId)
  if ('error' in quem) return quem
  const admin = createAdminClient()
  const { data } = await admin.from('payroll_documents').delete().eq('id', id).eq('company_id', companyId).select('arquivo_path').maybeSingle()
  if (!data) return { error: 'Arquivo não encontrado.' }
  await admin.storage.from('documentos').remove([data.arquivo_path as string])
  revalidatePath('/pessoas/folha-de-pagamento')
  revalidatePath('/meu-holerite')
  return { success: true as const }
}

export async function urlHoleriteEnviadoAction(companyId: string, id: string) {
  const quem = await autor(companyId)
  if ('error' in quem) return quem
  const admin = createAdminClient()
  const { data } = await admin.from('payroll_documents').select('arquivo_path').eq('id', id).eq('company_id', companyId).maybeSingle()
  if (!data) return { error: 'Arquivo não encontrado.' }
  const { data: url } = await admin.storage.from('documentos').createSignedUrl(data.arquivo_path as string, 300)
  return url ? { url: url.signedUrl } : { error: 'Não foi possível abrir o arquivo.' }
}
