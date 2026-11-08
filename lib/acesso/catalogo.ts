import type { IconName } from '@/components/ui/icon'

// Catálogo do que um perfil de acesso pode liberar: cada módulo e cada item dentro dele. É a fonte única do menu
// lateral e da tela de perfis. A página e as actions de um item novo precisam da checagem (lib/auth/acesso.ts).

export type ItemAcesso = {
  /** Valor gravado em access_profiles.permissoes: não muda ao renomear o item */
  key: string
  label: string
  href: string
  /** Só a própria rota (ex.: /admin, sem valer para /admin/...) */
  exato?: boolean
  /** Dashboard da área: no menu, é o clique no nome do módulo */
  dashboard?: boolean
  /** Outras rotas que pertencem a este item, fora do menu */
  rotas?: string[]
}

export type ModuloAcesso = {
  key: string
  label: string
  icon: IconName
  /** Fica no menu do usuário, não no menu lateral */
  menuUsuario?: boolean
  itens: ItemAcesso[]
}

export const VISAO_GERAL = '/dashboard'

export const MODULOS: ModuloAcesso[] = [
  {
    key: 'visao-geral',
    label: 'Visão geral',
    icon: 'grid',
    // A página é de todos os usuários; aqui se escolhe o que aparece nela
    itens: [
      { key: 'visao-geral.sua-casa', label: 'Sua casa hoje', href: VISAO_GERAL },
      { key: 'visao-geral.calendario', label: 'Calendário', href: VISAO_GERAL },
      { key: 'visao-geral.bater-ponto', label: 'Ferramentas: Bater ponto e Meu ponto', href: VISAO_GERAL },
    ],
  },
  {
    key: 'admin',
    label: 'Administrativo',
    icon: 'file',
    itens: [
      { key: 'admin.dashboard', label: 'Dashboard', href: '/admin', exato: true, dashboard: true },
      { key: 'admin.quadro-societario', label: 'Quadro Societário', href: '/admin/quadro-societario' },
      { key: 'admin.documentacao', label: 'Documentação', href: '/admin/documentacao' },
      { key: 'admin.certificado-digital', label: 'Certificado digital', href: '/admin/certificado-digital' },
    ],
  },
  {
    key: 'financeiro',
    label: 'Financeiro',
    icon: 'dollar',
    itens: [
      { key: 'financeiro.contatos', label: 'Contatos', href: '/financeiro/contatos' },
      { key: 'financeiro.centro-de-custo', label: 'Centro de Custo', href: '/financeiro/centro-de-custo' },
      { key: 'financeiro.categorias', label: 'Categorias', href: '/financeiro/categorias' },
      { key: 'financeiro.contas-cartoes', label: 'Contas e Cartões', href: '/financeiro/contas-cartoes' },
      { key: 'financeiro.fluxo-de-caixa', label: 'Fluxo de Caixa', href: '/financeiro/fluxo-de-caixa' },
      { key: 'financeiro.dre', label: 'DRE', href: '/financeiro/dre' },
      { key: 'financeiro.balanco', label: 'Balanço', href: '/financeiro/balanco' },
      { key: 'financeiro.faturas', label: 'Faturas', href: '/financeiro/faturas' },
    ],
  },
  {
    key: 'pessoas',
    label: 'Pessoas',
    icon: 'users',
    itens: [
      { key: 'pessoas.funcionarios', label: 'Equipe', href: '/pessoas/funcionarios', rotas: ['/pessoas/prestadores'] },
      { key: 'pessoas.vagas', label: 'Vagas', href: '/pessoas/vagas' },
      { key: 'pessoas.admissao', label: 'Admissão', href: '/pessoas/admissao' },
      { key: 'pessoas.rescisao', label: 'Rescisão', href: '/pessoas/rescisao' },
      { key: 'pessoas.registro-de-ponto', label: 'Registro de Ponto', href: '/pessoas/registro-de-ponto' },
      { key: 'pessoas.escala-de-trabalho', label: 'Escala de Trabalho', href: '/pessoas/escala-de-trabalho' },
      { key: 'pessoas.folha-de-pagamento', label: 'Folha de Pagamento', href: '/pessoas/folha-de-pagamento' },
      { key: 'pessoas.beneficios', label: 'Benefícios', href: '/pessoas/beneficios' },
      { key: 'pessoas.encargos', label: 'Encargos', href: '/pessoas/encargos' },
      { key: 'pessoas.reunioes', label: 'Reuniões', href: '/pessoas/reunioes', rotas: ['/marketing/reunioes'] },
      { key: 'pessoas.pesquisas', label: 'Pesquisas', href: '/pessoas/pesquisas' },
      { key: 'pessoas.seguranca-saude', label: 'Segurança e Saúde', href: '/pessoas/seguranca-saude' },
    ],
  },
  {
    key: 'operacional',
    label: 'Operacional',
    icon: 'briefcase',
    itens: [
      { key: 'operacional.produtos', label: 'Produtos e Serviços', href: '/operacional/produtos' },
      { key: 'operacional.pedidos-compra', label: 'Pedidos de Compra', href: '/operacional/pedidos-compra' },
      { key: 'operacional.pedidos-venda', label: 'Pedidos de Venda', href: '/operacional/pedidos-venda' },
      { key: 'operacional.ordens-de-servico', label: 'Ordens de Serviço', href: '/operacional/ordens-de-servico' },
      { key: 'operacional.frente-de-caixa', label: 'Frente de Caixa', href: '/operacional/frente-de-caixa' },
    ],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    icon: 'megaphone',
    itens: [
      { key: 'marketing.calendario', label: 'Calendário', href: '/marketing/calendario' },
      { key: 'marketing.depoimentos', label: 'Depoimentos', href: '/marketing/depoimentos' },
      { key: 'marketing.fotos-videos', label: 'Fotos e Vídeos', href: '/marketing/fotos-videos' },
      { key: 'marketing.material-grafico', label: 'Material Gráfico', href: '/marketing/material-grafico' },
      { key: 'marketing.manual-da-marca', label: 'Manual da Marca', href: '/marketing/manual-da-marca' },
    ],
  },
  {
    key: 'sistema',
    label: 'Sistema',
    icon: 'settings',
    menuUsuario: true,
    itens: [
      { key: 'sistema.empresa', label: 'Minha Empresa', href: '/empresa' },
      { key: 'sistema.acesso', label: 'Acessos', href: '/admin/usuarios' },
      { key: 'sistema.meu-plano', label: 'Meu Plano', href: '/meu-plano' },
      { key: 'sistema.configuracoes', label: 'Configurações', href: '/configuracoes' },
    ],
  },
]

export const TODOS_OS_ITENS = MODULOS.flatMap((m) => m.itens)
export const TODAS_AS_CHAVES = TODOS_OS_ITENS.map((i) => i.key)

/** Lista de permissões do usuário; null = acesso total (proprietário, colaborador tem regra própria) */
export type Permissoes = string[] | null

export const pode = (permissoes: Permissoes, key: string) => permissoes === null || permissoes.includes(key)

/** Para quem cai numa rota sem acesso: a Visão geral é de todos os usuários */
export const primeiraRota = () => VISAO_GERAL

/** Módulos do menu lateral com os itens que o usuário pode abrir (módulo sem item liberado some) */
export function modulosDoMenu(permissoes: Permissoes): ModuloAcesso[] {
  return MODULOS
    .filter((m) => !m.menuUsuario)
    .map((m) => ({ ...m, itens: m.itens.filter((i) => pode(permissoes, i.key)) }))
    // A Visão geral fica no menu mesmo sem nenhum bloco liberado
    .filter((m) => m.itens.length > 0 || m.key === 'visao-geral')
}
