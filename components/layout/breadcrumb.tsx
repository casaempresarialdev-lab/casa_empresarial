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
    // basis-full: nos cabeçalhos (flex-wrap) o caminho desce para baixo do título, liberando o canto direito para a barra de ferramentas
    <nav aria-label="Breadcrumb" className="basis-full">
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
              {isLast || NON_LINK_SEGMENTS.has(segments[i]) ? (
                <span
                  className="text-sm"
                  style={{ color: isLast ? 'var(--color-text-primary)' : 'var(--color-text-muted)', fontWeight: isLast ? 500 : 400 }}
                >
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
