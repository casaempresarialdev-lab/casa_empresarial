'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Segmentos que são apenas grupos de rota — sem page.tsx própria
// ('admin' tem página própria: o dashboard do Administrativo)
const NON_LINK_SEGMENTS = new Set(['financeiro', 'operacional', 'pessoas', 'marketing'])

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  admin: 'Administrativo',
  usuarios: 'Usuários',
  'quadro-societario': 'Quadro Societário',
  'cofre-de-senhas': 'Cofre de senhas',
  notificacoes: 'Notificações',
  documentacao: 'Documentação',
  'certificado-digital': 'Certificado digital',
  financeiro: 'Financeiro',
  contatos: 'Contatos',
  'centro-de-custo': 'Centro de Custo',
  categorias: 'Categorias',
  'contas-cartoes': 'Contas e Cartões',
  'fluxo-de-caixa': 'Fluxo de Caixa',
  faturas: 'Faturas',
  operacional: 'Operacional',
  produtos: 'Produtos e Serviços',
  novo: 'Novo',
  'pedidos-compra': 'Pedidos de Compra',
  'pedidos-venda': 'Pedidos de Venda',
  'frente-de-caixa': 'Frente de Caixa',
  pessoas: 'Pessoas',
  funcionarios: 'Equipe',
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

/** current: nome para o último item (ex.: o nome do registro no lugar do id da URL) */
export function Breadcrumb({ current }: { current?: string } = {}) {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  type Crumb = { label: string; href: string }
  const crumbs: Crumb[] = segments.map((seg, i) => ({
    label: (current && i === segments.length - 1 ? current : ROUTE_LABELS[seg]) ?? seg,
    href: '/' + segments.slice(0, i + 1).join('/'),
  }))

  if (crumbs.length === 0 || pathname === '/dashboard') return null

  return (
    // Na linha do título, à direita; a partir de md recua a largura da barra de ferramentas (112px, solta no canto) menos o respiro do <main>
    <nav aria-label="Breadcrumb" className="ml-auto md:mr-26">
      <ol className="flex items-center justify-end gap-1.5 flex-wrap">
        <li>
          <Link
            href="/dashboard"
            className="text-xs transition-colors hover:underline"
            style={{ color: 'var(--color-brand)' }}
          >
            Início
          </Link>
        </li>
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1
          return (
            <li key={crumb.href} className="flex items-center gap-1.5">
              <span className="text-xs opacity-50" style={{ color: 'var(--color-brand)' }} aria-hidden="true">/</span>
              {isLast || NON_LINK_SEGMENTS.has(segments[i]) ? (
                <span
                  className="text-xs"
                  style={{ color: 'var(--color-brand)', fontWeight: isLast ? 600 : 400 }}
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-xs transition-colors hover:underline"
                  style={{ color: 'var(--color-brand)' }}
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
