import { createAdminClient } from '@/lib/supabase/server'
import { fmtDataHora } from '@/lib/validations/admissao'
import { CartaAviso, CartaShell } from './components/carta-shell'
import { CartaConteudo } from './components/carta-conteudo'

export const dynamic = 'force-dynamic'

export default async function CartaPublicaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: carta } = await admin
    .from('admission_offers')
    .select('company_id, employee_id, conteudo, cargo, status, expira_em, respondida_em')
    .eq('token', token)
    .maybeSingle()

  if (!carta) {
    return (
      <CartaShell cor={null}>
        <CartaAviso icon="info" titulo="Carta não encontrada" texto="Este link não existe ou foi removido." />
      </CartaShell>
    )
  }

  const { data: company } = await admin
    .from('companies')
    .select('nome_fantasia, razao_social, cor_primaria')
    .eq('id', carta.company_id as string)
    .maybeSingle()

  const marca = {
    empresa: company?.nome_fantasia || company?.razao_social || 'Empresa',
    cor: (company?.cor_primaria as string | null) ?? null,
  }

  if (carta.status === 'substituida') {
    return <CartaShell {...marca}><CartaAviso icon="mail" titulo="Esta carta foi substituída" texto="A empresa enviou uma versão mais recente da proposta. Procure o e-mail mais novo." /></CartaShell>
  }
  if (carta.status === 'aceita') {
    return <CartaShell {...marca}><CartaAviso icon="check" tom="sucesso" titulo="Proposta aceita" texto={`Seu aceite foi registrado em ${fmtDataHora(carta.respondida_em as string)}.`} /></CartaShell>
  }
  if (carta.status === 'recusada') {
    return <CartaShell {...marca}><CartaAviso icon="info" titulo="Proposta recusada" texto="Sua resposta foi registrada. Obrigado pelo retorno." /></CartaShell>
  }
  if (Date.parse(carta.expira_em as string) < Date.now()) {
    return <CartaShell {...marca}><CartaAviso icon="alarm" titulo="Proposta expirada" texto="O prazo para responder terminou. Se ainda tiver interesse, fale com a empresa." /></CartaShell>
  }

  const { data: emp } = carta.employee_id
    ? await admin.from('employees').select('nome').eq('id', carta.employee_id as string).maybeSingle()
    : { data: null }

  const destaques = [
    emp?.nome ? { icon: 'user' as const, texto: emp.nome as string } : null,
    carta.cargo ? { icon: 'briefcase' as const, texto: carta.cargo as string } : null,
    { icon: 'alarm' as const, texto: `Responda até ${fmtDataHora(carta.expira_em as string)}` },
  ].filter((d): d is NonNullable<typeof d> => !!d)

  return (
    <CartaShell {...marca} destaques={destaques}>
      <CartaConteudo token={token} empresa={marca.empresa} conteudo={carta.conteudo as string} />
    </CartaShell>
  )
}
