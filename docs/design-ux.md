# Guia de design e UX — Casa Empresarial

Padrões aplicados nas telas do módulo Pessoas e nas páginas públicas. Use este guia ao criar ou reorganizar uma tela, para que todo o sistema fique com a mesma cara e o mesmo jeito de usar.

**Telas de referência** (copie delas antes de inventar): Pessoas → Férias, Benefícios, Pesquisas, Segurança e Saúde, Folha de Pagamento e o Dashboard de Pessoas (`/pessoas`).

---

## 1. Princípios

1. **White label.** O produto atende várias empresas, cada uma com a própria marca. Nunca fixe cores da Casa Empresarial: use as variáveis de cor, que vêm da empresa ativa. Páginas públicas (pesquisa, vaga, carta proposta) mostram o logo e a cor da empresa.
2. **Tudo configurável, com padrão legal.** Regra nova entra ligada com o valor da lei (CLT) e a empresa ajusta em Configurações. Nada de regra escondida no código sem explicação na tela.
3. **Uma ação principal por lugar, sempre dentro da caixa.** Botões de ação nunca ficam no canto superior direito da página: ali fica a barra de ferramentas (notificações e tela cheia).
4. **O sistema explica as consequências.** Antes de confirmar, diga o que vai acontecer ("Os dias voltam ao saldo e o recibo sai do fluxo de caixa"). Depois de salvar, diga o que aconteceu ("3 registros criados. Cada pessoa foi avisada.").
5. **As duas partes ficam sabendo.** Todo pedido e toda decisão entre colaborador e gestão gera notificação para o outro lado, com link para a tela exata.
6. **O colaborador vê só o que é dele.** Telas "Meu…/Minha…" mostram os próprios dados; informações da gestão (localização e IP do ponto, por exemplo) ficam só nas telas de gestão.

---

## 2. Estrutura da página

Ordem fixa, de cima para baixo:

1. **Título + breadcrumb** na mesma linha.
   - Título: `h1`, `text-3xl font-extrabold`, fonte Manrope, cor `var(--color-brand)`, classe `animate-enter`.
   - Breadcrumb: componente `Breadcrumb` à direita (quebra de linha no celular).
2. **Cartões de resumo** (`SummaryCard`): 3 ou 4, em `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`, com `delay` de 60 ms entre eles. Use `accent="yellow"` para atenção e `accent="red"` para algo vencido ou bloqueante, só quando o valor for maior que zero.
3. **Abas** (`Tabs` de `components/ui/form-steps`), **abaixo dos cartões**, quando houver mais de uma visão. A aba mais usada vem primeiro.
4. **A caixa** (`app-card p-5 flex flex-col gap-4`), com:
   - **Cabeçalho:** à esquerda, um resumo em texto ("12 pesquisas", "3 itens para analisar"); à direita, o `AddButton` com rótulo específico ("Nova pesquisa", "Lançar ausência").
   - **Filtros:** `FilterSelect` + `SearchField` + `FilterResult` (aparece só com filtro ativo e oferece "Limpar").
   - **Lista** (`ul flex flex-col gap-3`).
   - **Rodapé opcional:** uma linha `text-xs` muted com a base do cálculo ou um lembrete.

Exportações (PDF, Excel) e ações secundárias ficam no cabeçalho da caixa, ao lado do `AddButton`, como botões discretos com ícone.

---

## 3. Listas

Use sempre `ListItem` (`components/ui/list-item`) e `ListEmpty`. Não use tabelas para listas de cadastro.

- **Ícone ou mídia** à esquerda: ícone do tipo de item ou as iniciais/foto da pessoa.
- **Título:** o nome do item. **Subtítulo:** detalhes separados por ` · ` (ex.: `3 perguntas · 12 respostas · 01/11 a 30/11`).
- **`aside`:** selos de situação e valores (valores alinhados à direita, `tabular-nums`).
- **Clique no cartão:** a ação principal (abrir, editar ou ver resultados).
- **Menu ⋯ (`actions`):** todas as ações, a principal repetida primeiro; a destrutiva por último, com `tone: 'danger'`. Sem ações, o menu não aparece.
- **Lista vazia:** `ListEmpty` com uma frase que diz o próximo passo, não só "Nenhum registro" (ex.: "Crie a primeira pesquisa e mande o link para a equipe responder.").

