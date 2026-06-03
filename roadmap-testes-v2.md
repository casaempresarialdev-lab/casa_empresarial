# Roadmap de Testes — Casa Empresarial v2.0
**Sprint 3 (Pessoas) + Sprint 4 parcial (Operacional O1–O3) + Empresa + Admin atualizações**

> **Para o testador:** Este documento cobre tudo implementado após a v1.0. Para cada item, marque ✅ se passou ou ❌ se encontrou problema. Registre bugs no formato padrão no final do documento. Leia a descrição de cada bloco antes de começar — ela explica o propósito da funcionalidade.

---

## Ambiente

| Item | Valor |
|------|-------|
| URL de produção | `https://[seu-domínio].vercel.app` |
| URL local | `http://localhost:3000` |
| Iniciar localmente | `npm run dev` na pasta `casa-empresarial/` |
| Pré-requisito | Ter uma conta criada e uma empresa cadastrada (cobertos no roadmap v1.0) |

---

## Bloco 1 — Configuração da Empresa (`/empresa`)

> **O que é:** Tela para cadastrar e editar todos os dados da empresa: informações gerais, documentos fiscais, identidade visual (logo e cor), certificado digital e endereço. Se a empresa ainda não tem dados cadastrados, funciona como criação. Se já tem, carrega tudo pré-preenchido para edição.

Acesse: `/empresa`

### 1.1 — Carregamento da página

- [ ] A tela carrega sem erros
- [ ] Empresa com dados já cadastrados: todos os campos aparecem pré-preenchidos corretamente
- [ ] Empresa sem dados (recém-criada): formulário aparece vazio
- [ ] O campo CNPJ aparece **somente leitura** (não pode ser alterado após o cadastro)
- [ ] O botão no rodapé exibe "Salvar alterações" quando editando

### 1.2 — Seção: Dados da Empresa

- [ ] Campo Razão Social é obrigatório
- [ ] Campo Nome Fantasia é opcional
- [ ] Campo Regime Tributário é seletor com as opções (Simples Nacional, Lucro Presumido, Lucro Real, MEI)
- [ ] Campos Telefone e E-mail são opcionais
- [ ] Salvar com Razão Social preenchida salva com sucesso
- [ ] Após salvar, os dados permanecem na tela (não limpa o formulário)

### 1.3 — Seção: Documentos Fiscais

- [ ] Campo Inscrição Estadual (IE) é opcional e aceita texto livre
- [ ] Campo Inscrição Municipal (IM) é opcional e aceita texto livre
- [ ] Salvar com campos opcionais em branco funciona normalmente

### 1.4 — Seção: Identidade Visual

- [ ] É possível fazer upload de uma imagem de logo (formatos aceitos: JPG, PNG, WebP)
- [ ] Após upload, a logo aparece na pré-visualização
- [ ] Logo carregada persiste após recarregar a página
- [ ] Campo de cor primária exibe um seletor de cor (color picker)
- [ ] A cor selecionada é salva e carregada corretamente na próxima visita

### 1.5 — Seção: Certificado Digital

- [ ] É possível fazer upload de arquivo .pfx ou .p12
- [ ] Após upload com sucesso, exibe confirmação de arquivo enviado
- [ ] Tentar enviar arquivo de formato incorreto (ex: .txt) exibe erro

### 1.6 — Seção: Endereço

- [ ] Campo CEP aplica máscara (`00000-000`)
- [ ] Ao digitar um CEP válido e sair do campo (Tab ou clique fora), os campos Logradouro, Bairro, Cidade e UF são preenchidos automaticamente via ViaCEP
- [ ] CEP inválido ou inexistente exibe mensagem de erro
- [ ] Campos de endereço podem ser editados manualmente após o autopreenchimento
- [ ] Campo Número é livre (texto)
- [ ] Campo Complemento é opcional

**Observações / Bugs encontrados:**
```
[Descreva: o que fez → o que esperava → o que aconteceu]
```

---

## Bloco 2 — Módulo Administrativo: Documentação (`/admin/documentacao`)

> **O que é:** Repositório privado de arquivos da empresa — contratos, alvarás, certidões, qualquer documento. Os arquivos são armazenados de forma segura (bucket privado) e o download gera um link temporário válido por 1 hora.

Acesse: `/admin/documentacao`

