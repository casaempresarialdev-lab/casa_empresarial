'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { semAcesso } from '@/lib/auth/acesso'
import { configFolhaSchema } from '@/lib/validations/folha'
import { configFeriasSchema } from '@/lib/validations/ferias'

/** Só as regras de férias: as demais colunas da folha ficam como estão */
export async function salvarConfigFeriasAction(companyId: string, data: unknown) {
  const negado = await semAcesso('sistema.configuracoes', companyId)
  if (negado) return negado

  const parsed = configFeriasSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { error } = await createAdminClient().from('payroll_settings').upsert({ company_id: companyId, ...parsed.data, updated_at: new Date().toISOString() }, { onConflict: 'company_id' })
  if (error) return { error: error.message }

  revalidatePath('/configuracoes')
  revalidatePath('/pessoas/ferias')
  revalidatePath('/minhas-ferias')
  return { success: true as const }
}

export async function salvarConfigFolhaAction(companyId: string, data: unknown) {
  const negado = await semAcesso('sistema.configuracoes', companyId)
  if (negado) return negado

  const parsed = configFolhaSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { modo_periodo, dia_corte, holerite_modo, ...resto } = parsed.data

  const { error } = await createAdminClient().from('payroll_settings').upsert({
    company_id: companyId,
    ...resto,
    dia_corte: modo_periodo === 'corte' ? dia_corte : null,
    holerite_ativo: holerite_modo !== 'nao',
    holerite_fonte: holerite_modo === 'arquivo' ? 'arquivo' : 'sistema',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'company_id' })
  if (error) return { error: error.code === 'PGRST204' ? 'Execute a migration 20261110000102 para salvar as novas regras da folha.' : error.message }

  revalidatePath('/configuracoes')
  revalidatePath('/pessoas/folha-de-pagamento')
  revalidatePath('/meu-holerite')
  return { success: true as const }
}