---

## 4. Selos e avisos

**Selo** = `span` arredondado (`px-2 py-0.5 rounded-full text-xs font-medium`). Paleta fixa:

| Significado | Fundo | Texto |
|---|---|---|
| OK, em dia, aprovado, ativo | `#DCFCE7` | `#15803D` |
| Atenção, vencendo, em análise | `#FEF3C7` | `#B45309` |
| Vencido, recusado, encerrado | `#FEE2E2` | `#B91C1C` |
| Informativo (ex.: experiência) | `#DBEAFE` | `#1D4ED8` |
| Neutro, rascunho, concluído | `#F3F4F6` | `#6B7280` |
| Da marca (ex.: "Editado", "Hoje") | `var(--color-brand-light)` | `var(--color-brand)` |

A cor nunca fala sozinha: o selo sempre tem o texto ("Vence em 5 dias", não só amarelo).

**Faixa de aviso** dentro da caixa: `text-sm rounded-lg px-3 py-2`.
- Atenção: fundo `#FEF3C7`, texto `#B45309`.
- Informação: fundo `var(--color-brand-light)`, texto `var(--color-text-secondary)`.
- Erro: fundo `#FEE2E2`, texto `#B91C1C`.

---

## 5. Modais e confirmações

- Sempre o componente `Modal`, com estado gerenciado pela tela (nunca `alert`, `confirm` ou overlay feito à mão).
- **Título** diz a ação ("Programar férias", "Novo registro"); **descrição** diz sobre quem ou o quê (o nome da pessoa, o período).
- **Rodapé:** `Cancelar` (secondary) à esquerda do botão principal; o principal tem verbo e, quando faz sentido, quantidade ("Criar 5 registros").
- Bloqueie o fechamento enquanto salva (`if (!salvando) onClose()`).
- Exclusão e ações irreversíveis: `ConfirmDialog`, com a mensagem dizendo o efeito ("As respostas recebidas também são apagadas.").
- Campo que pede atenção especial (ex.: "Para quem" no registro de segurança) ganha destaque: caixa com borda de 2px na cor da marca e fundo `brand-light`.

**Seleção de várias pessoas** (padrão do modal de Segurança e Saúde): busca por nome ou cargo, lista com caixas de marcar e iniciais, "Marcar todos / Marcar os encontrados / Limpar", contador de selecionados e a opção explícita de "sem funcionário" quando couber.

---

## 6. Formulários

- Componentes `Input`, `Select`, `FileDropZone`. Campo `type="date"` vira o seletor de data; `type="time"` vira o relógio na cor da empresa.
- Validação em `lib/validations/` (zod), com mensagens em português que dizem o que fazer ("Use um dia de 1 a 28", "Informe o título").
- Formulários grandes: `react-hook-form` + `zodResolver`.
- Moeda: máscara `maskMoeda` (digita como em app de banco). Datas exibidas como `dd/mm/aaaa`.
- Dica (`hint`) curta abaixo do campo quando a regra não é óbvia ("A CLT prevê até 10 minutos por dia").
- Campos que vêm de outro cadastro ficam travados e dizem de onde vêm ("Departamento — vem do cargo").

### Configurações

Cada grupo de regras é um **Bloco** (`app-card p-5`): título, descrição de uma linha, os campos e, no fim, a **Explicação dinâmica**, uma caixa `brand-light` que reescreve a regra com valores reais conforme a pessoa preenche ("A folha de novembro paga os salários em 05/12, o 5º dia útil…"). Alertas de lei aparecem em âmbar dentro dela ("Esta data passa do limite da CLT").