### 2.1 — Listagem de documentos

- [ ] A tela carrega sem erros
- [ ] Tela vazia exibe mensagem "Nenhum documento cadastrado."
- [ ] Com documentos: exibe Nome, Tipo (ícone), Tamanho, Data de upload
- [ ] Ícone diferente para PDF, imagem e outros tipos de arquivo
- [ ] Campo de busca filtra documentos em tempo real por nome

### 2.2 — Upload de documento

- [ ] Botão "+ Enviar documento" abre o seletor de arquivo do sistema operacional
- [ ] Após selecionar o arquivo, o upload é iniciado com feedback visual (barra de progresso ou mensagem)
- [ ] Após upload com sucesso, o arquivo aparece na lista
- [ ] É possível enviar múltiplos arquivos diferentes (um por vez)
- [ ] Arquivo grande (acima de 5 MB) — verificar se há limite e mensagem clara

### 2.3 — Download de documento

- [ ] Clicar em "Baixar" ao lado de um documento baixa o arquivo no navegador
- [ ] O arquivo baixado está íntegro (abre corretamente após o download)
- [ ] O link de download não é permanente (expira após 1 hora — não é necessário testar a expiração, mas verificar que o download via URL direta não funciona sem autenticação)

### 2.4 — Excluir documento

- [ ] Clicar em "Excluir" pede confirmação com o nome do arquivo
- [ ] Confirmar remove o documento da lista e do armazenamento
- [ ] Cancelar não faz nada
- [ ] Após excluir, o arquivo não aparece mais na lista

**Observações / Bugs encontrados:**
```

```

---

## Bloco 3 — Módulo Administrativo: Quadro Societário atualizado (`/admin/quadro-societario`)

> **O que é:** Registro dos sócios da empresa. Nesta versão foram adicionados o campo "Sócio Administrador" (toggle) e o endereço completo do sócio com autopreenchimento por CEP.

Acesse: `/admin/quadro-societario`

### 3.1 — Listagem (atualizada)

- [ ] Colunas exibidas: Nome, CPF, Cargo, **Administrador** (badge "Sim"/"Não")
- [ ] Badge "Sim" aparece em verde para sócios administradores
- [ ] Badge "Não" aparece em cinza para sócios sem poder de administração

### 3.2 — Cadastro/Edição — Sócio Administrador

- [ ] Modal exibe toggle "Sócio Administrador" com estado inicial desativado
- [ ] Ativar o toggle e salvar persiste o status de administrador
- [ ] Desativar o toggle e salvar atualiza o badge na listagem
- [ ] Campo "Cargo" é independente do toggle (pode ser administrador sem cargo preenchido)

### 3.3 — Cadastro/Edição — Endereço do sócio

- [ ] Seção de endereço aparece no modal
- [ ] Campo CEP com máscara e autopreenchimento via ViaCEP (igual à empresa)
- [ ] CEP inválido exibe mensagem de erro
- [ ] Campos de endereço editáveis manualmente
- [ ] Endereço salvo aparece nos detalhes do sócio ao reabrir o modal de edição

**Observações / Bugs encontrados:**
```

```

---

## Bloco 4 — Módulo Administrativo: Convite por E-mail (`/admin/usuarios`)

> **O que é:** Complemento ao sistema de usuários. Além de adicionar usuários já cadastrados por CPF, agora é possível convidar por e-mail pessoas que ainda não têm conta no sistema. O convidado recebe um e-mail com link para criar senha e ao aceitar já entra diretamente na empresa.

Acesse: `/admin/usuarios`

### 4.1 — Modal com duas abas

- [ ] Botão "+ Adicionar" abre o modal
- [ ] Modal exibe duas abas: "Buscar por CPF" e "Convidar por e-mail"
- [ ] Clicar entre as abas alterna o conteúdo sem fechar o modal
- [ ] Aba "Buscar por CPF" funciona como antes (coberta no roadmap v1)

### 4.2 — Convidar por e-mail

