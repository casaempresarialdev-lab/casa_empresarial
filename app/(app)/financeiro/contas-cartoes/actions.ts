'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function parseMoney(v: string | null) {
  if (!v) return null
  return parseFloat(v.replace(/\./g, '').replace(',', '.')) || null
}

// ── Contas Bancárias ──────────────────────────────────────────

export async function createBankAccountAction(companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const banco = formData.get('banco') as string
  if (!banco) return { error: 'Nome do banco é obrigatório.' }

  const admin = createAdminClient()
  const saldoInicial = parseMoney(formData.get('saldo_inicial') as string) ?? 0

  const { error } = await admin.from('bank_accounts').insert({
    company_id: companyId,
    banco,
    agencia: (formData.get('agencia') as string) || null,
    numero: (formData.get('numero') as string) || null,
    digito: (formData.get('digito') as string) || null,
    tipo: (formData.get('tipo') as string) || null,
    saldo_inicial: saldoInicial,
    saldo_atual: saldoInicial,
    ativo: formData.get('ativo') === 'true',
  })

  if (error) return { error: error.message }
  revalidatePath('/financeiro/contas-cartoes')
  return { success: true }
}

export async function updateBankAccountAction(accountId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const banco = formData.get('banco') as string
  if (!banco) return { error: 'Nome do banco é obrigatório.' }

  const admin = createAdminClient()
  const { error } = await admin.from('bank_accounts').update({
    banco,
    agencia: (formData.get('agencia') as string) || null,
    numero: (formData.get('numero') as string) || null,
    digito: (formData.get('digito') as string) || null,
    tipo: (formData.get('tipo') as string) || null,
    saldo_inicial: parseMoney(formData.get('saldo_inicial') as string) ?? 0,
    ativo: formData.get('ativo') === 'true',
  }).eq('id', accountId)

  if (error) return { error: error.message }
  revalidatePath('/financeiro/contas-cartoes')
  return { success: true }
}

export async function deleteBankAccountAction(accountId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('bank_accounts').delete().eq('id', accountId)

  if (error) return { error: error.message }
  revalidatePath('/financeiro/contas-cartoes')
  return { success: true }
}

// ── Cartões de Crédito ────────────────────────────────────────

export async function createCreditCardAction(companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const nome = formData.get('nome') as string
  if (!nome) return { error: 'Nome do cartão é obrigatório.' }

  const admin = createAdminClient()
  const { error } = await admin.from('credit_cards').insert({
    company_id: companyId,
    nome,
    bandeira: (formData.get('bandeira') as string) || null,
    limite: parseMoney(formData.get('limite') as string),
    dia_vencimento: parseInt(formData.get('dia_vencimento') as string) || null,
    dia_fechamento: parseInt(formData.get('dia_fechamento') as string) || null,
    ativo: formData.get('ativo') === 'true',
  })

  if (error) return { error: error.message }
  revalidatePath('/financeiro/contas-cartoes')
  return { success: true }
}

export async function updateCreditCardAction(cardId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const nome = formData.get('nome') as string
  if (!nome) return { error: 'Nome do cartão é obrigatório.' }

  const admin = createAdminClient()
  const { error } = await admin.from('credit_cards').update({
    nome,
    bandeira: (formData.get('bandeira') as string) || null,
    limite: parseMoney(formData.get('limite') as string),
    dia_vencimento: parseInt(formData.get('dia_vencimento') as string) || null,
    dia_fechamento: parseInt(formData.get('dia_fechamento') as string) || null,
    ativo: formData.get('ativo') === 'true',
  }).eq('id', cardId)

  if (error) return { error: error.message }
  revalidatePath('/financeiro/contas-cartoes')
  return { success: true }
}

export async function deleteCreditCardAction(cardId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('credit_cards').delete().eq('id', cardId)

  if (error) return { error: error.message }
  revalidatePath('/financeiro/contas-cartoes')
  return { success: true }
}