Caixas de marcar usam o padrão `Marcar`: título em negrito e uma descrição curta embaixo.

---

## 7. Comunicação das respostas

O sistema responde a toda ação. Cada tipo de resposta tem o seu lugar:

| Situação | Onde aparece | Componente |
|---|---|---|
| Resultado de uma gravação (salvou, falhou) | **Toast** no canto superior direito | `toast.promise` / `toast` / `toast.error` (`lib/toast.ts`) |
| Campo inválido no formulário | **Embaixo do campo**, em vermelho | `error` do `Input` / `Select` |
| Regra ou situação da tela que a pessoa precisa saber antes de agir | **Faixa de aviso** dentro da caixa ou do modal | seção 4 |
| Algo que aconteceu para outra pessoa (pedido, decisão, documento) | **Notificação** no sino | seção 9 e 15.2 |
| Confirmação antes de uma ação destrutiva | **Modal de confirmação** | `ConfirmDialog` |

**Toasts** (`lib/toast.ts`):
- `toast.promise(acao, { loading, success, error })` em **toda** gravação. Ele gira por pelo menos 2 segundos, para a pessoa perceber que algo foi processado, e vira ✓ (desenhado) ou ✕.
- A action devolve `{ error: 'mensagem' }` para falha esperada: o toast mostra a mensagem do servidor. Escreva essas mensagens para o usuário final.
- `toast('…')` para confirmação imediata sem servidor (ex.: "Link copiado."); `toast.error('…')` para erro detectado na tela (ex.: "Escolha o PDF do holerite.").
- Somem sozinhos em 4 segundos, entram deslizando da direita e empilham.
- **Textos:** `loading` no gerúndio ("Salvando…", "Aprovando…"); `success` específico, com o nome do item e a consequência ("Férias de Rodrigo aprovadas.", "3 registros criados. Cada pessoa foi avisada."); `error` como plano B genérico ("Não foi possível salvar.").
- `toast.promise` relança o erro quando a action quebra: envolva em `try/catch` e não mostre outra mensagem no `catch`.

**Depois de salvar:** `router.refresh()` para os dados novos aparecerem e feche o modal. O botão que disparou mostra `loading` e fica desabilitado enquanto a ação roda; o modal não fecha nesse meio-tempo.

**Nunca:** `alert`, `confirm`, mensagem de sucesso genérica ("Sucesso!"), toast para erro de campo (vai embaixo do campo), ou erro técnico cru para o usuário ("violates foreign key").

---

## 7.1 Transições e movimento

O movimento existe para mostrar **de onde veio e para onde foi** a informação — não para enfeitar. Tudo é curto (200–500 ms) com a curva `cubic-bezier(0.22, 1, 0.36, 1)` e respeita `prefers-reduced-motion` (vira só um fade).

- **Entrada da tela:** o título e os cartões usam `animate-enter` (descem levemente e aparecem) em **cascata**, com `delay` de 60 ms entre um cartão e outro (`SummaryCard`, `IndicadorCard`, lançadores). A caixa `app-card` entra logo depois do título, sozinha.
- **Navegação entre telas:** `Link` ou `router.push`; não há animação de página inteira. Abas que mudam o endereço (`?aba=`, `?mes=`) são navegação; abas locais só trocam o conteúdo da caixa.
- **Modal:** no celular sobe de baixo (bottom sheet); no computador aparece centralizado sobre um fundo escurecido.
- **Etapas dentro de um modal** (ex.: PIN → formulário, `PinGate`): a etapa atual sai para a esquerda e a próxima entra pela direita (450 ms). Voltar faz o caminho inverso.
- **Telas em etapas** (página pública da pesquisa): avançar sobe o conteúdo; voltar desce.
- **Toast:** desliza da direita; o ícone "estoura" ao virar ✓ ou ✕.
- **Hover:** cartões clicáveis sobem 4 px com sombra maior; setas `chevron` deslizam 2 px. Itens de lista só mudam o fundo.
- **Aviso chegando:** o sino balança enquanto há aviso novo de evento.
- **Não anime** a cada atualização de dados, contagens ou listas inteiras (só a primeira entrada). Nada pisca nem se move sozinho em loop, exceto indicadores de carregamento.