- [ ] Aba "Convidar por e-mail" exibe campo de e-mail e seletor de função
- [ ] Campo de e-mail valida formato (rejeita "nome@" ou "nome" sem domínio)
- [ ] Seletor de função tem as opções: Administrador, Membro, Contador
- [ ] Enviar convite com e-mail válido: exibe mensagem de sucesso
- [ ] O convite enviado aparece na tabela "Convites pendentes" abaixo da lista de membros
- [ ] Tabela de convites exibe: E-mail, Função (badge), Data do convite, botão "Cancelar"
- [ ] Tentar convidar e-mail que já é membro ativo exibe mensagem de erro
- [ ] Tentar convidar o mesmo e-mail duas vezes (convite já pendente) exibe mensagem de erro

### 4.3 — Aceitar o convite (fluxo do convidado)

> ⚠️ **Para este teste, use dois navegadores ou uma janela anônima para simular o convidado.**

- [ ] O convidado recebe e-mail com o link de convite
- [ ] Clicar no link leva para a tela de criar senha (definir nova senha)
- [ ] Após criar a senha, o convidado é redirecionado para o Dashboard da empresa que o convidou
- [ ] Na lista de membros da empresa, o convidado aparece com a função definida no convite
- [ ] Na tabela de convites pendentes, o status do convite some (foi aceito)

### 4.4 — Cancelar convite

- [ ] Clicar em "Cancelar" na tabela de convites pede confirmação
- [ ] Confirmar remove o convite da tabela
- [ ] O convidado que tentar usar o link cancelado é bloqueado (não entra na empresa)

**Observações / Bugs encontrados:**
```

```

---

## Bloco 5 — Módulo Pessoas: Funcionários (`/pessoas/funcionarios`)

> **O que é:** Cadastro completo da equipe CLT da empresa. Armazena dados pessoais, profissionais (cargo, departamento, salário, data de admissão) e benefícios (plano de saúde, vale refeição, vale transporte etc.) de cada funcionário.

Acesse: `/pessoas/funcionarios`

### 5.1 — Listagem

- [ ] A tela carrega sem erros
- [ ] Tela vazia exibe mensagem "Nenhum funcionário cadastrado."
- [ ] Com funcionários: exibe Nome (com departamento abaixo), Cargo, CPF, Status (badge colorido), Data de admissão
- [ ] Badges de status: Ativo (verde), Em experiência (azul), Em admissão (amarelo), Inativo (cinza), Demitido (vermelho)
- [ ] Campo de busca filtra por nome, cargo, departamento ou CPF em tempo real

### 5.2 — Cadastrar funcionário

- [ ] Botão "+ Novo funcionário" abre o modal
- [ ] Modal tem 3 seções: Dados Pessoais, Dados Profissionais, Benefícios
- [ ] **Dados Pessoais:** Nome completo (obrigatório), CPF com máscara, E-mail, Telefone, Data de nascimento
- [ ] **Dados Profissionais:** Cargo (obrigatório), Departamento, Data de admissão (obrigatório), Salário, Status, Regime de trabalho (CLT/PJ/Estagiário)
- [ ] **Benefícios:** Toggles individuais para Plano de Saúde, Plano Odontológico, Vale Refeição, Vale Transporte, Vale Alimentação, Seguro de Vida
- [ ] Campo "Data de demissão" só aparece quando Status = "Demitido"
- [ ] Salvar com Nome, Cargo e Data de admissão preenchidos cria o funcionário
- [ ] Funcionário criado aparece na listagem imediatamente

### 5.3 — Editar funcionário

- [ ] Clicar em "Editar" abre o modal com todos os dados pré-preenchidos
- [ ] Alterar qualquer campo e salvar atualiza a listagem
- [ ] Mudando status para "Demitido", o campo Data de demissão aparece
- [ ] Mudando status para outro, o campo Data de demissão some
- [ ] Cancelar não salva alterações

### 5.4 — Excluir funcionário

- [ ] Clicar em "Excluir" pede confirmação com o nome
- [ ] Confirmar remove o funcionário da lista
- [ ] Cancelar não faz nada

**Observações / Bugs encontrados:**
```

```

---

## Bloco 6 — Módulo Pessoas: Prestadores de Serviço (`/pessoas/prestadores`)

> **O que é:** Cadastro de autônomos, freelancers e empresas que prestam serviços para a empresa (PJ). Diferente dos funcionários, não têm vínculo CLT. Pode ser Pessoa Física (CPF) ou Pessoa Jurídica (CNPJ).

Acesse: `/pessoas/prestadores`

### 6.1 — Listagem

