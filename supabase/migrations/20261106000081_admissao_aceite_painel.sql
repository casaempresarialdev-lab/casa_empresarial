-- Aceite da carta registrado pelo painel (candidato aceitou pessoalmente): quem registrou fica guardado
ALTER TABLE admission_offers ADD COLUMN IF NOT EXISTS aceite_registrado_por TEXT;

NOTIFY pgrst, 'reload schema';