---

## 8. Dashboards e página inicial

**Dashboard de cada área do menu.** Clicar no **nome da área** no menu abre o dashboard dela; a seta ao lado abre e fecha o submenu. Toda área deve ter o seu.

Estrutura (modelo: `app/(app)/pessoas/page.tsx`):
1. Título com o nome da área + breadcrumb.
2. Uma linha de **4 `IndicadorCard`** (`components/modules/dashboard/indicador-card.tsx`): ícone, rótulo, valor grande, detalhe de uma linha. `tom="atencao"` quando pede ação, `tom="ok"` quando está em dia. Cada um leva à tela que resolve aquele número.
3. Abaixo, **2 ou 3 `ListCard`** com as listas do que exige atenção, com selos e o link "Ver todos".

O que mostrar — responda "o que a pessoa desta área precisa saber ao chegar de manhã?":
- **Pendências para decidir** (pedidos para aprovar, itens em análise).
- **O que vence** nos próximos 30 dias (documentos, exames, períodos de férias, contas).
- **A situação do período** (folha do mês fechada ou não, saldo, metas).
- **Números de contexto** (pessoas na equipe, pedidos em aberto).

Regras:
- Só o que o perfil de acesso permite ver; um indicador de um item bloqueado some ou leva a outra tela.
- Números sempre com texto ("3 ajustes de ponto · 1 atestado"), e "Em dia" em verde quando não há pendência.
- Dashboard só lê: nenhuma ação acontece nele, os cartões levam às telas.
- O item do dashboard entra no catálogo de acessos com `dashboard: true` e `exato: true` (ex.: `pessoas.dashboard` → `/pessoas`).

| Área | Situação | Sugestão de conteúdo |
|---|---|---|
| Administrativo | Pronto (`/admin`) | Documentos por validade, sócios, certificado digital |
| Pessoas | Pronto (`/pessoas`) | Equipe, aprovações, admissões e rescisões, folha do mês, vencimentos, férias, aniversariantes |
| Financeiro | A fazer | Saldo das contas, a pagar e a receber da semana, vencidos, resultado do mês (DRE), faturas de cartão abertas |
| Operacional | A fazer | Pedidos de venda e de compra em aberto, ordens de serviço por situação, produtos com estoque baixo, caixa do dia |
| Marketing | A fazer | Publicações do mês no calendário editorial, materiais recentes, depoimentos aguardando aprovação |

**Lançadores da página inicial** (`Ferramentas`):
- No máximo **4 por linha** (`grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`); mais que isso desce para a linha de baixo, nunca espreme.
- Visual: fundo em degradê da cor da empresa, ícone em marca d'água, título e uma legenda curta.
- Aparecem só para quem ocupa um cargo; "Bater ponto" e "Meu ponto" só se o cargo registra ponto; o de pesquisa some depois que a pessoa responde.

---

## 9. Notificações

- Toda interação entre colaborador e gestão notifica a outra parte: pedido criado, aprovado, recusado, desfeito ou lançado pela gestão.
- **Título** curto com o assunto ("Ajuste de ponto aprovado"); **mensagem** com quem, quando e a resposta, se houver.
- **Link** para a tela e a aba exatas (`/pessoas/registro-de-ponto?aba=aprovacoes`, `/meu-ponto?aba=ausencias`). Telas com abas aceitam `?aba=`.
- Quem faz a ação não recebe o próprio aviso. A notificação nunca derruba a ação: se falhar, só vai para o log.
- Aparecem no sino, na página Notificações e como notificação do navegador (com permissão).

---

## 10. Textos (UX writing)

