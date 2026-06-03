# Roadmap de Testes — Casa Empresarial v1.0
**Sprint 1 + Sprint 2 | Módulo Administrativo**

> **Para o testador:** Este documento guia você por todas as funcionalidades implementadas até agora. Para cada item, marque ✅ se passou, ❌ se encontrou problema, e anote o bug na seção "Observações" logo abaixo do bloco correspondente. Inclua o que fez, o que esperava acontecer e o que aconteceu de fato.

---

## Ambiente

| Item | Valor |
|------|-------|
| URL local | `http://localhost:3000` |
| Navegador recomendado | Chrome ou Edge (versão recente) |
| Como iniciar o projeto | Abrir terminal na pasta `casa-empresarial/` e rodar `npm run dev` |

---

## Bloco 1 — Cadastro de Novo Usuário

> **O que é:** O fluxo de criação de conta. Um novo usuário passa por três telas: dados pessoais, dados da empresa e aceite dos termos.

### 1.1 — Passo 1: Criar conta pessoal

Acesse: `/cadastro/passo-1`

- [ ] A tela carrega sem erros
- [ ] Os campos obrigatórios são: Nome completo, CPF, E-mail, Senha, Confirmar senha
- [ ] CPF aplica máscara automática ao digitar (`000.000.000-00`)
- [ ] Senha fraca é rejeitada (mínimo 8 caracteres)
- [ ] CPF inválido (dígitos verificadores errados) exibe mensagem de erro
- [ ] E-mail inválido exibe erro
- [ ] Confirmar senha diferente exibe erro
- [ ] Ao preencher tudo corretamente e clicar em "Criar conta", avança para o Passo 2
- [ ] Não é possível criar duas contas com o mesmo e-mail
- [ ] Não é possível criar duas contas com o mesmo CPF

**Observações / Bugs encontrados:**
```
[Descreva aqui: o que fez → o que esperava → o que aconteceu]
```

---

### 1.2 — Passo 2: Cadastrar empresa

Acesse: `/cadastro/passo-2`  
*(redirecionado automaticamente após o Passo 1)*

- [ ] A tela carrega sem erros
- [ ] Campo CNPJ obrigatório com máscara automática (`00.000.000/0000-00`)
- [ ] CNPJ inválido (dígitos verificadores errados) exibe mensagem de erro
- [ ] Campo Razão Social obrigatório
- [ ] Campos opcionais: Nome Fantasia, Regime Tributário, Telefone, E-mail
- [ ] Ao salvar com dados válidos, redireciona para os Termos
- [ ] CNPJ já cadastrado exibe mensagem "Este CNPJ já está cadastrado"
- [ ] Ao recarregar a página (F5) sem ter empresa, continua no Passo 2 (não perde o login)

**Observações / Bugs encontrados:**
```

```

---

### 1.3 — Termos de uso

Acesse: `/cadastro/termos`

- [ ] A tela carrega com o texto dos termos
- [ ] Botão "Aceitar e continuar" redireciona para o Dashboard
- [ ] Botão "Recusar" retorna para a tela anterior

**Observações / Bugs encontrados:**
```

```

---

## Bloco 2 — Login e Recuperação de Senha

> **O que é:** Acesso ao sistema para usuários já cadastrados, e o fluxo para quem esqueceu a senha.

### 2.1 — Login

Acesse: `/login`

- [ ] A tela carrega sem erros
- [ ] E-mail inválido exibe mensagem de erro
- [ ] Senha errada exibe mensagem de erro
- [ ] Credenciais corretas redirecionam para o Dashboard
- [ ] Usuário já logado que acessa `/login` é redirecionado para o Dashboard (não fica preso na tela de login)
- [ ] Link "Esqueci minha senha" leva para `/esqueci-senha`

**Observações / Bugs encontrados:**
```

```

---

### 2.2 — Esqueci minha senha

Acesse: `/esqueci-senha`

