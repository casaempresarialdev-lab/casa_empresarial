-- Etapas finais da admissão: a contabilidade é externa. A ficha é baixada e enviada por fora; o sistema registra
-- o envio e o retorno. O contrato assinado é anexado no fim e fica nos documentos do funcionário.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS admissao_contabilidade_enviada_em TIMESTAMPTZ;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS admissao_contabilidade_enviada_por TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS admissao_contabilidade_retorno_em TIMESTAMPTZ;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS doc_contrato_path TEXT;

NOTIFY pgrst, 'reload schema';
