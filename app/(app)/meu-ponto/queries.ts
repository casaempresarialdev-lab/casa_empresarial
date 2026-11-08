import { createAdminClient } from '@/lib/supabase/server'

export type HorariosPonto = {
  entrada: string | null
  saida_almoco: string | null
  retorno_almoco: string | null
  saida: string | null
}

export type AjustePonto = HorariosPonto & {
  id: string
  data: string
  motivo: string
  status: 'pendente' | 'aprovado' | 'recusado'
  resposta: string | null
  created_at: string
}

export type DiaPonto = { data: string; registro: HorariosPonto | null; ajuste: AjustePonto | null }

const COLS_HORARIOS = 'data, entrada, saida_almoco, retorno_almoco, saida'

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
    admin.from('time_records').select(COLS_HORARIOS).eq('company_id', companyId).eq('employee_id', employeeId).gte('data', inicio).lte('data', fim).order('created_at', { ascending: false }),
    admin.from('time_adjustments').select('*').eq('company_id', companyId).eq('employee_id', employeeId).gte('data', inicio).lte('data', fim).order('created_at', { ascending: false }),
  ])
  // Sem a tabela (migration 20261108000094 pendente) os horários continuam aparecendo
  if (error) console.error('[ponto] ajustes indisponíveis:', error.message)

  const dias: DiaPonto[] = []
  for (let d = ultimoDia; d >= 1; d--) {
    const data = `${prefixo}-${String(d).padStart(2, '0')}`
    if (data > hoje) continue
    dias.push({
      data,
      registro: ((registros ?? []) as (HorariosPonto & { data: string })[]).find((r) => r.data === data) ?? null,
      ajuste: ((ajustes ?? []) as AjustePonto[]).find((a) => a.data === data) ?? null,
    })
  }
  return dias
}