- [ ] A tela carrega sem erros
- [ ] Tela vazia exibe "Nenhum prestador cadastrado."
- [ ] Com prestadores: exibe Nome, CPF ou CNPJ (com máscara), Tipo (PF/PJ badge), Serviço, Valor/hora
- [ ] CPF exibe máscara `000.000.000-00` e CNPJ exibe `00.000.000/0000-00`

### 6.2 — Cadastrar prestador

- [ ] Botão "+ Novo prestador" abre o modal
- [ ] Modal exibe toggle "Pessoa Física / Pessoa Jurídica" no topo
- [ ] **Com PF selecionado:** campo exibe "CPF" com máscara de CPF
- [ ] **Com PJ selecionado:** campo exibe "CNPJ" com máscara de CNPJ
- [ ] Trocar de PF para PJ (ou vice-versa) **limpa** o campo de documento e aplica a nova máscara
- [ ] Campo Nome/Razão Social é obrigatório
- [ ] Campos Serviço, Valor/hora e E-mail são opcionais
- [ ] Salvar com Nome preenchido cria o prestador

### 6.3 — Editar e Excluir

- [ ] Editar abre modal com dados pré-preenchidos (incluindo tipo PF/PJ correto)
- [ ] Excluir pede confirmação e remove o prestador

**Observações / Bugs encontrados:**
```

```

---

## Bloco 7 — Módulo Pessoas: Registro de Ponto (`/pessoas/registro-de-ponto`)

> **O que é:** Controle de presença diário dos funcionários. Registra o horário de entrada e saída (calculando horas trabalhadas automaticamente) ou o tipo do dia (folga, férias, falta). Exibe métricas mensais por funcionário e permite navegar entre meses.

Acesse: `/pessoas/registro-de-ponto`

### 7.1 — Navegação por período

- [ ] A tela abre no mês e ano atuais
- [ ] Botões `<` e `>` ao lado do mês/ano mudam o período e recarregam os dados
- [ ] A URL muda ao navegar (ex: `?mes=3&ano=2026`)
- [ ] Copiar e colar a URL com parâmetros abre diretamente no período correto

### 7.2 — Cards de métricas

- [ ] Três cards no topo: **Dias Trabalhados**, **Faltas**, **Férias/Folgas**
- [ ] Os valores refletem os registros do período selecionado (verificar com dados cadastrados)

### 7.3 — Filtro por funcionário

- [ ] Seletor de funcionário acima da tabela
- [ ] "Todos os funcionários" exibe todos os registros
- [ ] Selecionar um funcionário filtra a tabela mostrando apenas os registros dele
- [ ] Ao trocar o filtro, a tabela atualiza sem recarregar a página

### 7.4 — Listagem de registros

- [ ] Tabela exibe: Funcionário, Data, Tipo (badge), Entrada, Saída, Horas trabalhadas
- [ ] Tipo: "Trabalho" (azul), "Folga" (cinza), "Férias" (verde), "Falta" (vermelho)
- [ ] Para registros do tipo **Folga/Férias/Falta**: colunas Entrada, Saída e Horas aparecem como "—" (não há horário)
- [ ] Para registros do tipo **Trabalho**: exibe os horários e o total de horas calculado

### 7.5 — Cadastrar registro de ponto

- [ ] Botão "+ Novo registro" abre o modal
- [ ] Modal tem: seletor de Funcionário (obrigatório), campo Data, seletor de Tipo
- [ ] **Tipo "Trabalho":** campos Entrada (hora) e Saída (hora) aparecem
- [ ] **Tipo "Folga", "Férias" ou "Falta":** campos Entrada e Saída **somem** automaticamente
- [ ] Salvar registro do tipo Trabalho com horários válidos: horas trabalhadas calculadas e exibidas na lista
- [ ] Salvar registro de Falta sem horários: funciona normalmente

### 7.6 — Editar e Excluir

- [ ] Editar abre modal com dados pré-preenchidos
- [ ] Seletor de Funcionário fica **desabilitado** na edição (não pode trocar o funcionário de um registro existente)
- [ ] Alterar tipo de "Trabalho" para "Férias" no modal: campos de hora somem
- [ ] Excluir pede confirmação e remove o registro

**Observações / Bugs encontrados:**
```

```

---