- Português simples, frases curtas, voz ativa. Fale com a pessoa ("Seus pedidos", "Você já respondeu").
- Termos do usuário, não do sistema: **"registro"** de ponto (não "batida"), "pedido", "abono", "período aquisitivo".
- Números com unidade e plural certo ("1 dia", "3 dias"; use o helper `plural`). Moeda `pt-BR`, datas `dd/mm/aaaa` ou `dd/mm` quando o ano é óbvio.
- Cite a regra quando ajudar a confiar no cálculo ("art. 145 da CLT", "Súmula 172 do TST"), sem juridiquês.
- Mensagem de erro diz o que fazer: "O vencimento não pode ser antes da data", "Execute a migration X para…" (para a equipe), "Procure a área de Pessoas" (para o colaborador).
- Avise quem vai ver o dado ("O funcionário vê este registro, com a observação, em Minha saúde e segurança").

---

## 11. Cores e tipografia

- Variáveis em `globals.css`: `--color-brand`, `--color-brand-light`, `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-card-border`, `--color-bg-surface`, `--color-sidebar-text`. Não use hex soltos para marca ou texto.
- Fontes: **Manrope** em títulos, nomes em lista e valores de destaque; **Inter** no restante da interface.
- Escala: títulos `text-3xl` (página), `text-lg` / `text-base font-bold` (blocos), `text-sm` no corpo, `text-xs` em detalhes. Valores numéricos com `tabular-nums`.

---

## 12. PDFs e planilhas

- **PDF** (`@react-pdf/renderer`), padrão do relatório da folha e do holerite:
  - Cabeçalho com logo, nome e CNPJ à esquerda e título e competência à direita, sobre uma linha na cor da empresa.
  - Faixa cinza com os dados da pessoa.
  - Tabela com cabeçalho escuro e linha de totais.
  - Barra de destaque na cor da empresa para o valor principal.
  - Observações em texto pequeno e rodapé fixo.
- **Excel** (`exceljs`): cabeçalho formatado, colunas com largura ajustada, mesmo conteúdo do PDF.
- Holerite, recibo de férias e 13º usam o mesmo componente (`HoleritePdf`), mudando só o documento.

---

## 13. Páginas públicas

(Pesquisa, candidatura a vaga, carta proposta, auto-cadastro)

- Marca da empresa: logo no topo, cor como `--marca`, fundo com leve degradê da cor.
- Conteúdo num cartão central (`max-w-xl`, `rounded-3xl`), barra de progresso quando há etapas.
- Estados explícitos: não encontrada, ainda não aberta, encerrada, já respondida, enviada. Nunca mostre "obrigado" antes de o servidor confirmar.
- Envio com erro: a mensagem aparece com "Tentar de novo" e nada do que foi preenchido se perde.
- Funciona no celular e respeita `prefers-reduced-motion`.

---

## 14. Acessibilidade e responsivo

- Contraste mínimo 4.5:1 no texto; foco visível (`focus:ring-2` na cor da marca).
- Botões só com ícone têm `aria-label`; opções de escolha usam `role="radio"` ou `checkbox` com `aria-checked`.
- Atalhos de teclado onde a tarefa é repetitiva (pesquisa: letras, números, Enter).
- Grids sempre recolhem: 4 → 2 → 1 colunas. Valores secundários somem no celular (`hidden xl:grid`), o principal fica.

---

## 15. Funcionalidades e comportamentos

Regras de funcionamento que valem para toda tela nova. Onde está escrito **(já existe)**, siga o modelo citado; **(recomendado)** é o que ainda falta aplicar nas telas indicadas.

### 15.1 PIN de segurança para movimentações sensíveis

O usuário cadastra um PIN de 6 números em Perfil → Segurança (`lib/security-pin.ts`). Depois de 5 erros seguidos, o PIN fica bloqueado por 15 minutos.

