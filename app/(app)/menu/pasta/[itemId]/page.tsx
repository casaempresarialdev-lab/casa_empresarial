import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { PastaClient } from './components/pasta-client'
import type { Document } from '@/app/(app)/admin/documentacao/queries'

export const dynamic = 'force-dynamic'

export default async function MenuPastaPage({ params }: { params: Promise<{ itemId: string }> }) {
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
    .select('id, label, key, tipo, parent_id')
    .eq('id', itemId)
    .eq('company_id', companyId)
    .eq('tipo', 'pasta')
    .is('deleted_at', null)
    .maybeSingle()

  if (!item) notFound()

  const { data: documents } = await admin
    .from('documents')
    .select('*')
    .eq('menu_item_id', itemId)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-3xl mx-auto">
      <PastaClient
        companyId={companyId}
        menuItemId={itemId}
        nome={item.label ?? 'Pasta'}
        documents={(documents ?? []) as Document[]}
      />
    </div>
  )
}
