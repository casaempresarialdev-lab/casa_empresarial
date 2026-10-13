-- ============================================================
-- Backfill de ícone nas sub-áreas nativas já semeadas antes dessa mudança
-- (ficaram com icon = '' porque o lazy-seed não preenchia isso ainda).
-- Mapeamento igual ao NATIVE_CATALOG em lib/menu/catalog.ts.
-- ============================================================

UPDATE company_menu_items AS cmi
SET icon = v.icon
FROM (VALUES
  ('minha-empresa', '🏠'),
  ('quadro-societario', '👥'),
  ('logins-senhas', '🔑'),
  ('documentacao', '📁'),
  ('contatos', '🏪'),
  ('centro-de-custo', '🎯'),
  ('categorias', '🏷️'),
  ('contas-cartoes', '💳'),
  ('fluxo-de-caixa', '👛'),
  ('dre', '📊'),
  ('balanco', '⚖️'),
  ('faturas', '🧾'),
  ('produtos', '📦'),
  ('pedidos-compra', '📥'),
  ('pedidos-venda', '🚚'),
  ('ordens-de-servico', '📝'),
  ('frente-de-caixa', '🧾'),
  ('equipe', '👥'),
  ('admissao', '🗂️'),
  ('registro-de-ponto', '🕐'),
  ('escala-de-trabalho', '📅'),
  ('folha-de-pagamento', '💰'),
  ('beneficios', '⭐'),
  ('encargos', '🏛️'),
  ('reunioes', '🤝'),
  ('pesquisas', '💬'),
  ('seguranca-saude', '🛡️'),
  ('calendario', '📅'),
  ('depoimentos', '💬'),
  ('fotos-videos', '📷'),
  ('material-grafico', '🎨'),
  ('manual-da-marca', '📘')
) AS v(key, icon)
WHERE cmi.key = v.key
  AND cmi.natureza = 'nativa'
  AND cmi.parent_id IS NOT NULL
  AND (cmi.icon IS NULL OR cmi.icon = '');