**Quando exigir o PIN:**
- Ação que **revela um segredo**: senha, certificado, dados bancários.
- Ação que **move dinheiro ou fecha valores**: fechar ou reabrir folha, fechar uma parcela do 13º, baixar pagamento.
- Ação que **não dá para desfazer** ou que afeta o acesso de alguém: remover, revogar acesso, compartilhar.

**Onde já existe:**
- **Cofre de senhas:** revelar, editar, compartilhar e remover.
- **Certificado digital:** editar, baixar e remover.

Siga `cofre-de-senhas/components/credentials-client.tsx`.

**Onde aplicar (recomendado):**
- Fechar e reabrir a folha e as parcelas do 13º.
- Cancelar férias aprovadas que já têm recibo.
- Alterar salário ou dados bancários na ficha.
- Excluir uma pessoa.
- Mudar perfis de acesso.

**Como implementar:**
1. **Na tela:** a função `exigirPin(acao)` confere antes se a pessoa tem PIN cadastrado. Sem PIN, abre um aviso com o atalho para o Perfil, em vez de deixar a pessoa preencher tudo e falhar no fim.
2. **Formulário protegido:** use o `PinGate` (`components/ui/pin-gate.tsx`). O PIN aparece centralizado e, depois de conferido, desliza para o formulário. A tela guarda o PIN para enviar junto na gravação.
3. **Ação curta** (remover, baixar): confirmação com o campo de PIN (`CodeInput mask`), com o erro mostrado no próprio campo.
4. **No servidor, sempre:** a action confere o PIN de novo com `verifySecurityPin(user.id, pin)` antes de gravar. A checagem da tela só libera a interface; quem protege é o servidor.

**Não confundir:** o **PIN do ponto** é do colaborador, fica na ficha e serve só para registrar o ponto na tela de Bater ponto (`app/registrar-ponto`). Ele não substitui o PIN de segurança do usuário.

### 15.2 Notificações

**(já existe)** `lib/notificacoes.ts`:
- `notificarGestores` avisa quem tem acesso ao item do módulo, pelo perfil de acesso.
- `notificarFuncionario` avisa a pessoa dona da ficha.

**Quando notificar:**
- Pedido criado.
- Pedido decidido (aprovado ou recusado).
- Decisão desfeita.
- Algo lançado pela gestão em nome da pessoa.
- Documento disponível (holerite, recibo, 13º).
- Registro de saúde e segurança criado ou atualizado.

**Regras:**
- Quem fez a ação não recebe o próprio aviso.
- O link leva à tela e à aba exatas (`?aba=`).
- A notificação nunca derruba a ação: se falhar, só vai para o log.
- Assunto novo ganha um `tipo` próprio (`ponto`, `ausencia`, `ferias`, `folha`, `saude`) e um ícone no sino. Atualize junto o CHECK da tabela `notifications` numa migration.
- O aviso aparece no sino e na página Notificações. Se a pessoa permitiu, aparece também como notificação do navegador, uma vez por aviso.

### 15.3 Calendário

**(já existe)** A entrevista da admissão cria um evento na agenda do entrevistador (`reminders`), com aviso 30 minutos antes e e-mail. Remarcar atualiza o mesmo evento; se ele foi apagado da agenda, a entrevista cria outro. Siga `pessoas/admissao/actions.ts`, função de agendar entrevista.

**Quando criar evento:** sempre que a tela marca **data e hora com outra pessoa** ou um **prazo que alguém precisa cumprir**.

**Onde aplicar (recomendado):**
- **Exame admissional e demissional agendados:** para quem acompanha o processo.
- **Férias aprovadas:** um evento de dia inteiro na agenda do gestor, para a equipe saber quem está fora.
- **Vencimentos:** do ASO, de treinamentos e do período de férias, com aviso alguns dias antes.
- **Datas da folha:** pagamento, guias e parcelas do 13º, para quem tem acesso à Folha.

**Como fazer:**
- **Ligação com o evento:** guarde o `reminder_id` no registro de origem. Assim, editar atualiza o evento e cancelar conclui ou remove o evento.
- **Aviso:** use `notificar: true`, com antecedência coerente com o assunto. O e-mail fica para o que tem hora marcada.
- **Link do evento:** aponta para a ficha ou tela de origem.