## Bloco 8 — Módulo Pessoas: Escala de Trabalho (`/pessoas/escala-de-trabalho`)

> **O que é:** Planejamento dos turnos de trabalho dos funcionários. Permite visualizar o calendário mensal (ver quem trabalha em qual dia) ou a lista de turnos. Suporta presets de turno (Manhã, Tarde, Noite) ou horário personalizado. Se uma escala já existe para um funcionário em um dia, ela é substituída automaticamente (não duplica).

Acesse: `/pessoas/escala-de-trabalho`

### 8.1 — Navegação por período

- [ ] Abre no mês/ano atual
- [ ] Botões `<` e `>` navegam entre meses
- [ ] URL reflete o período (`?mes=&ano=`)

### 8.2 — View Calendário

- [ ] Botão "Calendário" exibe grade mensal com dias da semana no topo
- [ ] Cada dia exibe os turnos cadastrados (nome do funcionário + turno)
- [ ] Dias sem escala exibem um botão "+" ao passar o mouse
- [ ] Clicar no "+" de um dia abre o modal com a data já pré-preenchida
- [ ] Dias do mês anterior/posterior aparecem acinzentados (somente preenchimento visual)

### 8.3 — View Lista

- [ ] Botão "Lista" exibe tabela com todos os turnos do mês
- [ ] Colunas: Funcionário, Data, Turno (badge), Entrada, Saída
- [ ] Badges de turno: Manhã (amarelo), Tarde (azul), Noite (roxo), Personalizado (cinza)

### 8.4 — Cadastrar/editar turno

- [ ] Modal exibe: seletor de Funcionário, campo Data, seletor de Turno, campos Hora Início e Hora Fim
- [ ] **Preset Manhã:** preenche automaticamente Turno=Manhã, Início=06:00, Fim=14:00
- [ ] **Preset Tarde:** preenche automaticamente Turno=Tarde, Início=14:00, Fim=22:00
- [ ] **Preset Noite:** preenche automaticamente Turno=Noite, Início=22:00, Fim=06:00
- [ ] **Personalizado:** mantém Turno=Personalizado e permite digitar os horários livremente
- [ ] Salvar um turno para um funcionário em um dia já existente **substitui** o turno anterior (não cria duplicata)
- [ ] Confirmar no calendário: o turno aparece no dia correto

### 8.5 — Excluir turno

- [ ] Botão "Excluir" pede confirmação e remove o turno
- [ ] Calendário atualiza após exclusão

**Observações / Bugs encontrados:**
```

```

---

## Bloco 9 — Módulo Pessoas: Reuniões (`/pessoas/reunioes`)

> **O que é:** Gerenciamento de reuniões internas de RH/Pessoas (diferente das reuniões de Marketing, que ficam em outro módulo). Cada reunião tem 3 seções: informações gerais, lista de participantes e pauta/ata.

Acesse: `/pessoas/reunioes`

### 9.1 — Listagem e métricas

- [ ] A tela carrega sem erros
- [ ] Cards de contagem no topo: Agendada, Realizada, Cancelada (com o número de cada status)
- [ ] Clicar em um card filtra a lista por aquele status
- [ ] Clicar no card ativo novamente remove o filtro (exibe todas)
- [ ] Campo de busca filtra por título ou local
- [ ] Tela vazia exibe "Nenhuma reunião cadastrada."

### 9.2 — Cadastrar reunião — Aba "Informações"

- [ ] Botão "+ Nova reunião" abre o modal com 3 abas
- [ ] Aba "Informações" contém: Título (obrigatório), Data, Hora, Local, Status (seletor)
- [ ] Status disponíveis: Agendada, Realizada, Cancelada
- [ ] Salvar com apenas Título preenchido funciona

### 9.3 — Aba "Participantes"

- [ ] Campos: Nome e E-mail (opcional) + botão "+ Adicionar"
- [ ] Clicar em "+ Adicionar" (ou pressionar Enter no campo) adiciona o participante à lista abaixo
- [ ] Participante na lista exibe Nome e E-mail, com botão "✕" para remover
- [ ] Clicar "✕" remove o participante da lista antes de salvar
- [ ] É possível adicionar vários participantes

### 9.4 — Aba "Pauta e Ata"

