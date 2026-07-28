import { createAdminClient } from '@/lib/supabase/server'
import type { DreGrupo } from '../categorias/queries'

export type DRELinha = {
  categoria_id: string
  categoria_nome: string
  categoria_icone: string | null
  dre_grupo: DreGrupo
  total: number // sempre positivo; sinal semântico vem do grupo
}

export type DREData = {
  linhas: DRELinha[]
  sem_categoria: number // valor de tx sem categoria_id
  nao_classificado: number // valor de tx com categoria nao_classificado
}

export async function getDREData(
  companyId: string,
  startDate: string,
  endDate: string,
): Promise<DREData> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('transactions')
    .select(`
      tipo,
      valor,
      categoria:categoria_id (id, nome, icone, dre_grupo)
    `)
    .eq('company_id', companyId)
    .in('status', ['pago', 'conciliado'])
    .gte('data_competencia', startDate)
    .lte('data_competencia', endDate)

  if (error) throw error

  const map = new Map<string, DRELinha>()
  let semCategoria = 0
  let naoClassificado = 0

  for (const tx of data ?? []) {
    const cat = tx.categoria as unknown as { id: string; nome: string; icone: string | null; dre_grupo: DreGrupo } | null

    if (!cat) {
      semCategoria += tx.valor
      continue
    }

    if (cat.dre_grupo === 'nao_classificado') {
      naoClassificado += tx.valor
      continue
    }

    const existing = map.get(cat.id)
    if (existing) {
      existing.total += tx.valor
    } else {
      map.set(cat.id, {
        categoria_id:    cat.id,
        categoria_nome:  cat.nome,
        categoria_icone: cat.icone,
        dre_grupo:       cat.dre_grupo,
        total:           tx.valor,
      })
    }
  }

  return {
    linhas:          Array.from(map.values()),
    sem_categoria:   semCategoria,
    nao_classificado: naoClassificado,
  }
}