### 15.4 Permissões e dados da empresa

- **Duas checagens:** toda página chama `exigirAcessoPagina('<modulo>.<item>')` e toda action chama `semAcesso(...)`. Esconder o botão não basta.
- **Item novo no catálogo:** entra em `lib/acesso/catalogo.ts`, com uma chave estável. O menu, a tela de perfis e o bloqueio saem dali.
- **Empresa nas consultas:** filtre sempre por `company_id` e confira que o registro editado é da empresa ativa antes de alterar ou excluir.
- **Colaborador:** acessa só as rotas liberadas no `middleware.ts` e vê só os próprios dados.

### 15.5 Consistência das gravações

- **Decisão disputada** (aprovar, recusar, abonar): grave com a condição do estado atual (`.eq('status', 'pendente')`). Assim, dois cliques ou duas pessoas não decidem o mesmo pedido.
- **Ação em várias etapas** (aprovar férias → marcar o ponto → gerar o recibo): se uma etapa falha, desfaça as anteriores e devolva o erro.
- **Fechamento congela os valores:**
  - Folha, 13º e recibos ficam com o cálculo da época, mesmo que a regra mude depois.
  - Reabrir só é permitido se nada foi pago no fluxo de caixa.
  - Mês fechado bloqueia alterações de férias naquele período. Ajustes de ponto e atestados ainda não têm essa trava (pendência).
- **Migration ainda não aplicada:** a tela não quebra. Consultas com `select('*')` toleram coluna ausente, e a mensagem diz qual migration falta. Migrations podem ser executadas de novo sem efeito colateral.

### 15.6 Datas, arquivos e privacidade

- **Datas:** "hoje" e horários sempre no fuso de Brasília (`America/Sao_Paulo`). O servidor roda em UTC.
- **Uploads:** PDF, JPG ou PNG, até 10 MB, no bucket `documentos`. Para abrir, gere um link assinado de 5 minutos, nunca um link público.
- **Ponto:** localização e IP são guardados em cada registro, mas só a gestão os vê.
- **Pesquisas:** as respostas são anônimas. Para saber quem já respondeu, existe uma tabela separada, sem ligação com a resposta.
- **Rescisão finalizada:** retira o acesso à empresa, cancela os convites e remove as senhas compartilhadas com a pessoa.

---

## 16. Checklist antes de entregar uma tela

- [ ] Título + breadcrumb, cartões, abas abaixo dos cartões, tudo dentro de `app-card`.
- [ ] Nenhum botão no canto superior direito da página.
- [ ] Lista com `ListItem`, menu ⋯ com a ação destrutiva por último, `ListEmpty` que orienta.
- [ ] Filtros com `FilterSelect`, `SearchField` e `FilterResult`.
- [ ] Modais com `Modal` e `ConfirmDialog`; nada de `alert` ou `confirm`.
- [ ] `toast.promise` com mensagens específicas; erro de campo embaixo do campo.
- [ ] Entrada com `animate-enter` em cascata; nada animando a cada atualização.
- [ ] Área nova no menu já nasce com o dashboard.
- [ ] Selos da paleta fixa, com texto.
- [ ] Cores por variável (white label) e regra nova configurável com padrão legal.
- [ ] Notificação para a outra parte, com link para a aba certa.
- [ ] PIN de segurança nas ações sensíveis, conferido de novo no servidor.
- [ ] Evento no calendário quando há data com outra pessoa ou prazo a cumprir.
- [ ] `exigirAcessoPagina` na página, `semAcesso` em cada action, filtro por `company_id`.
- [ ] Decisões gravadas com a condição do estado atual; etapas desfeitas se algo falhar.
- [ ] Textos revisados: "registro" (não "batida"), plurais, datas e moeda no formato brasileiro.
- [ ] Funciona no celular.
