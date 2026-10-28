-- Nova pasta padrão da Documentação: QSA, logo abaixo de "Contrato Social e alterações" (ordem 2).
-- Empurra as pastas padrão seguintes uma posição para baixo e cria a nova na ordem 3 (só uma vez).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM document_folders WHERE sistema AND nome = 'QSA - Quadro de sócios e administradores'
  ) THEN
    UPDATE document_folders SET ordem = ordem + 1 WHERE sistema AND ordem >= 3;
    INSERT INTO document_folders (nome, sistema, ordem)
    VALUES ('QSA - Quadro de sócios e administradores', true, 3);
  END IF;
END $$;
