# Glossário

Termos de Pessoas usados nas telas e no código.

| Termo | O que é | No código |
|---|---|---|
| **Abono (ausência)** | Aceitar um atestado ou ausência: o dia não conta como falta. | `time_absences.status = 'abonado'` |
| **Abono pecuniário** | Venda de até 10 dias de férias; paga com 1/3, sem INSS e IRRF. | `dias_abono` |
| **Adiantamento** | Parte do salário paga durante o mês e descontada no fechamento. | `adiantamento_percentual` |
| **Adicional de risco** | Insalubridade (10/20/40%) ou periculosidade (30%). Vem do cargo, com exceção na ficha. | `job_positions.adicional`, `employees.adicional_risco` |
| **Apuração** | Leitura do ponto do período: dias trabalhados, faltas, atrasos, horas extras, noturno. | `apurarPonto`, `ApuracaoPonto` |
| **ASO** | Atestado de Saúde Ocupacional, do exame admissional, periódico ou demissional. | `health_safety_records.tipo = 'aso'` |
| **Avos** | Doze avos do 13º: um por mês com 15 dias ou mais de trabalho. | `avosDecimo` |
| **Competência** | O mês a que a folha se refere. | `mes_ano` (`2026-11`) |
| **Conferência** | A folha em aberto, em que os valores automáticos podem ser editados antes de fechar. | `payroll_entries.status = 'rascunho'` |
| **Dia de corte** | Último dia do ponto que entra na folha do mês. Sem corte, o mês cheio. | `dia_corte` |
| **Divisor** | Horas do mês pela jornada (44h → 220), para o valor da hora. | `divisorHoras` |
| **DSR** | Descanso semanal remunerado: reflexo das horas extras no descanso e perda na semana com falta. | `dsr`, `dsr_perdido` |
| **Escala** | Quais dias a pessoa trabalha e folga, e os horários. Montada pelas folgas. | `employee_schedule_rules`, `generateRange` |
| **Fechamento** | Congela a folha e lança os pagamentos no fluxo de caixa. | `fecharFolhaAction` |
| **Fora da escala** | Trabalho num dia que a escala não previa. | `ESTILO_FORA_DA_ESCALA` |
| **Hora reduzida** | Hora noturna de 52min30s (CLT art. 73). | `noturno_hora_reduzida` |
| **Lançador** | Atalho grande na página inicial (Bater ponto, Meu holerite...). | `Ferramentas`, `Lancador` |
| **Média de variáveis** | Média de horas extras, noturno, DSR e comissões, usada nas férias e no 13º. | `mediaVariaveis` |
| **Período aquisitivo** | 12 meses de trabalho que dão direito a 30 dias de férias. | `calcularPeriodos` |
| **Período concessivo** | Os 12 meses seguintes, em que as férias precisam começar. | `concessivoFim` |
| **Perfil de acesso** | Conjunto de itens do sistema que um usuário pode usar. | `access_profiles`, `lib/acesso/catalogo.ts` |
| **PIN do ponto** | Código do colaborador para bater ponto. | `employees.pin` |
| **PIN de segurança** | Código de 6 números do usuário para ações sensíveis. | `lib/security-pin.ts` |
| **Recibo** | Documento de pagamento fora da folha mensal: férias e parcelas do 13º. | `payroll_receipts` |
| **Registro (de ponto)** | Cada marcação de entrada ou saída. Na tela, nunca "batida". | `time_records.batidas` |
| **Tolerância** | Minutos de diferença no dia que não contam como atraso nem hora extra. | `tolerancia_minutos` |
| **TRCT** | Termo de Rescisão do Contrato de Trabalho. | etapa `assinar_trct` |
