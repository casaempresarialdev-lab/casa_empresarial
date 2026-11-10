'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { semAcesso } from '@/lib/auth/acesso'
import { verifySecurityPin } from '@/lib/security-pin'
import { minutosDeEspera, type Batida, type LocalBatida } from '@/lib/ponto'
import { origemDaRequisicao } from '@/lib/ponto-servidor'

// Lançados pelo responsável: o dia não é de trabalho, a menos que ele altere o lançamento.
// Dia abonado (atestado ou ausência) não entra aqui: a pessoa pode trabalhar parte do dia.
const DIA_SEM_PONTO: Record<string, string> = { falta: 'falta', ferias: 'férias', folga: 'folga' }

/** Dia de hoje no Brasil (o servidor roda em UTC) */
const hojeBrasil = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d)

/**
 * Bate o ponto do usuário logado, confirmado com o PIN de segurança da conta dele.
 * Quem é o funcionário vem da sessão, nunca da tela.
 */
export async function baterPontoAction(
  pin: string,
  local: LocalBatida,
): Promise<{ success: true; em: string; id: string } | { error: string }> {
  const negado = await semAcesso('visao-geral.bater-ponto')
  if (negado) return negado

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessão inválida. Faça login novamente.' }

  const check = await verifySecurityPin(user.id, pin)
  if (!check.ok) return { error: check.error }

  const companyId = (await cookies()).get('active_company_id')?.value
  if (!companyId) return { error: 'Selecione uma empresa.' }

  const admin = createAdminClient()
  const { data: funcionario } = await admin
    .from('employees')
    .select('id')
    .eq('company_id', companyId)
    .eq('profile_id', user.id)
    .eq('pin_ativo', true)
    .not('status', 'in', '(inativo,demitido)')
    .limit(1)
    .maybeSingle()
  if (!funcionario) return { error: 'Seu cadastro não está liberado para registrar ponto.' }

  const agora = new Date()
  const hoje = hojeBrasil(agora)
  const ts = agora.toISOString()
  const nova: Batida = { em: ts, origem: await origemDaRequisicao(local, ts) }

  const { data: registro } = await admin
    .from('time_records')
    .select('id, batidas, tipo')
    .eq('company_id', companyId)
    .eq('employee_id', funcionario.id)
    .eq('data', hoje)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Evita registros repetidos
  const anteriores = (registro?.batidas ?? []) as Batida[]
  const espera = minutosDeEspera(anteriores.map((b) => b.em), agora)
  if (espera > 0) return { error: `Aguarde ${espera} ${espera === 1 ? 'minuto' : 'minutos'} para registrar de novo.` }
  if (registro && !anteriores.length && DIA_SEM_PONTO[registro.tipo as string]) {
    return { error: `Este dia foi lançado como ${DIA_SEM_PONTO[registro.tipo as string]}. Fale com o responsável.` }
  }

  // Em ordem: um lançamento manual pode ter deixado horários mais tarde que agora
  const batidas = [...anteriores, nova].sort((a, b) => Date.parse(a.em) - Date.parse(b.em))
  let registroId: string
  if (registro) {
    const { error } = await admin.from('time_records').update({ batidas }).eq('id', registro.id)
    if (error) return { error: error.message }
    registroId = registro.id as string
  } else {
    const { data: novo, error } = await admin.from('time_records').insert({
      company_id: companyId, employee_id: funcionario.id, data: hoje, tipo: 'normal', batidas,
    }).select('id').single()
    if (error || !novo) return { error: error?.message ?? 'Não foi possível registrar o ponto.' }
    registroId = novo.id as string
  }

  revalidatePath('/registrar-ponto')
  revalidatePath('/pessoas/registro-de-ponto')
  // Id do recibo: o id do registro do dia + o número da batida
  return { success: true, em: ts, id: `${registroId}-${String(batidas.length).padStart(2, '0')}`.toUpperCase() }
}
