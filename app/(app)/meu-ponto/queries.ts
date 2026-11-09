import { createAdminClient } from '@/lib/supabase/server'
import type { Batida } from '@/lib/ponto'

export type AjustePonto = {
  id: string
  data: string
  batidas: string[]
  motivo: string
  status: 'pendente' | 'aprovado' | 'recusado'
  resposta: string | null
  created_at: string
}

export type DiaPonto = { data: string; horarios: string[]; ajuste: AjustePonto | null }

export const hojeBrasil = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

/** Ficha do usuário logado nesta empresa, liberada para registrar ponto */
export async function getFichaDoPonto(companyId: string, profileId: string) {
  const { data } = await createAdminClient()
    .from('employees')
    .select('id, nome, pin_ativo')
    .eq('company_id', companyId)
    .eq('profile_id', profileId)
    .not('status', 'in', '(inativo,demitido)')
    .limit(1)
    .maybeSingle()
  return data as { id: string; nome: string; pin_ativo: boolean } | null
}

/** Os dias do mês até hoje, do mais recente para o mais antigo, com o registro e o último pedido de ajuste de cada um */
export async function getDiasDoPonto(companyId: string, employeeId: string, ano: number, mes: number): Promise<DiaPonto[]> {
  const admin = createAdminClient()
  const prefixo = `${ano}-${String(mes).padStart(2, '0')}`
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  const inicio = `${prefixo}-01`
  const fim = `${prefixo}-${String(ultimoDia).padStart(2, '0')}`
  const hoje = hojeBrasil()

  const [{ data: registros }, { data: ajustes, error }] = await Promise.all([
    admin.from('time_records').select('data, batidas').eq('company_id', companyId).eq('employee_id', employeeId).gte('data', inicio).lte('data', fim).order('created_at', { ascending: false }),
    // Sem a coluna origem: localização e IP só aparecem para quem aprova
    admin.from('time_adjustments').select('id, data, batidas, motivo, status, resposta, created_at').eq('company_id', companyId).eq('employee_id', employeeId).gte('data', inicio).lte('data', fim).order('created_at', { ascending: false }),
  ])
  // Sem a tabela (migration 20261108000094 pendente) os horários continuam aparecendo
  if (error) console.error('[ponto] ajustes indisponíveis:', error.message)

  const dias: DiaPonto[] = []
  for (let d = ultimoDia; d >= 1; d--) {
    const data = `${prefixo}-${String(d).padStart(2, '0')}`
    if (data > hoje) continue
    // Só os horários: a origem das batidas não vai para a tela do colaborador
    const registro = ((registros ?? []) as { data: string; batidas: Batida[] }[]).find((r) => r.data === data)
    dias.push({
      data,
      horarios: (registro?.batidas ?? []).map((b) => b.em),
      ajuste: ((ajustes ?? []) as AjustePonto[]).find((a) => a.data === data) ?? null,
    })
  }
  return dias
}
