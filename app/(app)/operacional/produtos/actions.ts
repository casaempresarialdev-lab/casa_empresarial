'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function parseProductFields(formData: FormData) {
  const precoVendaRaw = formData.get('preco_venda') as string
  const precoCustoRaw = formData.get('preco_custo') as string
  const estoqueAtualRaw = formData.get('estoque_atual') as string
  const estoqueMinimoRaw = formData.get('estoque_minimo') as string

  return {
    nome: formData.get('nome') as string,
    descricao: (formData.get('descricao') as string) || null,
    sku: (formData.get('sku') as string) || null,
    codigo_barras: (formData.get('codigo_barras') as string) || null,
    categoria: (formData.get('categoria') as string) || null,
    tipo: (formData.get('tipo') as string) || 'produto',
    preco_venda: precoVendaRaw ? parseFloat(precoVendaRaw.replace(',', '.')) : null,
    preco_custo: precoCustoRaw ? parseFloat(precoCustoRaw.replace(',', '.')) : null,
    estoque_atual: estoqueAtualRaw ? parseInt(estoqueAtualRaw) : 0,
    estoque_minimo: estoqueMinimoRaw ? parseInt(estoqueMinimoRaw) : 0,
    unidade_medida: (formData.get('unidade_medida') as string) || 'un',
    // margem é GENERATED ALWAYS — nunca enviar
  }
}

export async function createProductAction(companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseProductFields(formData)
  if (!fields.nome) return { error: 'Nome é obrigatório.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('products')
    .insert({ company_id: companyId, ativo: true, ...fields })

  if (error) return { error: error.message }
  revalidatePath('/operacional/produtos')
  return { success: true }
}

export async function updateProductAction(productId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseProductFields(formData)
  if (!fields.nome) return { error: 'Nome é obrigatório.' }

  const admin = createAdminClient()
  const { error } = await admin.from('products').update(fields).eq('id', productId)

  if (error) return { error: error.message }
  revalidatePath('/operacional/produtos')
  return { success: true }
}

export async function toggleProductAtivoAction(productId: string, ativo: boolean) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('products').update({ ativo }).eq('id', productId)

  if (error) return { error: error.message }
  revalidatePath('/operacional/produtos')
  return { success: true }
}

export async function deleteProductAction(productId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('products').delete().eq('id', productId)

  if (error) return { error: error.message }
  revalidatePath('/operacional/produtos')
  return { success: true }
}
