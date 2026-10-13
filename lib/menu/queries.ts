import { createAdminClient } from '@/lib/supabase/server'
import { NATIVE_CATALOG, type CustomItemType } from './catalog'
import type { AreaKey } from '@/lib/auth/area-permissions'

export type MenuItemRow = {
  id: string
  company_id: string
  parent_id: string | null
  key: string | null
  natureza: 'nativa' | 'personalizada'
  tipo: 'area' | CustomItemType
  label: string | null
  icon: string
  href: string | null
  ordem: number
  created_at: string
}

export type MenuSubItem = MenuItemRow & { displayLabel: string }
export type MenuArea = MenuItemRow & { displayLabel: string; areaKey: AreaKey | null; children: MenuSubItem[] }

function displayLabelFor(row: MenuItemRow, catalogLabel?: string): string {
  return row.label ?? catalogLabel ?? '(sem nome)'
}

/**
 * Árvore de menu da empresa (área -> sub-área). Semeia o catálogo nativo na
 * primeira vez que a empresa é lida (mesmo padrão de lazy-seed já usado em
 * company_admission_stages) e depois só lê o que está salvo — adicionar uma
 * sub-área nativa nova ao produto não aparece sozinho pra empresas que já
 * foram semeadas (mesma limitação conhecida das colunas de Admissão).
 */
export async function getMenuTree(companyId: string): Promise<MenuArea[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('company_menu_items')
    .select('*')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('ordem', { ascending: true })

  let rows = (data ?? []) as MenuItemRow[]

  if (rows.length === 0) {
    const toInsert: Omit<MenuItemRow, 'id' | 'company_id' | 'created_at'>[] = []
    NATIVE_CATALOG.forEach((area, areaIdx) => {
      toInsert.push({
        parent_id: null, key: area.key, natureza: 'nativa', tipo: 'area',
        label: null, icon: area.icon, href: null, ordem: areaIdx,
      })
    })
    const { data: seededAreas, error } = await admin
      .from('company_menu_items')
      .insert(toInsert.map(r => ({ ...r, company_id: companyId })))
      .select('*')

    if (error || !seededAreas) return []

    const areaIdByKey = new Map((seededAreas as MenuItemRow[]).map(r => [r.key, r.id]))
    const subToInsert: Omit<MenuItemRow, 'id' | 'company_id' | 'created_at'>[] = []
    NATIVE_CATALOG.forEach((area) => {
      const parentId = areaIdByKey.get(area.key)
      if (!parentId) return
      area.children.forEach((sub, subIdx) => {
        // tipo:'area' aqui é só um valor válido pro CHECK da coluna — sub-área nativa
        // nunca é pasta/formulário/etc., e o href (sempre presente) tem prioridade na
        // hora de resolver a rota (ver hrefForSubItem no sidebar), então o tipo não é
        // consultado pra ela.
        subToInsert.push({
          parent_id: parentId, key: sub.key, natureza: 'nativa', tipo: 'area',
          label: null, icon: sub.icon, href: sub.href, ordem: subIdx,
        })
      })
    })

    const { data: seededSubs } = await admin
      .from('company_menu_items')
      .insert(subToInsert.map(r => ({ ...r, company_id: companyId })))
      .select('*')

    rows = [...(seededAreas as MenuItemRow[]), ...((seededSubs ?? []) as MenuItemRow[])]
  }

  const catalogLabelFor = (row: MenuItemRow): string | undefined => {
    if (row.natureza !== 'nativa') return undefined
    if (!row.parent_id) return NATIVE_CATALOG.find(a => a.key === row.key)?.label
    const parent = rows.find(r => r.id === row.parent_id)
    const area = NATIVE_CATALOG.find(a => a.key === parent?.key)
    return area?.children.find(c => c.key === row.key)?.label
  }

  const areas = rows
    .filter(r => r.parent_id === null)
    .map(area => ({
      ...area,
      displayLabel: displayLabelFor(area, catalogLabelFor(area)),
      areaKey: area.natureza === 'nativa' ? (area.key as AreaKey) : null,
      children: rows
        .filter(r => r.parent_id === area.id)
        .sort((a, b) => a.ordem - b.ordem)
        .map(sub => ({ ...sub, displayLabel: displayLabelFor(sub, catalogLabelFor(sub)) })),
    }))
    .sort((a, b) => a.ordem - b.ordem)

  return areas
}
