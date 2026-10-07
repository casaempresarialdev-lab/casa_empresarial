import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { CUSTOM_TYPE_LABELS, CUSTOM_TYPE_ICONS, type CustomItemType } from '@/lib/menu/catalog'

export const dynamic = 'force-dynamic'

export default async function MenuEmBrevePage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const admin = createAdminClient()
  const { data: item } = await admin
    .from('company_menu_items')
    .select('label, tipo')
    .eq('id', itemId)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!item) notFound()

  const tipo = item.tipo as CustomItemType
  const icon = CUSTOM_TYPE_ICONS[tipo] ?? '📦'

  return (
    <div className="max-w-lg mx-auto text-center py-16">
      <div className="text-5xl mb-4">{icon}</div>
      <h1 className="text-xl font-bold mb-2" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
        {item.label ?? 'Este item'}
      </h1>
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
        O tipo <strong>{CUSTOM_TYPE_LABELS[tipo] ?? tipo}</strong> ainda está em desenvolvimento — o nome já está
        reservado no menu, e essa funcionalidade chega numa próxima entrega.
      </p>
    </div>
  )
}
