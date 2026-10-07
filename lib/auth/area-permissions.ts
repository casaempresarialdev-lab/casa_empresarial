// Tipos e helpers de permissão por área — usados tanto no servidor (Server
// Components/Actions) quanto no middleware (Edge runtime). Por isso este
// arquivo não importa nada de Node/Supabase: só tipos e funções puras.

export type AreaKey = 'administrativo' | 'financeiro' | 'pessoas' | 'operacional' | 'marketing'
export type AreaPermissionLevel = 'nenhum' | 'ver' | 'editar'
export type AreaPermissions = Record<AreaKey, AreaPermissionLevel>

export const AREA_KEYS: AreaKey[] = ['administrativo', 'financeiro', 'pessoas', 'operacional', 'marketing']

export const AREA_LABELS: Record<AreaKey, string> = {
  administrativo: 'Administrativo',
  financeiro: 'Financeiro',
  pessoas: 'Pessoas',
  operacional: 'Operacional',
  marketing: 'Marketing',
}

// Owner sempre passa — nunca usa este objeto pra decidir nada, só é exposto
// pra telas que precisam exibir "acesso total" sem checar campo por campo.
export const FULL_AREA_PERMISSIONS: AreaPermissions = {
  administrativo: 'editar', financeiro: 'editar', pessoas: 'editar', operacional: 'editar', marketing: 'editar',
}

// Padrão ao convidar alguém novo — a pedido da Carol ("Sem acesso" é o padrão
// da grade de permissões no convite); o owner ajusta antes de enviar.
export const DEFAULT_NEW_MEMBER_PERMISSIONS: AreaPermissions = {
  administrativo: 'nenhum', financeiro: 'nenhum', pessoas: 'nenhum', operacional: 'nenhum', marketing: 'nenhum',
}

/** Lê o JSONB vindo do banco (ou de um cookie já parseado) com fallback seguro para "nenhum". */
export function parseAreaPermissions(raw: unknown): AreaPermissions {
  const parsed = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
  const result = {} as AreaPermissions
  for (const key of AREA_KEYS) {
    const value = parsed[key]
    result[key] = (value === 'ver' || value === 'editar') ? value : 'nenhum'
  }
  return result
}

// Rota -> área. Usado no middleware pra decidir se a área está oculta
// (permissão "nenhum") pro usuário logado. Rotas fora desse mapa (Dashboard,
// PDV, Portal de Ponto etc.) não são afetadas por esta checagem.
export function areaKeyForPathname(pathname: string): AreaKey | null {
  if (pathname.startsWith('/financeiro')) return 'financeiro'
  if (pathname.startsWith('/pessoas')) return 'pessoas'
  if (pathname.startsWith('/operacional')) return 'operacional'
  if (pathname.startsWith('/marketing')) return 'marketing'
  if (pathname.startsWith('/admin') || pathname.startsWith('/empresa') || pathname.startsWith('/configuracoes')) return 'administrativo'
  return null
}
