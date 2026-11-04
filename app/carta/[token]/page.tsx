import { createAdminClient } from '@/lib/supabase/server'
import { fmtDataHora } from '@/lib/validations/admissao'
import { RespostaCarta } from './components/resposta-carta'

export const dynamic = 'force-dynamic'

function Mensagem({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <h1 className="text-xl font-bold mb-2" style={{ fontFamily: 'Manrope', color: '#1F2937' }}>{titulo}</h1>
        <p className="text-sm" style={{ color: '#6B7280' }}>{texto}</p>
      </div>
    </div>
  )
}

export default async function CartaPublicaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: carta } = await admin
    .from('admission_offers')
    .select('company_id, conteudo, status, expira_em, respondida_em')
    .eq('token', token)
    .maybeSingle()

  if (!carta) return <Mensagem titulo="Carta não encontrada" texto="Este link não existe ou foi removido." />
  if (carta.status === 'substituida') return <Mensagem titulo="Esta carta foi substituída" texto="A empresa enviou uma versão mais recente da proposta. Procure o e-mail mais novo." />
  if (carta.status === 'aceita') return <Mensagem titulo="Proposta aceita" texto={`Seu aceite foi registrado em ${fmtDataHora(carta.respondida_em as string)}.`} />
  if (carta.status === 'recusada') return <Mensagem titulo="Proposta recusada" texto="Sua resposta foi registrada. Obrigado pelo retorno." />
  if (Date.parse(carta.expira_em as string) < Date.now()) return <Mensagem titulo="Proposta expirada" texto="O prazo para responder terminou. Se ainda tiver interesse, fale com a empresa." />

  const { data: company } = await admin
    .from('companies')
    .select('nome_fantasia, razao_social, logo_url, cor_primaria')
    .eq('id', carta.company_id as string)
    .maybeSingle()

  const empresa = company?.nome_fantasia || company?.razao_social || 'Empresa'
  const cor = company?.cor_primaria || null
  const tema = (cor
    ? { '--color-brand': cor, '--color-primary-dark': cor, '--color-brand-light': `color-mix(in srgb, ${cor} 12%, white)` }
    : {}) as React.CSSProperties

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-6" style={tema}>
      <header className="flex items-center gap-3">
        {company?.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={company.logo_url} alt={empresa} className="h-10 w-auto max-w-[140px] object-contain" />
        )}
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>{empresa}</span>
      </header>

      <section className="app-card p-6 flex flex-col gap-4">
        <h1 className="text-2xl font-extrabold" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Carta proposta</h1>
        {/* Texto puro: o que a empresa escreveu aparece como está, sem interpretar HTML */}
        <p className="text-sm whitespace-pre-wrap break-words" style={{ color: 'var(--color-text-secondary)' }}>{carta.conteudo as string}</p>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Responda até {fmtDataHora(carta.expira_em as string)}.</p>
      </section>

      <section className="app-card p-6">
        <RespostaCarta token={token} empresa={empresa} />
      </section>
    </main>
  )
}
