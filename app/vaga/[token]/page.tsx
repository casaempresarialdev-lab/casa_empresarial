import { createAdminClient } from '@/lib/supabase/server'
import { fmtDate, fmtMoney, tipoLabel } from '@/app/(app)/pessoas/funcionarios/components/ficha/ficha-config'
import { CandidaturaForm } from './components/candidatura-form'

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

export default async function VagaPublicaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: vaga } = await admin
    .from('job_openings')
    .select('company_id, titulo, descricao, cargo, departamento, local_trabalho, tipo_contrato, salario, exibir_salario, data_limite, status')
    .eq('token', token)
    .maybeSingle()

  if (!vaga) return <Mensagem titulo="Vaga não encontrada" texto="Este link não existe ou foi removido." />

  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  if (vaga.status !== 'aberta' || (vaga.data_limite && vaga.data_limite < hoje)) {
    return <Mensagem titulo="Candidaturas encerradas" texto="Esta vaga não está mais recebendo candidaturas. Obrigado pelo interesse!" />
  }

  const { data: company } = await admin
    .from('companies')
    .select('nome_fantasia, razao_social, logo_url, cor_primaria')
    .eq('id', vaga.company_id)
    .maybeSingle()

  const empresa = company?.nome_fantasia || company?.razao_social || 'Empresa'
  const cor = company?.cor_primaria || null
  const detalhes = [
    tipoLabel(vaga.tipo_contrato),
    vaga.cargo,
    vaga.departamento,
    vaga.local_trabalho,
    vaga.exibir_salario && vaga.salario != null ? fmtMoney(vaga.salario) : null,
    vaga.data_limite ? `Candidaturas até ${fmtDate(vaga.data_limite)}` : null,
  ].filter(Boolean)

  // Cores da empresa nos campos e botões desta página
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

      <section className="app-card p-6 flex flex-col gap-3">
        <h1 className="text-2xl font-extrabold" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>{vaga.titulo}</h1>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{detalhes.join(' · ')}</p>
        {vaga.descricao && (
          <p className="text-sm whitespace-pre-wrap break-words" style={{ color: 'var(--color-text-secondary)' }}>{vaga.descricao}</p>
        )}
      </section>

      <section className="app-card p-6">
        <h2 className="text-lg font-bold mb-4" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>Candidate-se</h2>
        <CandidaturaForm token={token} empresa={empresa} />
      </section>
    </main>
  )
}
