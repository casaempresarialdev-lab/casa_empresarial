import type { Evento, StatusConvite } from '../queries'

/**
 * Cores do evento no calendário: meus na cor primária (atrasados em vermelho), convites na cor primária
 * com borda tracejada, agendas de outras pessoas na cor da pessoa. Recusados ficam apagados.
 */
export function estiloEvento(e: Evento, atrasado: boolean): { style: React.CSSProperties; apagado: boolean } {
  const apagado = e.concluido || e.meu_status === 'recusado'
  if (e.origem === 'agenda') {
    const cor = corDaPessoa(e.profile_id)
    return { style: { backgroundColor: `${cor}1F`, color: cor, borderLeftColor: cor }, apagado }
  }
  if (atrasado) return { style: { backgroundColor: '#FEE2E2', color: '#B91C1C', borderLeftColor: '#B91C1C' }, apagado }
  const base = { backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)', borderLeftColor: 'var(--color-brand)' }
  return { style: e.origem === 'convite' ? { ...base, borderLeftStyle: 'dashed', outline: '1px dashed var(--color-brand)', outlineOffset: -1 } : base, apagado }
}

/** Foto do usuário (ou a inicial do nome) */
export function Avatar({ nome, url, size = 32, cor }: { nome: string; url: string | null; size?: number; cor?: string }) {
  return (
    <span
      className="shrink-0 rounded-full overflow-hidden flex items-center justify-center font-bold"
      style={{ width: size, height: size, fontSize: size * 0.4, backgroundColor: cor ? `${cor}22` : 'var(--color-brand-light)', color: cor ?? 'var(--color-brand)' }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={nome} className="w-full h-full object-cover" />
      ) : nome.charAt(0).toUpperCase()}
    </span>
  )
}

/**
 * Fotos dos envolvidos no evento: quem criou e os convidados (recusados ficam de fora), sobrepostas.
 * Sem convidados, aparece só a foto de quem criou.
 */
export function AvatarGrupo({ evento: e, size = 28, max = 3 }: { evento: Evento; size?: number; max?: number }) {
  const pessoas = [
    ...(e.dono ? [e.dono] : []),
    ...e.participantes.filter((p) => p.status !== 'recusado' && p.id !== e.dono?.id),
  ]
  if (!pessoas.length) return null
  const visiveis = pessoas.slice(0, max)
  const resto = pessoas.length - visiveis.length
  const cor = e.origem === 'agenda' ? corDaPessoa(e.profile_id) : undefined
  return (
    <span className="shrink-0 flex items-center" title={pessoas.map((p) => p.nome).join(', ')} aria-label={`Envolvidos: ${pessoas.map((p) => p.nome).join(', ')}`}>
      {visiveis.map((p, i) => (
        <span key={p.id} className="rounded-full ring-2 ring-white" style={{ marginLeft: i ? -size * 0.35 : 0, zIndex: max - i }}>
          <Avatar nome={p.nome} url={p.avatar_url} size={size} cor={i === 0 ? cor : undefined} />
        </span>
      ))}
      {resto > 0 && (
        <span
          className="rounded-full ring-2 ring-white flex items-center justify-center font-bold"
          style={{ width: size, height: size, marginLeft: -size * 0.35, fontSize: size * 0.36, backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}
        >
          +{resto}
        </span>
      )}
    </span>
  )
}

export const STATUS_CONVITE: Record<StatusConvite, { label: string; estilo: React.CSSProperties }> = {
  pendente: { label: 'Aguardando', estilo: { backgroundColor: '#FEF3C7', color: '#92400E' } },
  aceito: { label: 'Aceito', estilo: { backgroundColor: '#DCFCE7', color: '#166534' } },
  recusado: { label: 'Recusado', estilo: { backgroundColor: '#FEE2E2', color: '#B91C1C' } },
}

// Cores das agendas de outras pessoas no calendário (os meus eventos ficam na cor primária)
const CORES_AGENDA = ['#0EA5E9', '#8B5CF6', '#F59E0B', '#10B981', '#EC4899', '#6366F1', '#14B8A6', '#F97316']

/** Cor fixa por pessoa (mesma cor em toda a tela) */
export function corDaPessoa(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return CORES_AGENDA[h % CORES_AGENDA.length]
}
