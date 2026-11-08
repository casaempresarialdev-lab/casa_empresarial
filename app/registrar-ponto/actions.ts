'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { semAcesso } from '@/lib/auth/acesso'
import { verifySecurityPin } from '@/lib/security-pin'
import { minutosDeEspera } from '@/lib/ponto'

export type TipoBatida = 'entrada' | 'saida_almoco' | 'retorno_almoco' | 'saida'

const TIPOS: TipoBatida[] = ['entrada', 'saida_almoco', 'retorno_almoco', 'saida']

// Id do recibo: o id do registro do dia (único) + a batida, que só acontece uma vez em cada registro
const SUFIXO_RECIBO: Record<TipoBatida, string> = { entrada: 'ENT', saida_almoco: 'ALM', retorno_almoco: 'RET', saida: 'SAI' }

/** Dia de hoje no Brasil (o servidor roda em UTC) */
const hojeBrasil = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d)

/**
 * Bate o ponto do usuário logado, confirmado com o PIN de segurança da conta dele.
 * Quem é o funcionário vem da sessão, nunca da tela.
 */
export async function baterPontoAction(
  pin: string,
  dados: { tipo: TipoBatida; lat: number | null; lng: number | null; endereco: string | null },
): Promise<{ success: true; tipo: TipoBatida; em: string; id: string } | { error: string }> {
  const negado = await semAcesso('visao-geral.bater-ponto')
  if (negado) return negado

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessão inválida. Faça login novamente.' }
  if (!TIPOS.includes(dados.tipo)) return { error: 'Ação inválida.' }

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
  const { tipo } = dados
  const localizacao = dados.lat && dados.lng ? { lat: dados.lat, lng: dados.lng, endereco: dados.endereco } : null

  const { data: registro } = await admin
    .from('time_records')
    .select('id, entrada, saida_almoco, retorno_almoco, saida')
    .eq('company_id', companyId)
    .eq('employee_id', funcionario.id)
    .eq('data', hoje)
    .maybeSingle()

  // Evita registros repetidos
  const espera = minutosDeEspera([registro?.entrada, registro?.saida_almoco, registro?.retorno_almoco, registro?.saida], agora)
  if (espera > 0) return { error: `Aguarde ${espera} ${espera === 1 ? 'minuto' : 'minutos'} para registrar de novo.` }

  let registroId: string
  if (tipo === 'entrada') {
    if (registro?.entrada) return { error: 'Entrada já registrada hoje.' }
    const { data: novo, error } = await admin.from('time_records').insert({
      company_id: companyId, employee_id: funcionario.id, data: hoje, entrada: ts, tipo: 'normal', localizacao,
    }).select('id').single()
    if (error || !novo) return { error: error?.message ?? 'Não foi possível registrar o ponto.' }
    registroId = novo.id as string
  } else {
    if (!registro?.entrada) return { error: 'Registre a entrada primeiro.' }
    if (tipo === 'saida_almoco' && registro.saida_almoco) return { error: 'Saída do almoço já registrada.' }
    if (tipo === 'retorno_almoco' && !registro.saida_almoco) return { error: 'Registre a saída do almoço primeiro.' }
    if (tipo === 'retorno_almoco' && registro.retorno_almoco) return { error: 'Retorno do almoço já registrado.' }
    if (tipo === 'saida' && registro.saida) return { error: 'Saída já registrada hoje.' }

    const { error } = await admin.from('time_records').update({ [tipo]: ts, localizacao }).eq('id', registro.id)
    if (error) return { error: error.message }
    registroId = registro.id as string
  }

  revalidatePath('/registrar-ponto')
  revalidatePath('/pessoas/registro-de-ponto')
  return { success: true, tipo, em: ts, id: `${registroId}-${SUFIXO_RECIBO[tipo]}`.toUpperCase() }
}
