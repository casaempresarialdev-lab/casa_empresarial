// Padrão das tabelas das telas (definido no Quadro Societário):
// cabeçalho na cor principal, linhas só com borda inferior na cor principal e zebrado de 5%.

/** Wrapper da tabela: rolagem horizontal e cantos de cima arredondados (acompanhando o cabeçalho) */
export const TABLE_WRAPPER_CLASS = 'overflow-x-auto rounded-t-xl'

export const TABLE_HEAD_STYLE = { backgroundColor: 'var(--color-brand)' }

export const TH_CLASS = 'text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white'

export const ROW_CLASS =
  'border-b transition-colors bg-white even:bg-[color-mix(in_srgb,var(--color-brand)_5%,white)] hover:bg-[color-mix(in_srgb,var(--color-brand)_10%,white)]'

export const ROW_STYLE = { borderColor: 'var(--color-brand)' }
