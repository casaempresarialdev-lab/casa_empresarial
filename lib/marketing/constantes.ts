// Listas fixas compartilhadas entre Calendário editorial, Banco de ideias e Campanhas —
// mesmos valores usados no protótipo da Carol, pra manter o mesmo vocabulário em todo o módulo.

export const CONTEUDO_FORMATOS = [
  { id: 'post', label: 'Post' },
  { id: 'reels', label: 'Reels / vídeo curto' },
  { id: 'stories', label: 'Stories' },
  { id: 'artigo', label: 'Artigo / blog' },
  { id: 'email', label: 'E-mail marketing' },
  { id: 'outro', label: 'Outro' },
] as const

export const CONTEUDO_CANAIS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'blog', label: 'Blog / site' },
  { id: 'email', label: 'E-mail' },
  { id: 'outro', label: 'Outro' },
] as const

export const CONTEUDO_FASES = [
  { id: 'topo', label: 'Topo de funil', labelLong: 'Topo de funil — atrair' },
  { id: 'meio', label: 'Meio de funil', labelLong: 'Meio de funil — engajar' },
  { id: 'fundo', label: 'Fundo de funil', labelLong: 'Fundo de funil — converter' },
] as const

export const CONTEUDO_STATUS = [
  { id: 'ideia', label: 'Ideia' },
  { id: 'fazendo', label: 'Fazendo' },
  { id: 'feito', label: 'Feito' },
  { id: 'agendado', label: 'Agendado' },
  { id: 'publicado', label: 'Publicado' },
] as const

export function formatoLabel(id: string | null, outro?: string | null) {
  if (id === 'outro') return (outro && outro.trim()) || 'Outro'
  return CONTEUDO_FORMATOS.find((f) => f.id === id)?.label ?? '—'
}
export function canalLabel(id: string | null, outro?: string | null) {
  if (id === 'outro') return (outro && outro.trim()) || 'Outro'
  return CONTEUDO_CANAIS.find((c) => c.id === id)?.label ?? '—'
}
export function faseLabel(id: string | null) {
  return CONTEUDO_FASES.find((f) => f.id === id)?.label ?? '—'
}
export function statusLabel(id: string) {
  return CONTEUDO_STATUS.find((s) => s.id === id)?.label ?? id
}

export const METRICA_REDES = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'outro', label: 'Outra rede' },
] as const

export function redeLabel(id: string) {
  return METRICA_REDES.find((r) => r.id === id)?.label ?? id
}

export const CAMPANHA_OBJETIVOS = [
  { id: 'captar', label: 'Captar novos clientes' },
  { id: 'vendas', label: 'Aumentar vendas' },
  { id: 'lancamento', label: 'Lançamento de produto/serviço' },
  { id: 'fidelizar', label: 'Fidelizar clientes' },
  { id: 'data', label: 'Data comemorativa/sazonal' },
  { id: 'outro', label: 'Outro' },
] as const

export function objetivoLabel(id: string) {
  return CAMPANHA_OBJETIVOS.find((o) => o.id === id)?.label ?? id
}

export const MIDIA_AREAS = [
  { id: 'geral', label: 'Geral' },
  { id: 'administrativo', label: 'Administrativo' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'pessoas', label: 'Pessoas' },
  { id: 'operacional', label: 'Operacional' },
  { id: 'marketing', label: 'Marketing' },
] as const

export function areaLabel(id: string) {
  return MIDIA_AREAS.find((a) => a.id === id)?.label ?? id
}

export const DEPOIMENTO_FONTES = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'email', label: 'E-mail' },
  { id: 'presencial', label: 'Presencial / verbal' },
  { id: 'outro', label: 'Outro' },
] as const

export function fonteLabel(id: string, outro?: string | null) {
  if (id === 'outro') return (outro && outro.trim()) || 'Outro'
  return DEPOIMENTO_FONTES.find((f) => f.id === id)?.label ?? id
}