- [ ] Área de texto "Pauta" para registrar os tópicos a discutir
- [ ] Área de texto "Ata" para registrar o que foi discutido (preenchida pós-reunião)
- [ ] Ambas são opcionais e de texto livre

### 9.5 — Salvar, editar e excluir

- [ ] Salvar cria a reunião e ela aparece na listagem no status correto
- [ ] Editar abre modal com todas as abas pré-preenchidas (incluindo participantes e ata)
- [ ] Alterar status para "Realizada" e salvar: badge muda na listagem
- [ ] Excluir pede confirmação e remove a reunião

**Observações / Bugs encontrados:**
```

```

---

## Bloco 10 — Módulo Operacional: Produtos e Serviços (`/operacional/produtos`)

> **O que é:** Catálogo de produtos físicos e serviços que a empresa vende. Produtos têm controle de estoque e preço de custo/venda (com margem calculada automaticamente). Serviços não têm estoque. Itens inativos ficam ocultos dos pedidos mas não são excluídos.

Acesse: `/operacional/produtos`

### 10.1 — Listagem e métricas

- [ ] A tela carrega sem erros
- [ ] Cards de métricas: Total de Produtos, Produtos Ativos, Estoque Baixo (com alertas)
- [ ] Tabela exibe: Nome, SKU, Tipo (badge Produto/Serviço), Preço Venda, Estoque (ou "Serviço"), Margem (%), Status toggle
- [ ] Linha com estoque abaixo do mínimo exibe ícone de alerta ⚠️
- [ ] Produtos inativos aparecem com opacidade reduzida (acinzentado)
- [ ] Filtros: busca por nome/SKU, seletor de Tipo, seletor de Status (Ativo/Inativo)

### 10.2 — Cadastrar produto

- [ ] Botão "+ Novo produto" abre o modal
- [ ] Toggle "Produto / Serviço" no topo do modal
- [ ] **Tipo Produto:** exibe campos Estoque Atual, Estoque Mínimo, Unidade de Medida
- [ ] **Tipo Serviço:** campos de estoque **somem** automaticamente
- [ ] Campos: Nome (obrigatório), Descrição, SKU, Código de Barras, Categoria, Preço de Venda, Preço de Custo
- [ ] **Margem (%)** calculada em tempo real: exibida no formulário conforme Venda e Custo são preenchidos
- [ ] A margem **não** é um campo editável — é somente leitura (calculada automaticamente)
- [ ] Salvar com Nome preenchido cria o produto/serviço
- [ ] Produto criado aparece na listagem

### 10.3 — Ativar/Inativar (toggle inline)

- [ ] Clicar no toggle de status na linha do produto/serviço muda o status sem abrir modal
- [ ] Produto ativado: opacidade volta ao normal, toggle vai para "Ativo"
- [ ] Produto inativado: linha fica acinzentada, toggle vai para "Inativo"
- [ ] A mudança persiste após recarregar a página

### 10.4 — Editar e Excluir

- [ ] Editar abre modal com dados pré-preenchidos (tipo correto, estoque, preços)
- [ ] Alterar tipo de Produto para Serviço: campos de estoque somem
- [ ] Excluir pede confirmação e remove permanentemente

**Observações / Bugs encontrados:**
```

```

---

## Bloco 11 — Módulo Operacional: Pedidos de Compra (`/operacional/pedidos-compra`)

> **O que é:** Gerenciamento de compras da empresa com fornecedores. Um pedido passa por 4 estágios: Rascunho → Enviado (ao fornecedor) → Confirmado (pelo fornecedor) → Recebido. O valor total é calculado automaticamente a partir dos itens. O preço pré-preenchido usa o preço de **custo** do produto.
>
> ⚠️ **Importante:** O seletor de fornecedor usa contatos do Módulo Financeiro. Se o Financeiro ainda não foi implementado, a lista de fornecedores estará vazia — isso é esperado. O pedido pode ser criado sem fornecedor.

Acesse: `/operacional/pedidos-compra`

### 11.1 — Listagem e métricas

