-- Admissão aberta direto no sistema, escolhendo a vaga: vira uma candidatura sem currículo, e o CPF pode vir depois.
ALTER TABLE job_applications ALTER COLUMN cpf DROP NOT NULL;
ALTER TABLE job_applications ALTER COLUMN anexo_path DROP NOT NULL;
ALTER TABLE job_applications ALTER COLUMN anexo_nome DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