- [ ] A tela carrega sem erros
- [ ] Campo de e-mail com validação
- [ ] Ao enviar e-mail cadastrado, exibe mensagem de confirmação de envio
- [ ] Ao enviar e-mail **não** cadastrado, exibe mensagem de erro

> ⚠️ **Nota:** O envio de e-mail real (Resend) ainda não está configurado. O fluxo gera o link, mas o e-mail pode não chegar. Testar com um usuário de teste cuja caixa de entrada você controla, ou verificar diretamente no painel do Supabase > Authentication > Users.

**Observações / Bugs encontrados:**
```

```

---

### 2.3 — Redefinir senha

Acesse: `/nova-senha` *(via link do e-mail de recuperação)*

- [ ] A tela carrega sem erros
- [ ] Campos: Nova senha e Confirmar nova senha
- [ ] Senhas diferentes exibem erro
- [ ] Senha fraca exibe erro
- [ ] Ao salvar com sucesso, redireciona para o Login
- [ ] Após redefinir, consegue fazer login com a nova senha

**Observações / Bugs encontrados:**
```

```

---

## Bloco 3 — Dashboard e Layout Geral

> **O que é:** A tela principal após o login. Exibe métricas da empresa ativa e acesso rápido aos módulos. O layout inclui a sidebar de navegação e o cabeçalho.

### 3.1 — Dashboard

Acesse: `/dashboard`

- [ ] Carrega sem erros após login
- [ ] Exibe saudação com o nome do usuário e a data atual
- [ ] Exibe nome da empresa ativa
- [ ] 4 cards de métricas são exibidos (Saldo Total, Receitas do Mês, Despesas do Mês, A Vencer/Vencidos)
- [ ] Cards com valor zero exibem estado vazio de forma elegante (sem erro)
- [ ] 6 cards de módulos são exibidos (Administrativo, Financeiro, Pessoas, Operacional, Marketing, Minha Empresa)
- [ ] Clicar em um card de módulo navega para a tela correspondente
- [ ] Usuário sem empresa é redirecionado para `/cadastro/passo-2`

**Observações / Bugs encontrados:**
```

```

---

### 3.2 — Sidebar (menu lateral)

- [ ] Sidebar aparece à esquerda da tela em todas as páginas do sistema
- [ ] Botão de retrair/expandir funciona (64px → 240px)
- [ ] Estado expandido/retraído é salvo ao recarregar a página
- [ ] Todos os links de navegação levam para a tela correta
- [ ] Item ativo (página atual) aparece destacado no menu
- [ ] Sidebar funciona em telas menores (sem quebrar o layout)

**Observações / Bugs encontrados:**
```

```

---

### 3.3 — Header (cabeçalho)

- [ ] Exibe o nome da empresa ativa
- [ ] Se o usuário tem mais de uma empresa, o seletor de empresa aparece
- [ ] Trocar de empresa atualiza o Dashboard com os dados da nova empresa
- [ ] Exibe o nome ou avatar do usuário logado
- [ ] Botão de logout funciona e redireciona para `/login`

**Observações / Bugs encontrados:**
```

```

---

## Bloco 4 — Módulo Administrativo: Usuários

> **O que é:** Gerenciamento de quem tem acesso à empresa no sistema. O Proprietário pode adicionar colaboradores, contadores ou outros administradores. Cada usuário adicionado precisa já ter uma conta criada no sistema (Bloco 1).

Acesse: `/admin/usuarios`

### 4.1 — Listagem de membros

- [ ] A tela carrega sem erros
- [ ] O usuário atual aparece na lista com a tag "(você)"
- [ ] A lista exibe: Nome, CPF mascarado, Função (badge colorido), Status (badge), Data de entrada
- [ ] Membros inativos aparecem com opacidade reduzida
- [ ] Membros ativos têm botões "Editar" e "Remover"
- [ ] O próprio usuário logado não tem botão "Remover" ao lado do seu nome

**Observações / Bugs encontrados:**
```

```

---

### 4.2 — Adicionar novo membro

