'use server'

import { cookies } from 'next/headers'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { semAcesso } from '@/lib/auth/acesso'
import { getConfigFolha } from '../pessoas/folha-de-pagamento/queries'

/** Abre o PDF enviado pela contabilidade, se for do próprio colaborador */
export async function urlMeuHoleriteAction(id: string) {
  const negado = await semAcesso('visao-geral.bater-ponto')
  if (negado) return negado
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessão inválida. Faça login novamente.' }
  const companyId = (await cookies()).get('active_company_id')?.value
  if (!companyId) return { error: 'Selecione uma empresa.' }

  const config = await getConfigFolha(companyId)
  if (!config.holerite_ativo || config.holerite_fonte !== 'arquivo') return { error: 'A empresa não disponibiliza o holerite por aqui.' }

  const admin = createAdminClient()
  const { data: ficha } = await admin.from('employees').select('id').eq('company_id', companyId).eq('profile_id', user.id).limit(1).maybeSingle()
  if (!ficha) return { error: 'Seu usuário não está ligado a uma ficha da Equipe.' }
  const { data } = await admin.from('payroll_documents').select('arquivo_path').eq('id', id).eq('company_id', companyId).eq('employee_id', ficha.id).maybeSingle()
  if (!data) return { error: 'Arquivo não encontrado.' }
  const { data: url } = await admin.storage.from('documentos').createSignedUrl(data.arquivo_path as string, 300)
  return url ? { url: url.signedUrl } : { error: 'Não foi possível abrir o arquivo.' }
}
