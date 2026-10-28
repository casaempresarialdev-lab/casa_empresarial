import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Redireciona para /dashboard se já estiver logado
const AUTH_ONLY_ROUTES = ['/login', '/esqueci-senha', '/nova-senha']

// Requer auth mas não redireciona autenticados (onboarding)
const ONBOARDING_ROUTES = ['/cadastro/passo-2', '/cadastro/termos']

// Acessível para todos (autenticado ou não)
// /api/cron: rotinas agendadas da Vercel (protegidas pelo CRON_SECRET na própria rota)
const PUBLIC_ROUTES = ['/cadastro/passo-1', '/auth/callback', '/registrar-ponto', '/auto-cadastro', '/pesquisa', '/convite', '/api/cron']

// Segunda etapa do login para contas com autenticação em 2 fatores
const MFA_ROUTE = '/verificar-2fa'

// Rotas PDV — autenticação dupla com cookie pdv_session
const PDV_ROUTES = ['/operacional/frente-de-caixa']

// Rotas liberadas para o role "colaborador" (acesso restrito aos próprios dados) —
// não inclui '/pessoas/funcionarios' pois esse é o grid com todos os funcionários;
// a checagem abaixo libera apenas '/pessoas/funcionarios/[o-proprio-id]'
const COLABORADOR_ROUTES = [
  '/pessoas/registro-de-ponto',
  '/pessoas/escala-de-trabalho',
  '/pessoas/folha-de-pagamento',
  '/pessoas/beneficios',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // 2 fatores: conta com app autenticador que ainda não confirmou o código nesta sessão
  let needsMfa = false
  if (user) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    needsMfa = aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2'
  }
  const toMfa = () => NextResponse.redirect(new URL(MFA_ROUTE, request.url))

  // Tela do código: só para quem fez login e ainda precisa confirmar
  if (pathname === MFA_ROUTE) {
    if (!user) return NextResponse.redirect(new URL('/login', request.url))
    if (!needsMfa) return NextResponse.redirect(new URL('/dashboard', request.url))
    return response
  }

  // Rotas PDV
  if (PDV_ROUTES.some(r => pathname.startsWith(r))) {
    if (!user) return NextResponse.redirect(new URL('/login', request.url))
    if (needsMfa) return toMfa()
    const pdvSession = request.cookies.get('pdv_session')
    const isLoginPage = pathname === '/operacional/frente-de-caixa/login'
    if (!pdvSession && !isLoginPage)
      return NextResponse.redirect(new URL('/operacional/frente-de-caixa/login', request.url))
    if (pdvSession && isLoginPage)
      return NextResponse.redirect(new URL('/operacional/frente-de-caixa', request.url))
    return response
  }

  // Rotas públicas — acessíveis com ou sem login
  if (PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    return response
  }

  // Redireciona autenticados para fora das telas de auth puras
  if (AUTH_ONLY_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    if (user) return needsMfa ? toMfa() : NextResponse.redirect(new URL('/dashboard', request.url))
    return response
  }

  // Onboarding: precisa estar autenticado mas não redireciona para /dashboard
  if (ONBOARDING_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    if (!user) return NextResponse.redirect(new URL('/login', request.url))
    if (needsMfa) return toMfa()
    return response
  }

  // Todas as outras rotas: requer autenticação (e o código do app, se a conta tiver 2FA)
  if (!user) return NextResponse.redirect(new URL('/login', request.url))
  if (needsMfa) return toMfa()

  // Colaborador: acesso restrito às rotas liberadas + à própria página em /pessoas/funcionarios
  const role = request.cookies.get('active_company_role')?.value
  if (role === 'colaborador') {
    const myEmployeeId = request.cookies.get('my_employee_id')?.value
    const ownFuncionarioRoute = myEmployeeId && (
      pathname === `/pessoas/funcionarios/${myEmployeeId}` ||
      pathname.startsWith(`/pessoas/funcionarios/${myEmployeeId}/`)
    )
    const allowed = COLABORADOR_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/')) || ownFuncionarioRoute
    if (!allowed) return NextResponse.redirect(new URL('/pessoas/registro-de-ponto', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
