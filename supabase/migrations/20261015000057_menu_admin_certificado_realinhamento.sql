-- ============================================================
-- Realinhamento do menu Administrativo com o artefato da Carol (2ª varredura
-- de fidelidade): "Minha Empresa" e "Logins e Senhas" saem do Administrativo
-- (viram itens do menu de perfil, no rodapé do menu lateral) e "Certificado
-- Digital" vira sub-área própria do Administrativo (antes era só um campo
-- dentro do formulário de Minha Empresa).
--
-- Empresas que ainda não tinham a árvore semeada recebem o catálogo novo
-- automaticamente no primeiro acesso (lazy-seed em getMenuTree). Esta
-- migration só corrige quem já tinha sido semeado antes dessa mudança —
-- mesma limitação já conhecida desse padrão (ver 20261013000056).
-- ============================================================

-- "Minha Empresa" e "Logins e Senhas" deixam de ser sub-áreas do menu —
-- exclusão lógica, igual ao resto do sistema.
UPDATE company_menu_items
SET deleted_at = NOW()
WHERE natureza = 'nativa'
  AND key IN ('minha-empresa', 'logins-senhas')
  AND parent_id IS NOT NULL
  AND deleted_at IS NULL;

-- "Certificado Digital" entra como sub-área nativa do Administrativo pra
-- quem já tinha a área mas ainda não tem esse item.
INSERT INTO company_menu_items (company_id, parent_id, key, natureza, tipo, label, icon, href, ordem)
SELECT
  adm.company_id,
  adm.id,
  'certificado',
  'nativa',
  'area',
  NULL,
  '🔒',
  '/admin/certificado-digital',
  COALESCE((SELECT MAX(c2.ordem) + 1 FROM company_menu_items c2 WHERE c2.parent_id = adm.id AND c2.deleted_at IS NULL), 0)
FROM company_menu_items adm
WHERE adm.parent_id IS NULL
  AND adm.key = 'administrativo'
  AND adm.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM company_menu_items c3
    WHERE c3.parent_id = adm.id AND c3.key = 'certificado' AND c3.deleted_at IS NULL
  );
