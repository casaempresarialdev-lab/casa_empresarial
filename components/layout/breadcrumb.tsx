'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  admin: 'Administrativo',
  usuarios: 'Usuários',
  'quadro-societario': 'Quadro Societário',
  'logins-senhas': 'Logins e Senhas',
  documentacao: 'Documentação',
  financeiro: 'Financeiro',
  contatos: 'Contatos',
  'centro-de-custo': 'Centro de Custo',
  categorias: 'Categorias',
  'contas-cartoes': 'Contas e Cartões',
  'fluxo-de-caixa': 'Fluxo de Caixa',
  faturas: 'Faturas',
  operacional: 'Operacional',
  produtos: 'Produtos',
  'pedidos-compra': 'Pedidos de Compra',
  'pedidos-venda': 'Pedidos de Venda',
  'frente-de-caixa': 'Frente de Caixa',
  pessoas: 'Pessoas',
  funcionarios: 'Funcionários',
  'registro-de-ponto': 'Registro de Ponto',
  'escala-de-trabalho': 'Escala de Trabalho',
  'folha-de-pagamento': 'Folha de Pagamento',
  prestadores: 'Prestadores',
  reunioes: 'Reuniões',
  marketing: 'Marketing',
  calendario: 'Calendário',
  depoimentos: 'Depoimentos',
  'fotos-videos': 'Fotos e Vídeos',
  'material-grafico': 'Material Gráfico',
  'manual-da-marca': 'Manual da Marca',
  empresa: 'Minha Empresa',
  'meu-plano': 'Meu Plano',
  perfil: 'Meu Perfil',
}

export function Breadcrumb() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  type Crumb = { label: string; href: string }
  const crumbs: Crumb[] = segments.map((seg, i) => ({
    label: ROUTE_LABELS[seg] ?? seg,
    href: '/' + segments.slice(0, i + 1).join('/'),
  }))

  if (crumbs.length === 0) return null

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1.5 flex-wrap">
        <li>
          <Link
            href="/dashboard"
            className="text-sm transition-colors hover:underline"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Início
          </Link>
        </li>
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1
          return (
            <li key={crumb.href} className="flex items-center gap-1.5">
              <span style={{ color: 'var(--color-text-muted)' }} aria-hidden="true">/</span>
              {isLast ? (
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-sm transition-colors hover:underline"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