- [ ] Botão "+ Adicionar" abre o modal
- [ ] O modal exibe campo de CPF com máscara e seletor de Função
- [ ] CPF de usuário **não** cadastrado exibe: "Usuário não encontrado. Peça para ele se cadastrar primeiro."
- [ ] CPF já membro ativo exibe: "Este usuário já é membro desta empresa."
- [ ] CPF válido e não membro: adiciona com sucesso e aparece na lista
- [ ] As funções disponíveis para seleção são: Administrador, Membro, Contador
  > *(Nota: Proprietário não pode ser atribuído via este formulário)*
- [ ] Modal fecha ao clicar em "Cancelar" ou fora da janela
- [ ] Modal fecha ao pressionar a tecla ESC

**Observações / Bugs encontrados:**
```

```

---

### 4.3 — Editar função de membro

- [ ] Clicar em "Editar" abre o modal com a função atual pré-selecionada
- [ ] Alterar a função e salvar atualiza o badge na lista
- [ ] Tentativa de editar o Proprietário exibe a função como desabilitada (não pode alterar)
- [ ] Cancelar não salva a alteração

**Observações / Bugs encontrados:**
```

```

---

### 4.4 — Remover membro

- [ ] Clicar em "Remover" exibe confirmação ("Remover [Nome] da empresa?")
- [ ] Confirmar remove o membro (status muda para Inativo)
- [ ] Cancelar na confirmação não faz nada
- [ ] Tentar remover o único Proprietário exibe: "Não é possível remover o único proprietário."

**Observações / Bugs encontrados:**
```

```

---

## Bloco 5 — Módulo Administrativo: Quadro Societário

> **O que é:** Registro dos sócios da empresa com suas respectivas participações societárias (%). Diferente dos Usuários do sistema, um sócio é apenas um registro cadastral — pode ou não ter acesso ao sistema.

Acesse: `/admin/quadro-societario`

### 5.1 — Listagem de sócios

- [ ] A tela carrega sem erros
- [ ] Tela vazia exibe mensagem "Nenhum sócio cadastrado."
- [ ] Com sócios: exibe Nome, CPF, Cargo, Participação (%), Contato
- [ ] Indicador de total de participação aparece quando há ao menos 1 sócio
- [ ] Total acima de 100% exibe aviso em vermelho

**Observações / Bugs encontrados:**
```

```

---

### 5.2 — Adicionar sócio

- [ ] Botão "+ Novo sócio" abre o modal
- [ ] Campo Nome é obrigatório
- [ ] CPF aplica máscara ao digitar
- [ ] Participação aceita apenas números entre 0 e 100
- [ ] Campos opcionais: Cargo, E-mail, Telefone
- [ ] Salvar com nome preenchido cria o sócio e atualiza a lista
- [ ] Salvar sem nome exibe erro de campo obrigatório

**Observações / Bugs encontrados:**
```

```

---

### 5.3 — Editar sócio

- [ ] Clicar em "Editar" abre o modal com dados pré-preenchidos
- [ ] Alterar qualquer campo e salvar atualiza a lista
- [ ] Cancelar não salva alterações

**Observações / Bugs encontrados:**
```

```

---

### 5.4 — Excluir sócio

- [ ] Clicar em "Excluir" pede confirmação
- [ ] Confirmar remove permanentemente o sócio da lista
- [ ] Cancelar não faz nada

**Observações / Bugs encontrados:**
```

```

---

## Bloco 6 — Módulo Administrativo: Logins e Senhas (Cofre)

> **O que é:** Um cofre seguro para guardar credenciais de acesso a outros sistemas (banco, redes sociais, sistemas fiscais etc.). As senhas são **criptografadas** antes de serem salvas — ninguém vê a senha em texto puro no banco de dados. Para ver uma senha salva, é necessário clicar em "Ver" dentro do sistema.

Acesse: `/admin/logins-senhas`

### 6.1 — Listagem de credenciais

