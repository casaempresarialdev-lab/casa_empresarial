import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { buscarConvitePorToken, findUserIdByEmail } from '@/lib/invitations'
import { Icon } from '@/components/ui/icon'
import { AcessoShell } from '../../components/acesso-shell'
import { ConviteForm } from './components/convite-form'
import { ConviteContaExistente } from './components/convite-conta-existente'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ token: string }>
}

// Link do e-mail de convite: a pessoa cadastra a senha e depois entra pelo login
export default async function ConvitePage({ params }: Props) {
  const { token } = await params
  const admin = createAdminClient()
  const convite = await buscarConvitePorToken(admin, token)
  const temConta = convite ? !!(await findUserIdByEmail(admin, convite.email)) : false

  return (
    <AcessoShell>
      {!convite ? (
        <div>
          <span className="w-12 h-12 rounded-full inline-flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
            <Icon name="info" size={22} />
          </span>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Convite inválido ou expirado
          </h1>
          <p className="text-sm mt-1 mb-8" style={{ color: 'var(--color-text-muted)' }}>
            Este link já foi usado, foi cancelado ou passou da validade. Peça um novo convite a quem convidou você.
          </p>
          <Link href="/login" className="text-sm font-medium hover:underline" style={{ color: 'var(--color-brand)' }}>
            Ir para o login
          </Link>
        </div>
      ) : (
        <>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            {temConta ? 'Aceite seu convite' : 'Crie sua senha'}
          </h1>
          <p className="text-sm mt-1 mb-8" style={{ color: 'var(--color-text-muted)' }}>
            Você foi convidado(a) para acessar <strong style={{ color: 'var(--color-text-primary)' }}>{convite.empresa}</strong> como {convite.roleLabel}.
          </p>
          {temConta
            ? <ConviteContaExistente token={token} email={convite.email} />
            : <ConviteForm token={token} email={convite.email} />}
        </>
      )}
    </AcessoShell>
  )
}
