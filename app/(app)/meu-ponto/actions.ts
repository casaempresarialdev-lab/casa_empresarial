'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { semAcesso } from '@/lib/auth/acesso'
import type { LocalBatida } from '@/lib/ponto'
import { gravarAusencia } from '@/lib/ponto-marcacao'
import { notificarGestores, periodoTexto } from '@/lib/notificacoes'
import { rotuloAusencia } from '@/lib/validations/ausencias'
import { origemDaRequisicao } from '@/lib/ponto-servidor'
import { ajustePontoSchema, horaParaTimestamp } from '@/lib/validations/ponto'
import { getFichaDoPonto, hojeBrasil } from './queries'

/** Atestado ou ausência informado pela própria pessoa: fica em análise até alguém da área de Pessoas abonar */
export async function informarAusenciaAction(formData: FormData) {
  const negado = await semAcesso('visao-geral.bater-ponto')
  if (negado) return negado

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessão inválida. Faça login novamente.' }

  const companyId = (await cookies()).get('active_company_id')?.value
  if (!companyId) return { error: 'Selecione uma empresa.' }

  const ficha = await getFichaDoPonto(companyId, user.id)
  if (!ficha) return { error: 'Seu usuário não está ligado a uma ficha da Equipe.' }

  const admin = createAdminClient()
  const r = await gravarAusencia(admin, { companyId, employeeId: ficha.id, formData, origem: 'colaborador', status: 'pendente', autor: { id: user.id, nome: ficha.nome } })
  if ('error' in r) return r

  const a = r.ausencia
  await notificarGestores(admin, {
    companyId, item: 'pessoas.registro-de-ponto', autorId: user.id, tipo: 'ausencia',
    titulo: 'Atestado ou ausência para analisar', mensagem: `${ficha.nome} informou ${rotuloAusencia(a.tipo).toLowerCase()} em ${periodoTexto(a.data_inicio, a.data_fim)}.`, link: '/pessoas/registro-de-ponto?aba=ausencias',
  })

  revalidatePath('/meu-ponto')
  revalidatePath('/pessoas/registro-de-ponto')
  return { success: true as const }
}

/** Pedido de ajuste do próprio ponto: fica em análise e só altera o registro depois de aprovado */
export async function solicitarAjusteAction(dados: unknown, local: LocalBatida) {
  const negado = await semAcesso('visao-geral.bater-ponto')
  if (negado) return negado

  const parsed = ajustePontoSchema.safeParse(dados)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const d = parsed.data
  if (d.data > hojeBrasil()) return { error: 'Não é possível ajustar um dia que ainda não chegou.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessão inválida. Faça login novamente.' }

  const companyId = (await cookies()).get('active_company_id')?.value
  if (!companyId) return { error: 'Selecione uma empresa.' }

  const ficha = await getFichaDoPonto(companyId, user.id)
  if (!ficha?.pin_ativo) return { error: 'Seu cadastro não está liberado para registrar ponto.' }

  const batidas = d.batidas.map((h) => horaParaTimestamp(d.data, h) as string)
  if (batidas.some((ts) => Date.parse(ts) > Date.now())) return { error: 'Não é possível informar um horário que ainda não aconteceu.' }

  const { error } = await createAdminClient().from('time_adjustments').insert({
    company_id: companyId,
    employee_id: ficha.id,
    data: d.data,
    batidas,
    motivo: d.motivo,
    solicitado_por: user.id,
    origem: await origemDaRequisicao(local, new Date().toISOString()),
  })
  if (error) return { error: error.code === '23505' ? 'Já existe um ajuste em análise para este dia.' : error.message }

  await notificarGestores(createAdminClient(), {
    companyId, item: 'pessoas.registro-de-ponto', autorId: user.id, tipo: 'ponto',
    titulo: 'Ajuste de ponto para aprovar', mensagem: `${ficha.nome} pediu ajuste no ponto de ${periodoTexto(d.data, d.data)}.`, link: '/pessoas/registro-de-ponto?aba=aprovacoes',
  })

  revalidatePath('/meu-ponto')
  revalidatePath('/pessoas/registro-de-ponto')
  revalidatePath('/dashboard')
  return { success: true as const }
}
