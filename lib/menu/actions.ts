'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getMenuTree } from './queries'
import { NATIVE_CATALOG, CUSTOM_TYPE_ICONS, type CustomItemType } from './catalog'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function catalogLabelFor(key: string | null, parentKey: string | null): string | undefined {
  if (!key) return undefined
  if (!parentKey) return NATIVE_CATALOG.find(a => a.key === key)?.label
  return NATIVE_CATALOG.find(a => a.key === parentKey)?.children.find(c => c.key === key)?.label
}

export async function createAreaAction(companyId: string, label: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  if (!label.trim()) return { error: 'Nome da área é obrigatório.' }

  const admin = createAdminClient()
  const tree = await getMenuTree(companyId)
  const ordem = tree.length > 0 ? Math.max(...tree.map(a => a.ordem)) + 1 : 0

  const { error } = await admin.from('company_menu_items').insert({
    company_id: companyId, parent_id: null, key: null,
    natureza: 'personalizada', tipo: 'area', label: label.trim(), icon: '📁',
    ordem, created_by: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function addSubItemAction(companyId: string, areaId: string, tipo: CustomItemType, label: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  if (!label.trim()) return { error: 'Nome é obrigatório.' }

  const admin = createAdminClient()
  const { data: siblings } = await admin
    .from('company_menu_items')
    .select('ordem')
    .eq('company_id', companyId)
    .eq('parent_id', areaId)
    .is('deleted_at', null)

  const ordem = siblings && siblings.length > 0 ? Math.max(...siblings.map(s => s.ordem)) + 1 : 0

  const { error } = await admin.from('company_menu_items').insert({
    company_id: companyId, parent_id: areaId, key: null,
    natureza: 'personalizada', tipo, label: label.trim(), icon: CUSTOM_TYPE_ICONS[tipo],
    ordem, created_by: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function renameItemAction(itemId: string, companyId: string, newLabel: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  if (!newLabel.trim()) return { error: 'Nome não pode ficar vazio.' }

  const admin = createAdminClient()
  const { data: item } = await admin
    .from('company_menu_items')
    .select('key, parent_id, natureza')
    .eq('id', itemId).eq('company_id', companyId).single()

  if (!item) return { error: 'Item não encontrado.' }

  let parentKey: string | null = null
  if (item.parent_id) {
    const { data: parent } = await admin.from('company_menu_items').select('key').eq('id', item.parent_id).single()
    parentKey = parent?.key ?? null
  }

  const defaultLabel = item.natureza === 'nativa' ? catalogLabelFor(item.key, parentKey) : undefined
  // Volta a NULL quando o nome digitado é igual ao padrão — assim, se o produto
  // mudar o nome padrão no futuro, quem nunca renomeou continua acompanhando.
  const label = newLabel.trim() === defaultLabel ? null : newLabel.trim()

  const { error } = await admin.from('company_menu_items').update({ label }).eq('id', itemId).eq('company_id', companyId)
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function changeAreaIconAction(areaId: string, companyId: string, icon: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('company_menu_items')
    .update({ icon })
    .eq('id', areaId).eq('company_id', companyId).is('parent_id', null)

  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function deleteItemAction(itemId: string, companyId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { data: item } = await admin
    .from('company_menu_items')
    .select('natureza')
    .eq('id', itemId).eq('company_id', companyId).single()

  if (!item) return { error: 'Item não encontrado.' }
  if (item.natureza === 'nativa') return { error: 'Áreas e sub-áreas do Método não podem ser excluídas — só renomeadas.' }

  // Exclusão lógica — os documentos ligados a uma "Pasta" excluída ficam
  // órfãos (sem tela de recuperação ainda); aviso disso fica no texto de
  // confirmação do lado do cliente.
  const { error } = await admin.from('company_menu_items').update({ deleted_at: new Date().toISOString() }).eq('id', itemId)
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { success: true }
}

// Reordenação por arrastar-e-soltar — recebe a ordem final de uma lista de irmãos
// (todos com o mesmo parent_id) e regrava o campo "ordem" de cada um sequencialmente.
// Mais simples que calcular "trocar com o vizinho" quando o drop pode acontecer em
// qualquer posição da lista, não só ±1.
export async function reorderItemsAction(companyId: string, parentId: string | null, orderedIds: string[]) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const results = await Promise.all(
    orderedIds.map((id, idx) => {
      let q = admin.from('company_menu_items').update({ ordem: idx }).eq('id', id).eq('company_id', companyId)
      q = parentId ? q.eq('parent_id', parentId) : q.is('parent_id', null)
      return q
    })
  )

  const failed = results.find(r => r.error)
  if (failed?.error) return { error: failed.error.message }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function moveItemAction(companyId: string, itemId: string, direction: 'up' | 'down') {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { data: item } = await admin
    .from('company_menu_items')
    .select('parent_id, ordem')
    .eq('id', itemId).eq('company_id', companyId).single()

  if (!item) return { error: 'Item não encontrado.' }

  let siblingsQuery = admin
    .from('company_menu_items')
    .select('id, ordem')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('ordem', { ascending: true })

  siblingsQuery = item.parent_id ? siblingsQuery.eq('parent_id', item.parent_id) : siblingsQuery.is('parent_id', null)
  const { data: siblings } = await siblingsQuery

  if (!siblings) return { error: 'Erro ao mover.' }

  const idx = siblings.findIndex(s => s.id === itemId)
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (idx < 0 || swapIdx < 0 || swapIdx >= siblings.length) return { error: 'Não é possível mover.' }

  const a = siblings[idx]
  const b = siblings[swapIdx]

  await admin.from('company_menu_items').update({ ordem: b.ordem }).eq('id', a.id)
  await admin.from('company_menu_items').update({ ordem: a.ordem }).eq('id', b.id)

  revalidatePath('/', 'layout')
  return { success: true }
}
