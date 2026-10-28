-- Id do usuário (auth.users) dono de um e-mail — para o convite saber se a pessoa já tem conta.
-- Só o servidor (service_role) pode executar: não expõe e-mails para o navegador.
CREATE OR REPLACE FUNCTION public.get_auth_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(trim(p_email)) LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_auth_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_user_id_by_email(text) TO service_role;
