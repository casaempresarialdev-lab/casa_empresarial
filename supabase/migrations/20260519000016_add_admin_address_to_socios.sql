ALTER TABLE socios
  ADD COLUMN IF NOT EXISTS administrador boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cep        text,
  ADD COLUMN IF NOT EXISTS uf         text,
  ADD COLUMN IF NOT EXISTS cidade     text,
  ADD COLUMN IF NOT EXISTS logradouro text,
  ADD COLUMN IF NOT EXISTS bairro     text,
  ADD COLUMN IF NOT EXISTS numero     text,
  ADD COLUMN IF NOT EXISTS complemento text;
