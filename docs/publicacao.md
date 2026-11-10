# Como publicar uma versão

A produção roda na **Vercel**, que publica automaticamente cada envio para o `main` do GitHub. O banco é o **Supabase**, atualizado à mão pelas migrations.

## 1. Durante o desenvolvimento

- Trabalhe numa **branch** (`feat/assunto`). Nunca direto no `main`.
- Commits pequenos, com mensagem em português no formato `feat: ...`, `fix: ...`, `chore: ...` e uma lista do que mudou.
- Não commite `.env.local`, a pasta `.claude/` nem arquivos de teste temporários.

## 2. Antes de publicar

```bash
npm test                 # regras de cálculo
npx tsc --noEmit -p .    # tipos
npm run build            # o mesmo build da Vercel
```

Os três precisam passar. Depois:

1. **Migrations:** liste as migrations novas da branch (`git diff --name-only origin/main..HEAD -- supabase/migrations`) e aplique-as no banco de produção, em ordem (ver [banco-e-migrations.md](banco-e-migrations.md)). Aplique **antes** de enviar o código, para as telas novas já funcionarem completas.
2. **Teste no navegador** os fluxos que mudaram, como gestor e como colaborador (ver o roteiro abaixo).
3. Revise as **pendências** que a versão deixa ([pendencias.md](pendencias.md)).

## 3. Publicar

```bash
git fetch origin
git log --oneline HEAD..origin/main   # vazio = o main não mudou; senão, traga as mudanças antes
git push origin HEAD:main
```

Acompanhe o deploy no painel da Vercel até ficar **Ready**. Se falhar, o site continua na versão anterior; leia o log, corrija e envie de novo.

## 4. Depois de publicar

- **Teste rápido no site** (roteiro abaixo), logado como gestor e como colaborador.
- **Avise os clientes** com o que mudou e o que eles precisam configurar (mensagem curta, por WhatsApp ou e-mail).

**Roteiro de teste rápido**
- [ ] Login, troca de empresa e página inicial (lançadores e calendário).
- [ ] Menu: cada área abre o seu dashboard e os itens respeitam o perfil de acesso.
- [ ] Bater ponto e Meu ponto (pedido de ajuste chega para a gestão e volta como notificação).
- [ ] Férias: pedir, aprovar, baixar o recibo.
- [ ] Folha: conferir, fechar, ver os lançamentos no fluxo de caixa, reabrir.
- [ ] Holerite aparecendo em Meu holerite.

## 5. Desfazer

As migrations só acrescentam, então voltar o código é seguro: reverta o commit no `main` (`git revert <commit>` e `git push origin HEAD:main`). Não apague colunas ou tabelas para desfazer.

## Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Variável | Para quê |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Conexão com o Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Acesso administrativo ao banco, só no servidor |
| `NEXT_PUBLIC_APP_URL` | Endereço do site, usado nos links de e-mail e convites |
| `RESEND_API_KEY`, `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Envio de e-mails |
| `CRON_SECRET` | Protege a rotina agendada `/api/cron/eventos` |

A rotina agendada (`vercel.json`) roda todo dia às 11h UTC (8h de Brasília) e envia os avisos de eventos por e-mail.

Localmente, copie `.env.example` para `.env.local` e peça as chaves a quem administra o projeto.
