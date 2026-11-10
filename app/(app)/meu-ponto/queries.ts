import { createAdminClient } from '@/lib/supabase/server'
import { generateMonth } from '@/lib/escala/generate'
import { getEmployeeScheduleRules, getFeriadosEmpresa, getScheduleExceptionsEntre } from '../pessoas/escala-de-trabalho/queries'
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

/** O que a área de Pessoas registrou no dia: abono, férias, falta ou folga */
export type MarcacaoDia = { tipo: string; texto: string; detalhe: string | null }

const MARCACOES: Record<string, string> = { atestado: 'Abonado', ferias: 'Férias', falta: 'Falta', folga: 'Folga' }

/** O que a escala prevê para o dia */
export type EscalaDia = { folga: boolean; feriado: string | null; previsto: string | null }

export type DiaPonto = { data: string; horarios: string[]; marcacao: MarcacaoDia | null; escala: EscalaDia; ajuste: AjustePonto | null }

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

export type MinhaAusencia = {
  id: string
  tipo: string
  data_inicio: string
  data_fim: string
  motivo: string | null
  status: 'pendente' | 'abonado' | 'recusado'
  resposta: string | null
}

/** Atestados e ausências da própria pessoa (sem a migration 20261109000099: nenhum) */
export async function getMinhasAusencias(companyId: string, employeeId: string): Promise<MinhaAusencia[]> {
  const { data, error } = await createAdminClient()
    .from('time_absences')
    .select('id, tipo, data_inicio, data_fim, motivo, status, resposta')
    .eq('company_id', companyId)
    .eq('employee_id', employeeId)
    .order('data_inicio', { ascending: false })
    .limit(20)
  if (error) { console.error('[ponto] ausências indisponíveis:', error.message); return [] }
  return (data ?? []) as MinhaAusencia[]
}

/** Todos os dias do mês, em ordem, com as batidas, o que a área de Pessoas marcou e o último pedido de ajuste de cada um */
export async function getDiasDoPonto(companyId: string, employeeId: string, ano: number, mes: number): Promise<DiaPonto[]> {
  const admin = createAdminClient()
  const prefixo = `${ano}-${String(mes).padStart(2, '0')}`
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  const inicio = `${prefixo}-01`
  const fim = `${prefixo}-${String(ultimoDia).padStart(2, '0')}`
  const [{ data: registros }, { data: ajustes, error }, regras, excecoes, feriados] = await Promise.all([
    admin.from('time_records').select('data, batidas, tipo, observacao').eq('company_id', companyId).eq('employee_id', employeeId).gte('data', inicio).lte('data', fim).order('created_at', { ascending: false }),
    // Sem a coluna origem: localização e IP só aparecem para quem aprova
    admin.from('time_adjustments').select('id, data, batidas, motivo, status, resposta, created_at').eq('company_id', companyId).eq('employee_id', employeeId).gte('data', inicio).lte('data', fim).order('created_at', { ascending: false }),
    getEmployeeScheduleRules(companyId, employeeId),
    getScheduleExceptionsEntre(companyId, inicio, fim),
    getFeriadosEmpresa(companyId),
  ])
  // Sem a tabela (migration 20261108000094 pendente) os horários continuam aparecendo
  if (error) console.error('[ponto] ajustes indisponíveis:', error.message)

  // Folgas e feriados da escala (inclui as trocas avulsas e os feriados da empresa)
  const escala = new Map(generateMonth(regras, excecoes, mes, ano, employeeId, feriados).map((d) => [d.date, d]))

  // O mês inteiro, inclusive os dias que ainda não chegaram (abonos e férias já aparecem)
  type Registro = { data: string; batidas: Batida[]; tipo: string | null; observacao: string | null }
  const dias: DiaPonto[] = []
  for (let d = 1; d <= ultimoDia; d++) {
    const data = `${prefixo}-${String(d).padStart(2, '0')}`
    const registro = ((registros ?? []) as Registro[]).find((r) => r.data === data)
    const marcacao = registro?.tipo && MARCACOES[registro.tipo] ? { tipo: registro.tipo, texto: MARCACOES[registro.tipo], detalhe: registro.observacao } : null
    dias.push({
      data,
      // Só os horários: a origem das batidas não vai para a tela do colaborador
      horarios: (registro?.batidas ?? []).map((b) => b.em),
      marcacao,
      escala: {
        folga: escala.get(data)?.tipo === 'folga',
        feriado: escala.get(data)?.feriado_nome ?? null,
        previsto: escala.get(data)?.tipo === 'trabalho' && escala.get(data)?.hora_entrada
          ? `${escala.get(data)!.hora_entrada!.slice(0, 5)}–${escala.get(data)!.hora_saida?.slice(0, 5) ?? '?'}`
          : null,
      },
      ajuste: ((ajustes ?? []) as AjustePonto[]).find((a) => a.data === data) ?? null,
    })
  }
  return dias
}
