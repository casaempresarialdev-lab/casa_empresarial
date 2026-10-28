import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { enviarAvisosEventos } from '@/lib/eventos-email'

// Rotina agendada (Vercel Cron, a cada 5 min — ver vercel.json): envia por e-mail os avisos dos eventos do calendário
// de todos os usuários, mesmo com o sistema fechado. Com o sistema aberto, o próprio sistema já envia
// (resumoNotificacoesAction); a reserva em lib/eventos-email.ts evita e-mail duplicado.
// Protegida pelo CRON_SECRET: a Vercel envia "Authorization: Bearer <CRON_SECRET>".

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const r = await enviarAvisosEventos(createAdminClient())
  return NextResponse.json(r, { status: r.erro ? 500 : 200 })
}
