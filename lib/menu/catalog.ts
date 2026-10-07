import type { AreaKey } from '@/lib/auth/area-permissions'

// Catálogo nativo do Método Casa Empresarial — as 5 áreas fixas e suas
// sub-áreas nativas, com a rota real de cada uma. É o "ponto de partida" do
// menu de toda empresa nova; muda só quando o PRODUTO ganha uma tela nova,
// não quando uma empresa personaliza o próprio menu.
export type NativeSubItem = { key: string; label: string; href: string }
export type NativeArea = { key: AreaKey; label: string; icon: string; children: NativeSubItem[] }

export const NATIVE_CATALOG: NativeArea[] = [
  {
    key: 'administrativo', label: 'Administrativo', icon: '🏢',
    children: [
      { key: 'minha-empresa', label: 'Minha Empresa', href: '/empresa' },
      { key: 'quadro-societario', label: 'Quadro Societário', href: '/admin/quadro-societario' },
      { key: 'logins-senhas', label: 'Logins e Senhas', href: '/admin/logins-senhas' },
      { key: 'documentacao', label: 'Documentação', href: '/admin/documentacao' },
    ],
  },
  {
    key: 'financeiro', label: 'Financeiro', icon: '💰',
    children: [
      { key: 'contatos', label: 'Contatos', href: '/financeiro/contatos' },
      { key: 'centro-de-custo', label: 'Centro de Custo', href: '/financeiro/centro-de-custo' },
      { key: 'categorias', label: 'Categorias', href: '/financeiro/categorias' },
      { key: 'contas-cartoes', label: 'Contas e Cartões', href: '/financeiro/contas-cartoes' },
      { key: 'fluxo-de-caixa', label: 'Fluxo de Caixa', href: '/financeiro/fluxo-de-caixa' },
      { key: 'dre', label: 'DRE', href: '/financeiro/dre' },
      { key: 'balanco', label: 'Balanço', href: '/financeiro/balanco' },
      { key: 'faturas', label: 'Faturas', href: '/financeiro/faturas' },
    ],
  },
  {
    key: 'operacional', label: 'Operacional', icon: '📦',
    children: [
      { key: 'produtos', label: 'Produtos e Serviços', href: '/operacional/produtos' },
      { key: 'pedidos-compra', label: 'Pedidos de Compra', href: '/operacional/pedidos-compra' },
      { key: 'pedidos-venda', label: 'Pedidos de Venda', href: '/operacional/pedidos-venda' },
      { key: 'ordens-de-servico', label: 'Ordens de Serviço', href: '/operacional/ordens-de-servico' },
      { key: 'frente-de-caixa', label: 'Frente de Caixa', href: '/operacional/frente-de-caixa' },
    ],
  },
  {
    key: 'pessoas', label: 'Pessoas', icon: '👥',
    children: [
      { key: 'equipe', label: 'Equipe', href: '/pessoas/funcionarios' },
      { key: 'admissao', label: 'Admissão', href: '/pessoas/admissao' },
      { key: 'registro-de-ponto', label: 'Registro de Ponto', href: '/pessoas/registro-de-ponto' },
      { key: 'escala-de-trabalho', label: 'Escala de Trabalho', href: '/pessoas/escala-de-trabalho' },
      { key: 'folha-de-pagamento', label: 'Folha de Pagamento', href: '/pessoas/folha-de-pagamento' },
      { key: 'beneficios', label: 'Benefícios', href: '/pessoas/beneficios' },
      { key: 'encargos', label: 'Encargos', href: '/pessoas/encargos' },
      { key: 'reunioes', label: 'Reuniões', href: '/pessoas/reunioes' },
      { key: 'pesquisas', label: 'Pesquisas', href: '/pessoas/pesquisas' },
      { key: 'seguranca-saude', label: 'Segurança e Saúde', href: '/pessoas/seguranca-saude' },
    ],
  },
  {
    key: 'marketing', label: 'Marketing', icon: '📣',
    children: [
      { key: 'calendario', label: 'Calendário', href: '/marketing/calendario' },
      { key: 'depoimentos', label: 'Depoimentos', href: '/marketing/depoimentos' },
      { key: 'fotos-videos', label: 'Fotos e Vídeos', href: '/marketing/fotos-videos' },
      { key: 'material-grafico', label: 'Material Gráfico', href: '/marketing/material-grafico' },
      { key: 'manual-da-marca', label: 'Manual da Marca', href: '/marketing/manual-da-marca' },
    ],
  },
]

export type CustomItemType = 'pasta' | 'formulario' | 'kanban' | 'fluxograma' | 'documento'

export const CUSTOM_TYPE_LABELS: Record<CustomItemType, string> = {
  pasta: 'Pasta',
  formulario: 'Formulário',
  kanban: 'Kanban',
  fluxograma: 'Fluxograma',
  documento: 'Documento/planilha',
}

export const CUSTOM_TYPE_ICONS: Record<CustomItemType, string> = {
  pasta: '📁',
  formulario: '📝',
  kanban: '🗂',
  fluxograma: '🔀',
  documento: '📊',
}

// Só "Pasta" está implementada de verdade nesta primeira entrega — os outros
// 4 tipos reservam o nome e mostram "em desenvolvimento", mesmo padrão do
// protótipo da Carol.
export const CUSTOM_TYPE_IMPLEMENTED: Record<CustomItemType, boolean> = {
  pasta: true,
  formulario: false,
  kanban: false,
  fluxograma: false,
  documento: false,
}

export const AREA_ICON_OPTIONS = ['🏢', '💰', '📦', '👥', '📣', '📁', '⭐', '🎯', '🔧', '📌', '🗂', '💡']
