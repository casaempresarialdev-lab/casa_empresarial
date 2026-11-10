-- Quem já respondeu cada pesquisa, só para o lançador sumir da página inicial.
-- Fica separado de survey_responses, sem ligação com as respostas: elas continuam anônimas.
-- Pode ser executada de novo sem efeito colateral.

CREATE TABLE IF NOT EXISTS survey_participations (
  survey_id   UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  DATE NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (survey_id, profile_id)
);

ALTER TABLE survey_participations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "survey_participations_policy" ON survey_participations;
CREATE POLICY "survey_participations_policy" ON survey_participations USING (profile_id = auth.uid());

-- Notificações de segurança e saúde (ASO, treinamento, EPI, vacina) para o colaborador
DO $$ BEGIN
  IF to_regclass('public.notifications') IS NOT NULL THEN
    ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_tipo_check;
    ALTER TABLE notifications ADD CONSTRAINT notifications_tipo_check CHECK (tipo IN ('ponto', 'ausencia', 'ferias', 'folha', 'saude'));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
