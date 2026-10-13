-- ============================================================
-- Corrige duplicação de áreas/sub-áreas nativas no menu lateral.
-- Causa: o lazy-seed (getMenuTree) não tinha trava nenhuma contra duas
-- requisições lendo "árvore vazia" ao mesmo tempo e semeando o catálogo
-- duas vezes — sem unique constraint, nada impedia isso.
-- ============================================================

-- 1) Limpa duplicatas já existentes.
--    Áreas (parent_id IS NULL): mantém a que tem mais sub-áreas filhas (ou a
--    mais antiga em empate) e reaponta os filhos das descartadas pra ela antes
--    de apagar — evita perder qualquer pasta/sub-área que a pessoa já tenha
--    criado dentro da área duplicada errada.
DO $$
DECLARE
  dup RECORD;
  keep_id UUID;
BEGIN
  FOR dup IN
    SELECT company_id, key
    FROM company_menu_items
    WHERE parent_id IS NULL AND key IS NOT NULL AND deleted_at IS NULL
    GROUP BY company_id, key
    HAVING COUNT(*) > 1
  LOOP
    SELECT cmi.id INTO keep_id
    FROM company_menu_items cmi
    LEFT JOIN company_menu_items children
      ON children.parent_id = cmi.id AND children.deleted_at IS NULL
    WHERE cmi.company_id = dup.company_id AND cmi.key = dup.key
      AND cmi.parent_id IS NULL AND cmi.deleted_at IS NULL
    GROUP BY cmi.id, cmi.created_at
    ORDER BY COUNT(children.id) DESC, cmi.created_at ASC
    LIMIT 1;

    UPDATE company_menu_items
    SET parent_id = keep_id
    WHERE parent_id IN (
      SELECT id FROM company_menu_items
      WHERE company_id = dup.company_id AND key = dup.key
        AND parent_id IS NULL AND id <> keep_id
    );

    DELETE FROM company_menu_items
    WHERE company_id = dup.company_id AND key = dup.key
      AND parent_id IS NULL AND id <> keep_id;
  END LOOP;
END $$;

-- Sub-áreas nativas (parent_id IS NOT NULL): mesma lógica, mais simples (não
-- têm filhos pra reapontar — só mantém a mais antiga e apaga o resto).
DO $$
DECLARE
  dup RECORD;
  keep_id UUID;
BEGIN
  FOR dup IN
    SELECT company_id, parent_id, key
    FROM company_menu_items
    WHERE parent_id IS NOT NULL AND key IS NOT NULL AND deleted_at IS NULL
    GROUP BY company_id, parent_id, key
    HAVING COUNT(*) > 1
  LOOP
    SELECT id INTO keep_id
    FROM company_menu_items
    WHERE company_id = dup.company_id AND parent_id = dup.parent_id AND key = dup.key
      AND deleted_at IS NULL
    ORDER BY created_at ASC
    LIMIT 1;

    DELETE FROM company_menu_items
    WHERE company_id = dup.company_id AND parent_id = dup.parent_id AND key = dup.key
      AND id <> keep_id;
  END LOOP;
END $$;

-- 2) Trava pra nunca mais duplicar — índice único parcial (ignora itens
--    excluídos logicamente, pra permitir recriar um item com a mesma key
--    depois de excluído).
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_menu_items_unique_area
  ON company_menu_items (company_id, key)
  WHERE parent_id IS NULL AND key IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_company_menu_items_unique_subarea
  ON company_menu_items (company_id, parent_id, key)
  WHERE parent_id IS NOT NULL AND key IS NOT NULL AND deleted_at IS NULL;
