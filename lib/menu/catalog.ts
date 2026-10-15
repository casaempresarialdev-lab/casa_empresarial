import type { AreaKey } from '@/lib/auth/area-permissions'

// Catálogo nativo do Método Casa Empresarial — as 5 áreas fixas e suas
// sub-áreas nativas, com a rota real de cada uma. É o "ponto de partida" do
// menu de toda empresa nova; muda só quando o PRODUTO ganha uma tela nova,
// não quando uma empresa personaliza o próprio menu.
export type NativeSubItem = { key: string; label: string; href: string; icon: string }
export type NativeArea = { key: AreaKey; label: string; icon: string; children: NativeSubItem[] }

// Ícone de cada sub-área nativa — mapeado do próprio código-fonte do artefato da
// Carol (ex.: Fluxo de caixa:'wallet', Admissão:'kanban', Benefícios:'star'),
// traduzido pro conjunto de emoji que o resto do nosso sistema já usa (nosso
// menu não usa biblioteca de ícone SVG, é tudo emoji). Onde uma tela nossa não
// tem equivalente direto no catálogo dela (ex.: Centro de Custo, Encargos), usei
// um ícone semanticamente próximo em vez de inventar algo fora do padrão dela.
export const NATIVE_CATALOG: NativeArea[] = [
  {
    key: 'administrativo', label: 'Administrativo', icon: '🏢',
    children: [
      { key: 'quadro-societario', label: 'Quadro Societário', href: '/admin/quadro-societario', icon: '👥' },
      { key: 'certificado', label: 'Certificado Digital', href: '/admin/certificado-digital', icon: '🔒' },
      { key: 'documentacao', label: 'Documentação', href: '/admin/documentacao', icon: '📁' },
    ],
  },
  {
    key: 'financeiro', label: 'Financeiro', icon: '💰',
    children: [
      { key: 'contatos', label: 'Contatos', href: '/financeiro/contatos', icon: '🏪' },
      { key: 'centro-de-custo', label: 'Centro de Custo', href: '/financeiro/centro-de-custo', icon: '🎯' },
      { key: 'categorias', label: 'Categorias', href: '/financeiro/categorias', icon: '🏷️' },
      { key: 'contas-cartoes', label: 'Contas e Cartões', href: '/financeiro/contas-cartoes', icon: '💳' },
      { key: 'fluxo-de-caixa', label: 'Fluxo de Caixa', href: '/financeiro/fluxo-de-caixa', icon: '👛' },
      { key: 'dre', label: 'DRE', href: '/financeiro/dre', icon: '📊' },
      { key: 'balanco', label: 'Balanço', href: '/financeiro/balanco', icon: '⚖️' },
      { key: 'faturas', label: 'Faturas', href: '/financeiro/faturas', icon: '🧾' },
    ],
  },
  {
    key: 'operacional', label: 'Operacional', icon: '📦',
    children: [
      { key: 'produtos', label: 'Produtos e Serviços', href: '/operacional/produtos', icon: '📦' },
      { key: 'pedidos-compra', label: 'Pedidos de Compra', href: '/operacional/pedidos-compra', icon: '📥' },
      { key: 'pedidos-venda', label: 'Pedidos de Venda', href: '/operacional/pedidos-venda', icon: '🚚' },
      { key: 'ordens-de-servico', label: 'Ordens de Serviço', href: '/operacional/ordens-de-servico', icon: '📝' },
      { key: 'frente-de-caixa', label: 'Frente de Caixa', href: '/operacional/frente-de-caixa', icon: '🧾' },
    ],
  },
  {
    key: 'pessoas', label: 'Pessoas', icon: '👥',
    children: [
      { key: 'equipe', label: 'Equipe', href: '/pessoas/funcionarios', icon: '👥' },
      { key: 'admissao', label: 'Admissão', href: '/pessoas/admissao', icon: '🗂️' },
      { key: 'registro-de-ponto', label: 'Registro de Ponto', href: '/pessoas/registro-de-ponto', icon: '🕐' },
      { key: 'escala-de-trabalho', label: 'Escala de Trabalho', href: '/pessoas/escala-de-trabalho', icon: '📅' },
      { key: 'folha-de-pagamento', label: 'Folha de Pagamento', href: '/pessoas/folha-de-pagamento', icon: '💰' },
      { key: 'beneficios', label: 'Benefícios', href: '/pessoas/beneficios', icon: '⭐' },
      { key: 'encargos', label: 'Encargos', href: '/pessoas/encargos', icon: '🏛️' },
      { key: 'reunioes', label: 'Reuniões', href: '/pessoas/reunioes', icon: '🤝' },
      { key: 'pesquisas', label: 'Pesquisas', href: '/pessoas/pesquisas', icon: '💬' },
      { key: 'seguranca-saude', label: 'Segurança e Saúde', href: '/pessoas/seguranca-saude', icon: '🛡️' },
    ],
  },
  {
    key: 'marketing', label: 'Marketing', icon: '📣',
    children: [
      { key: 'calendario', label: 'Calendário', href: '/marketing/calendario', icon: '📅' },
      { key: 'depoimentos', label: 'Depoimentos', href: '/marketing/depoimentos', icon: '💬' },
      { key: 'fotos-videos', label: 'Fotos e Vídeos', href: '/marketing/fotos-videos', icon: '📷' },
      { key: 'material-grafico', label: 'Material Gráfico', href: '/marketing/material-grafico', icon: '🎨' },
      { key: 'manual-da-marca', label: 'Manual da Marca', href: '/marketing/manual-da-marca', icon: '📘' },
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
