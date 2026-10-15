import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSupportTickets } from './queries'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  aberto: 'Aberto',
  respondido: 'Respondido',
  fechado: 'Fechado',
}

export default async function SuportePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const tickets = await getSupportTickets(companyId)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
          Central de Chamados
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Histórico das mensagens enviadas pelo botão de suporte — use o ícone da Cá, no canto da tela, pra abrir um novo chamado.
        </p>
      </div>

      {tickets.length === 0 ? (
        <div className="bg-white rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--color-bg-surface)' }}>
          <div className="text-4xl mb-3">💬</div>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Nenhum chamado registrado ainda.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tickets.map(t => (
            <div key={t.id} className="bg-white rounded-2xl border p-4" style={{ borderColor: 'var(--color-bg-surface)' }}>
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-darker)' }}
                >
                  {STATUS_LABELS[t.status] ?? t.status}
                </span>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {new Date(t.created_at).toLocaleString('pt-BR')}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>
                {t.mensagem}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