- [ ] A tela carrega sem erros
- [ ] Cards de status clicáveis: Rascunho, Enviado, Confirmado, Recebido, Cancelado (com contagem)
- [ ] Clicar em um card filtra a tabela por aquele status
- [ ] Tabela exibe: Nº (formato #001), Fornecedor, Data, Previsão de entrega, Itens (quantidade), Total, Status (badge)
- [ ] Tela vazia exibe "Nenhum pedido de compra cadastrado."

### 11.2 — Criar pedido — Aba "Dados do Pedido"

- [ ] Botão "+ Novo pedido" abre o modal com 2 abas
- [ ] Aba "Dados": Fornecedor (opcional), Data do Pedido (pré-preenchida com hoje), Previsão de entrega, Status, Observação
- [ ] O número do pedido é gerado **automaticamente** pelo sistema (não é um campo editável)

### 11.3 — Aba "Itens"

- [ ] Seletor "Selecionar do catálogo" lista os produtos/serviços ativos da empresa
- [ ] Ao selecionar um produto do catálogo: Nome e **Preço de Custo** são preenchidos automaticamente
- [ ] É possível adicionar item sem selecionar do catálogo (digitar nome manualmente)
- [ ] Campos do item: Qtd, Preço unitário (editáveis), botão "+ Adicionar"
- [ ] Clicar "+ Adicionar" (ou Enter) adiciona o item à lista abaixo
- [ ] Lista de itens: Nome, Qtd (editável inline), Preço unitário (editável inline), Subtotal, botão ✕ para remover
- [ ] Alterar Qtd ou Preço na lista recalcula o Subtotal do item
- [ ] Rodapé da lista: exibe **Total** somado de todos os itens
- [ ] Remover item atualiza o Total

### 11.4 — Avançar status (workflow)

- [ ] Pedido em **Rascunho**: botão "Enviar" na linha da tabela
- [ ] Pedido **Enviado**: botão "Confirmado" na linha
- [ ] Pedido **Confirmado**: botão "Recebido" na linha
- [ ] Pedido **Recebido** ou **Cancelado**: sem botão de avanço
- [ ] Clicar no botão avança o status e o badge atualiza na listagem sem abrir modal

### 11.5 — Editar e Excluir

- [ ] Editar abre modal com dados pré-preenchidos (incluindo lista de itens)
- [ ] É possível adicionar ou remover itens na edição
- [ ] Excluir pede confirmação e remove permanentemente

**Observações / Bugs encontrados:**
```

```

---

## Bloco 12 — Módulo Operacional: Pedidos de Venda (`/operacional/pedidos-venda`)

> **O que é:** Gerenciamento das vendas da empresa. Um pedido passa por até 6 estágios: Rascunho → Confirmado → Em Produção → Enviado → Entregue (mais Cancelado). Possui desconto global e forma de pagamento. O preço pré-preenchido usa o preço de **venda** do produto.
>
> ⚠️ **Importante:** O seletor de cliente usa contatos do Módulo Financeiro. Se não implementado, a lista estará vazia — esperado. O pedido pode ser criado sem cliente.

Acesse: `/operacional/pedidos-venda`

### 12.1 — Listagem e métricas

- [ ] A tela carrega sem erros
- [ ] Total exibido no subtítulo: soma de todos os pedidos **não cancelados**
- [ ] 6 cards de status clicáveis: Rascunho, Confirmado, Em Produção, Enviado, Entregue, Cancelado
- [ ] Clicar em um card filtra a tabela
- [ ] Tabela exibe: Nº, Cliente, Data, Previsão de entrega, Forma de pagamento, Total (com desconto abaixo se houver), Status

### 12.2 — Criar pedido — Aba "Dados do Pedido"

- [ ] Aba "Dados": Cliente (opcional), Data, Previsão de entrega, Forma de pagamento, Desconto (R$), Status, Observação
- [ ] Formas de pagamento disponíveis: Dinheiro, Pix, Cartão de Crédito, Cartão de Débito, Boleto, Outro
- [ ] Campo Desconto aceita valor em reais (ex: `50` ou `50,00`)

### 12.3 — Aba "Itens" e resumo financeiro

- [ ] Funciona igual ao Pedido de Compra, mas o preço pré-preenchido é o **Preço de Venda** (não custo)
- [ ] Resumo financeiro no rodapé da lista de itens:
  - **Subtotal:** soma dos itens
  - **Desconto:** valor informado na aba Dados (aparece em vermelho somente se > 0)
  - **Total:** subtotal − desconto
- [ ] O Total **não pode ficar negativo** (se desconto > subtotal, total fica em R$ 0,00)

### 12.4 — Avançar status (workflow)

- [ ] Rascunho → botão "Confirmar"
- [ ] Confirmado → botão "Em produção"
- [ ] Em Produção → botão "Enviar"
- [ ] Enviado → botão "Entregue"
- [ ] Entregue / Cancelado: sem botão de avanço
- [ ] Botão avança o status inline sem abrir modal

### 12.5 — Editar e Excluir

- [ ] Editar abre modal com todos os dados pré-preenchidos
- [ ] Desconto e forma de pagamento pré-preenchidos corretamente
- [ ] Itens pré-preenchidos na lista de itens
- [ ] Excluir pede confirmação e remove

**Observações / Bugs encontrados:**
```

```

---

## Bloco 13 — Testes de Isolamento Multi-Empresa

> **O que é:** O sistema suporta que um usuário seja membro de múltiplas empresas. Os dados de cada empresa **nunca devem aparecer para outra**. Este bloco verifica esse isolamento.

*Para estes testes, crie um segundo usuário e adicione-o como membro de uma segunda empresa (ou crie uma segunda empresa para o mesmo usuário).*

- [ ] Ao trocar a empresa ativa no header, o Dashboard muda para exibir os dados da empresa selecionada
- [ ] Funcionários cadastrados na Empresa A **não aparecem** na Empresa B
- [ ] Produtos cadastrados na Empresa A **não aparecem** na Empresa B
- [ ] Pedidos de uma empresa não aparecem na outra

**Observações / Bugs encontrados:**
```

```

---

## Bloco 14 — Testes de Responsividade Mobile

> Testar no Chrome DevTools com emulação de iPhone SE (375px) ou usar celular real.

- [ ] Sidebar vira gaveta lateral (desliza da esquerda, fecha ao clicar fora)
- [ ] Modais de cadastro ficam em "bottom sheet" (abre da parte de baixo da tela)
- [ ] Tabelas têm scroll horizontal (não quebram o layout)
- [ ] Botões e campos são clicáveis com toque (área mínima 44px)
- [ ] Cards de métricas empilham verticalmente em telas pequenas
- [ ] Formulários preenchem a largura da tela sem overflow horizontal

**Observações / Bugs encontrados:**
```

```

---

## Resumo Geral

Ao concluir todos os blocos, preencha a tabela:

| Bloco | Funcionalidade | Status | Bugs |
|-------|---------------|--------|------|
| 1 | Configuração da Empresa | ⬜ | — |
| 2 | Documentação (upload/download) | ⬜ | — |
| 3 | Quadro Societário (atualizado) | ⬜ | — |
| 4 | Convite por E-mail | ⬜ | — |
| 5 | Pessoas — Funcionários | ⬜ | — |
| 6 | Pessoas — Prestadores | ⬜ | — |
| 7 | Pessoas — Registro de Ponto | ⬜ | — |
| 8 | Pessoas — Escala de Trabalho | ⬜ | — |
| 9 | Pessoas — Reuniões | ⬜ | — |
| 10 | Operacional — Produtos e Serviços | ⬜ | — |
| 11 | Operacional — Pedidos de Compra | ⬜ | — |
| 12 | Operacional — Pedidos de Venda | ⬜ | — |
| 13 | Isolamento Multi-Empresa | ⬜ | — |
| 14 | Responsividade Mobile | ⬜ | — |

**Legenda:** ⬜ Não testado · ✅ Aprovado · ⚠️ Aprovado com ressalvas · ❌ Reprovado

---

## Como registrar um bug

```
BUG #001
Bloco: [número e nome do bloco]
Item: [número do check, ex: 7.5]
Passos para reproduzir:
  1. Acessei /pessoas/registro-de-ponto
  2. Cliquei em "+ Novo registro"
  3. Selecionei tipo "Trabalho" e deixei o campo Saída em branco
  4. Cliquei em Salvar
Resultado esperado: Mensagem de validação pedindo o horário de saída
Resultado obtido: Salvou com campo saída vazio, exibindo "—" na coluna de horas
Gravidade: Médio
Print: [anexar imagem se possível]
```

---

*Documento gerado em 19/05/2026 — Casa Empresarial v2.0 (Sprint 3 Pessoas completo + Sprint 4 Operacional O1–O3)*