- [ ] A tela carrega sem erros
- [ ] Tela vazia exibe mensagem "Nenhuma credencial cadastrada."
- [ ] Com credenciais: exibe Sistema, Login, Senha (oculta com `••••••••`), URL
- [ ] A senha NÃO aparece em texto puro na listagem por padrão

**Observações / Bugs encontrados:**
```

```

---

### 6.2 — Adicionar credencial

- [ ] Botão "+ Nova credencial" abre o modal
- [ ] Campos obrigatórios: Sistema e Login
- [ ] Campo Senha obrigatório na criação, com botão "Mostrar/Ocultar"
- [ ] Campos opcionais: URL e Observação
- [ ] Salvar com os campos obrigatórios preenchidos cria a credencial
- [ ] A senha salva aparece como `••••••••` na lista (não em texto puro)

**Observações / Bugs encontrados:**
```

```

---

### 6.3 — Ver senha (descriptografar)

- [ ] Clicar em "Ver" ao lado da senha exibe o texto da senha em claro
- [ ] O botão muda para "Ocultar" após revelar
- [ ] Clicar em "Ocultar" esconde a senha novamente
- [ ] Botão "Copiar" copia a senha para a área de transferência
- [ ] Ao recarregar a página, todas as senhas voltam a ficar ocultas

**Observações / Bugs encontrados:**
```

```

---

### 6.4 — Editar credencial

- [ ] Clicar em "Editar" abre o modal com Sistema, Login, URL e Observação pré-preenchidos
- [ ] Campo Senha aparece vazio (não exibe a senha atual por segurança)
- [ ] Deixar o campo Senha em branco mantém a senha antiga
- [ ] Preencher o campo Senha substitui a senha antiga pela nova
- [ ] Cancelar não salva alterações

**Observações / Bugs encontrados:**
```

```

---

### 6.5 — Excluir credencial

- [ ] Clicar em "Excluir" pede confirmação com o nome do sistema
- [ ] Confirmar remove a credencial permanentemente
- [ ] Cancelar não faz nada

**Observações / Bugs encontrados:**
```

```

---

## Bloco 7 — Testes de Segurança Básicos

> **O que é:** Verificações para garantir que o sistema não permite acesso indevido.

- [ ] Acessar `/dashboard` sem estar logado redireciona para `/login`
- [ ] Acessar `/admin/usuarios` sem estar logado redireciona para `/login`
- [ ] Após logout, pressionar o botão Voltar do navegador não acessa o sistema (redireciona para `/login`)
- [ ] A senha de uma empresa não aparece visível em nenhuma requisição da aba Network do DevTools

**Observações / Bugs encontrados:**
```

```

---

## Resumo Geral

Ao concluir todos os blocos, preencha a tabela abaixo:

| Bloco | Status | Bugs encontrados |
|-------|--------|-----------------|
| 1 — Cadastro | ⬜ Não testado | — |
| 2 — Login e Senha | ⬜ Não testado | — |
| 3 — Dashboard e Layout | ⬜ Não testado | — |
| 4 — Usuários | ⬜ Não testado | — |
| 5 — Quadro Societário | ⬜ Não testado | — |
| 6 — Logins e Senhas | ⬜ Não testado | — |
| 7 — Segurança Básica | ⬜ Não testado | — |

**Status:** ⬜ Não testado · ✅ Aprovado · ⚠️ Aprovado com ressalvas · ❌ Reprovado

---

## Como registrar um bug

Use este formato para cada problema encontrado:

```
BUG #001
Bloco: [número e nome]
Passos para reproduzir:
  1. Acessei a tela X
  2. Cliquei em Y
  3. Preenchi o campo Z com "..."
Resultado esperado: [o que deveria acontecer]
Resultado obtido: [o que aconteceu de fato]
Gravidade: Crítico / Alto / Médio / Baixo
Print: [anexar imagem se possível]
```

---

*Documento gerado em 07/05/2026 — Casa Empresarial v1.0 (Sprint 1 + Sprint 2)*
