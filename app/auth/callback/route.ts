import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', request.url))
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    },
  )

  const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !session) {
    return NextResponse.redirect(new URL('/login?error=auth_callback', request.url))
  }

  // Verifica convites pendentes para este e-mail e adiciona à empresa
  const userEmail = session.user.email
  if (userEmail) {
    const admin = createAdminClient()

    const { data: pendingInvites } = await admin
      .from('invitations')
      .select('id, company_id, role')
      .eq('email', userEmail.toLowerCase())
      .eq('status', 'pending')

    if (pendingInvites && pendingInvites.length > 0) {
      for (const inv of pendingInvites) {
        // Adiciona à empresa (upsert para evitar duplicata)
        await admin.from('company_members').upsert(
          {
            company_id: inv.company_id,
            profile_id: session.user.id,
            role: inv.role,
            status: 'active',
          },
          { onConflict: 'company_id,profile_id' },
        )

        // Marca convite como aceito
        await admin
          .from('invitations')
          .update({ status: 'accepted' })
          .eq('id', inv.id)
      }

      // Define a empresa do convite como ativa
      const firstInvite = pendingInvites[0]
      const response = NextResponse.redirect(new URL('/dashboard', origin))
      response.cookies.set('active_company_id', firstInvite.company_id, {
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
      })
      return response
    }
  }

  return NextResponse.redirect(new URL(next, origin))
}
