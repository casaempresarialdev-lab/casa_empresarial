// Selos de vaga e candidatura
export const VAGA_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  aberta:    { label: 'Aberta',    bg: '#DCFCE7', color: '#15803D' },
  pausada:   { label: 'Pausada',   bg: '#FEF3C7', color: '#B45309' },
  encerrada: { label: 'Encerrada', bg: '#F3F4F6', color: '#6B7280' },
}

export const CANDIDATURA_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  nova:               { label: 'Nova',               bg: '#DBEAFE', color: '#1D4ED8' },
  selecionada:        { label: 'Em admissão',        bg: '#DCFCE7', color: '#15803D' },
  reprovada:          { label: 'Reprovada',          bg: '#FEE2E2', color: '#B91C1C' },
  desistiu:           { label: 'Desistiu',           bg: '#FEF3C7', color: '#B45309' },
  processo_encerrado: { label: 'Processo encerrado', bg: '#F3F4F6', color: '#6B7280' },
}

export function Selo({ cfg }: { cfg: { label: string; bg: string; color: string } }) {
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  )
}

export const linkPublico = (token: string) => `${window.location.origin}/vaga/${token}`
