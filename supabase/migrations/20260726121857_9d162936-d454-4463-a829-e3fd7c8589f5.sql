
INSERT INTO public.tutorials (title, description, category_id, type, level, estimated_time, icon, is_featured, "order", long_description) VALUES
('Como atender clientes sem agendamento (Walk-in)','Registre quem chega na hora, gere senha de atendimento e acompanhe a fila em tempo real.','428c0ddc-fc67-42be-bc4f-aff6280344f3','document','basico','4 min','user-plus',true,20,
'1. Na Agenda ou no Dashboard, clique em "Agendamento Presencial".
2. Informe o nome e (opcional) o telefone do cliente. Se o telefone já existir, o cadastro é reaproveitado.
3. Escolha o serviço e o profissional. O sistema calcula a duração e verifica conflitos com a agenda.
4. Confirme: o atendimento recebe uma senha (nº do ticket) e entra no Painel de Fila da agenda.
5. Acompanhe a fila: aguardando → em atendimento → concluído.
6. Ao concluir, o valor entra no financeiro e gera comissão normalmente.

Observações:
• Walk-in não dispara lembretes nem confirmação prévia — apenas automações pós-atendimento (avaliação/agradecimento).
• Para desativar avisos de walk-in no WhatsApp, use Configurações › Destinatários internos.'),

('Como reagendar trocando data, horário e profissional','Assistente de reagendamento com verificação automática de disponibilidade.','428c0ddc-fc67-42be-bc4f-aff6280344f3','document','intermediario','4 min','calendar-clock',false,21,
'1. Abra o atendimento na Agenda e clique em "Reagendar".
2. Passo 1 — Profissional: mantenha o atual ou escolha outro. Só aparecem profissionais habilitados para o serviço.
3. Passo 2 — Data: o calendário mostra apenas dias em que o profissional trabalha.
4. Passo 3 — Horário: os horários já consideram duração do serviço, intervalo entre atendimentos e bloqueios.
5. Passo 4 — Confirmação: revise o resumo e confirme.
6. O cliente recebe automaticamente a mensagem de reagendamento no WhatsApp, com o texto adaptado a quem fez a alteração (barbearia, profissional ou o próprio cliente).

Dica: se nenhum horário aparecer, revise a jornada do profissional em Barbeiros › Horários.'),

('Como evitar conflitos e ajustar o intervalo entre atendimentos','Configure a folga entre serviços e entenda como o sistema bloqueia sobreposições.','428c0ddc-fc67-42be-bc4f-aff6280344f3','document','intermediario','3 min','timer',false,22,
'1. Vá em Configurações › Agenda e defina o "Intervalo entre atendimentos" (ex.: 10 minutos).
2. Esse intervalo é somado à duração do serviço em todos os cálculos: site público, painel, walk-in e reagendamento.
3. O sistema valida sobreposição por faixa de horário (início + duração + intervalo) — não apenas pelo horário inicial.
4. Se houver choque, o horário nem aparece para o cliente; no painel, a tentativa é bloqueada com aviso.
5. Bloqueios manuais, folgas e férias do profissional também removem horários automaticamente.

Dica: intervalos de 5 a 15 minutos reduzem atrasos em cadeia ao longo do dia.'),

('Como contratar módulos adicionais (Add-ons)','Ative recursos extras do Barbex sem trocar de plano e entenda a cobrança proporcional.','ac653d4f-6ff5-4a15-94ab-7d5c4dc13ec6','document','intermediario','4 min','puzzle',true,30,
'1. Acesse Assinatura › Módulos Adicionais.
2. Veja os módulos disponíveis para o seu plano, com preço mensal e o que cada um libera.
3. Adicione ao carrinho, ajuste a quantidade quando o módulo for por unidade e finalize a compra.
4. O pagamento é processado com cobrança proporcional (pro-rata) no ciclo atual.
5. Assim que o pagamento é confirmado, o módulo aparece no menu e é liberado no sistema.
6. Se um plano superior já incluir os módulos escolhidos, o Barbex sugere o upgrade e absorve os add-ons na troca.

Cancelamento: em "Meus módulos" você cancela quando quiser — o acesso continua até o fim do período já pago.
Pagamento recusado: um aviso aparece no painel e o módulo é suspenso após as tentativas de recobrança.'),

('Como usar cupons de desconto','Crie cupons percentuais ou de valor fixo e acompanhe o impacto no faturamento.','3851298e-00d9-4c45-9f5f-bcad2479f6ca','document','intermediario','4 min','ticket-percent',false,30,
'1. Em Financeiro › Cupons, clique em "Novo cupom".
2. Defina o código (ex.: ANIVERSARIO10), o tipo (percentual ou valor fixo) e o valor.
3. Configure validade, limite de usos e valor mínimo do atendimento.
4. Ative o cupom. Ele pode ser aplicado no fechamento do atendimento e nas mensagens automáticas.
5. Acompanhe em Financeiro o total de descontos concedidos e o ticket médio com e sem cupom.

Dica: cupons enviados por automação (aniversário, retorno, avaliação 5 estrelas) têm a maior taxa de resgate.'),

('Como analisar o desempenho de cada profissional','Relatório de atendimentos, faturamento, comissões, gorjetas e avaliações por período.','a5ec4c8e-f49d-4817-afbd-8e7c19324215','document','intermediario','3 min','bar-chart-3',false,20,
'1. Vá em Barbeiros e clique em "Desempenho" no card do profissional.
2. Escolha o período: 7, 30 ou 90 dias.
3. Analise os indicadores: atendimentos concluídos, faturamento gerado, comissão gerada e paga, gorjetas recebidas e nota média das avaliações.
4. Veja o ranking dos serviços mais executados pelo profissional.
5. Use os dados para ajustar comissão, escala e metas.

Dica: compare o faturamento por atendimento entre profissionais para identificar quem vende mais serviços adicionais.'),

('Como funciona o portal do cliente e o Clube Barbex','Área logada onde o cliente vê agendamentos, plano, benefícios e sua jornada.','fa046d64-efcd-4235-8616-d04b3c4eaed7','document','basico','4 min','smartphone',true,10,
'1. O cliente acessa /sua-barbearia/portal pelo link do site público ou pelo WhatsApp.
2. Ele entra com o telefone cadastrado e vê o próximo agendamento em destaque, com opção de reagendar ou cancelar conforme sua política.
3. Abaixo aparece "Sua Jornada Barbex": histórico, frequência, nível de fidelidade e progresso até o próximo benefício.
4. Assinantes visualizam o plano, usos disponíveis no mês, benefícios inclusos e a carteirinha digital.
5. Clientes sem plano recebem a oferta do Clube com o comparativo de vantagens.
6. Avaliações, gorjeta via PIX e cupons também ficam disponíveis no portal.

Dica: divulgue o link do portal na bio do Instagram para reduzir mensagens manuais.'),

('Como entender e usar os níveis de fidelidade dos clientes','Bronze, Prata e Ouro: como o cliente evolui e como usar isso no atendimento.','74fe2b6f-3efd-47cf-9c6f-8826161f59c6','document','basico','3 min','crown',false,20,
'1. Em Clientes, cada cadastro exibe um selo de nível calculado pelo histórico de atendimentos e valor gasto.
2. Bronze: cliente novo ou de baixa frequência. Prata: cliente recorrente. Ouro: cliente fiel e de maior valor.
3. Use os filtros para listar clientes por nível, por última visita e por status (cliente, assinante, premium).
4. Combine com campanhas: ofereça cupom de retorno para Bronze inativos e benefícios exclusivos para Ouro.
5. O nível também aparece no portal do cliente, incentivando a evolução.

Dica: clientes Ouro são os melhores candidatos para vender um plano de assinatura.'),

('Como enviar sugestões de melhoria para o Barbex','Seu feedback vira roadmap: como registrar ideias e acompanhar o retorno.','effb1c97-4599-452c-9895-2f231b130022','document','basico','2 min','lightbulb',false,20,
'1. Acesse Suporte e clique em "Abrir chamado".
2. Em "Tipo", escolha a opção Sugestão.
3. Descreva a ideia: o que você precisa, em qual tela e qual problema isso resolve no dia a dia.
4. Envie. A sugestão vai para o painel de sugestões da equipe Barbex, separada dos chamados de erro.
5. Acompanhe o status e as respostas na própria página de Suporte.

Dica: sugestões com exemplo prático da rotina da barbearia costumam ser priorizadas mais rápido.');

-- Detalhamento dos tutoriais existentes
UPDATE public.tutorials SET long_description =
'1. Em Assinaturas › Planos, clique em "Novo plano".
2. Defina nome, valor mensal e descrição comercial (é o texto que o cliente vê no site).
3. Escolha os serviços inclusos e a quantidade de usos por mês de cada um.
4. Configure benefícios extras: desconto em produtos, prioridade na agenda e vantagens do clube.
5. Defina o método de cobrança (PIX, cartão via gateway ou controle manual).
6. Publique o plano — ele passa a aparecer na página pública e no portal do cliente.

Dica: comece com 2 ou 3 planos no máximo. Excesso de opções reduz a conversão.'
WHERE title = 'Como criar planos de assinatura';

UPDATE public.tutorials SET long_description =
'1. Em Assinaturas › Assinantes, clique em "Nova assinatura".
2. Busque o cliente pelo telefone ou cadastre um novo na hora.
3. Selecione o plano, a data de início e a forma de pagamento.
4. Confirme: o ciclo é criado e os usos do mês já ficam disponíveis.
5. Acompanhe no painel MRR, ARR, churn e assinantes ativos.
6. Pagamentos recorrentes atualizam o status automaticamente; cobranças manuais podem ser baixadas na tela do assinante.

Dica: venda o plano logo após um atendimento bem avaliado — é o momento de maior aceitação.'
WHERE title = 'Como vender uma assinatura';

UPDATE public.tutorials SET long_description =
'1. Cada plano define quantos usos de cada serviço o assinante tem por mês.
2. Ao agendar, o sistema mostra o saldo disponível e reserva o uso.
3. O uso só é consumido de fato quando o atendimento é concluído. Cancelou? O saldo volta.
4. Combos consomem os itens correspondentes (ex.: 1 corte + 1 barba).
5. Sem saldo, o cliente pode pagar o valor avulso com o desconto de assinante, quando configurado.
6. Os usos são renovados na data de renovação do ciclo, sem acúmulo (salvo se o plano permitir).

Dica: acompanhe assinantes que não usam os benefícios — são os que mais cancelam.'
WHERE title = 'Como funcionam usos de assinatura';

UPDATE public.tutorials SET long_description =
'1. Abra o assinante em Assinaturas › Assinantes e clique em "Mudar plano".
2. Escolha o novo plano e veja o comparativo de valores e benefícios.
3. Upgrade: a diferença é cobrada proporcionalmente e os novos usos ficam disponíveis na hora.
4. Downgrade: passa a valer na próxima renovação, preservando o que já foi pago.
5. Usos já consumidos no ciclo atual não são devolvidos.
6. O cliente recebe a confirmação da alteração e o portal é atualizado.

Dica: registre o motivo da mudança para entender padrões de downgrade.'
WHERE title = 'Como mudar plano de um assinante';

UPDATE public.tutorials SET long_description =
'1. Em Barbeiros, abra o profissional e vá até a seção Comissão.
2. Escolha o tipo: percentual sobre o serviço ou valor fixo por atendimento.
3. É possível definir regras diferentes para serviços e para produtos vendidos.
4. Salve. A comissão passa a ser calculada automaticamente em cada atendimento concluído.
5. Confira o resultado em Comissões, com o detalhamento por atendimento.

Atenção: alterações valem para novos atendimentos; lançamentos anteriores mantêm a regra vigente na época.'
WHERE title = 'Como configurar comissão do barbeiro';

UPDATE public.tutorials SET long_description =
'1. Acesse Comissões e filtre por profissional e período.
2. Confira os atendimentos concluídos e o total pendente.
3. Clique em "Pagar comissão", revise o valor e escolha a forma de pagamento.
4. Confirme: a comissão muda de pendente para paga e gera a saída no financeiro.
5. O comprovante fica no histórico e o profissional vê a baixa no painel dele.

Dica: pague sempre no mesmo dia da semana para criar previsibilidade com a equipe.'
WHERE title = 'Como pagar comissão ao barbeiro';

UPDATE public.tutorials SET long_description =
'1. O profissional acessa a área /sua-barbearia/profissional com o login dele.
2. Na tela inicial vê a agenda do dia e os próximos atendimentos.
3. Na aba de comissões, acompanha o total gerado, o que já foi pago e o que está pendente.
4. Cada linha mostra o atendimento, o valor do serviço e a comissão correspondente.
5. Gorjetas recebidas via PIX aparecem separadas do valor de comissão.

Dica: transparência de comissão reduz conferência manual e conflitos no fim do mês.'
WHERE title = 'Como o barbeiro acompanha sua comissão';

UPDATE public.tutorials SET long_description =
'1. Vá em Configurações › Módulos.
2. A lista mostra todos os módulos do sistema (agenda, financeiro, fidelidade, assinaturas, produtos, tutoriais e outros).
3. Ative apenas o que a sua operação usa — os itens desativados somem do menu e do site público.
4. Módulos que não fazem parte do seu plano aparecem bloqueados, com opção de contratar como add-on.
5. Salve. A mudança é aplicada imediatamente para todos os usuários da barbearia.

Dica: menos módulos ativos = painel mais simples para a equipe.'
WHERE title = 'Como ativar ou desativar módulos';

UPDATE public.tutorials SET long_description =
'1. Acesse Configurações › Aparência.
2. Envie o logo e a imagem de capa da barbearia (use imagens em alta resolução).
3. Escolha a cor principal e o tema — a mudança reflete no painel e na página pública.
4. Ajuste textos de apresentação, especialistas, galeria de fotos e depoimentos.
5. Use o botão "Abrir página" para visualizar o resultado real antes de divulgar.

Dica: mantenha a mesma identidade visual das redes sociais para reforçar a marca.'
WHERE title = 'Como personalizar aparência';

UPDATE public.tutorials SET long_description =
'1. Em Configurações › LGPD, revise os textos de Termos de Uso, Política de Privacidade e Cookies.
2. Informe o contato do responsável pelo tratamento de dados.
3. Ative o banner de cookies exibido no site público.
4. Use as ferramentas de exportação e exclusão de dados quando um cliente solicitar.
5. Todas as solicitações ficam registradas com data e responsável, servindo como evidência de conformidade.

Atenção: mantenha os documentos atualizados sempre que mudar formas de coleta ou uso de dados.'
WHERE title = 'Como configurar LGPD e privacidade';

UPDATE public.tutorials SET long_description =
'1. O widget de acessibilidade fica disponível no painel e no site público.
2. Ele permite aumentar a fonte, ativar alto contraste, reduzir animações e destacar links.
3. As preferências ficam salvas no dispositivo do usuário.
4. A navegação por teclado e o atalho "pular para o conteúdo" funcionam em todas as páginas.
5. Recomendamos manter o recurso ativo — além de inclusivo, é exigência de acessibilidade digital.'
WHERE title = 'Como configurar acessibilidade';

UPDATE public.tutorials SET long_description =
'1. Em Fidelidade, ative o programa tradicional de carimbos/pontos.
2. Defina quantos atendimentos são necessários para gerar a recompensa.
3. Escolha o prêmio: serviço grátis, desconto ou produto.
4. Os pontos são creditados automaticamente a cada atendimento concluído.
5. O cliente acompanha o progresso no portal e recebe aviso no WhatsApp ao completar o cartão.
6. No resgate, o benefício é aplicado no fechamento do atendimento.

Dica: metas entre 5 e 10 atendimentos mantêm o programa atrativo sem virar prejuízo.'
WHERE title = 'Como ativar fidelidade tradicional';

UPDATE public.tutorials SET long_description =
'1. Em Fidelidade, escolha o modelo Cashback.
2. Defina o percentual devolvido por atendimento e o prazo de validade do saldo.
3. Configure o valor mínimo para uso do saldo.
4. O crédito entra na conta do cliente assim que o atendimento é concluído e pago.
5. No próximo atendimento, o saldo pode ser abatido no fechamento.
6. O financeiro registra o cashback como desconto, mantendo o faturamento correto.

Dica: cashback funciona melhor que desconto imediato porque garante o retorno do cliente.'
WHERE title = 'Como ativar cashback';

UPDATE public.tutorials SET long_description =
'1. Acesse Fidelidade › Templates.
2. Escolha um template pronto (retorno, aniversário, cliente inativo, indicação, VIP).
3. Visualize o preview com as regras, o gatilho e a mensagem sugerida.
4. Ajuste valores, prazos e texto ao seu contexto.
5. Ative o template — as automações passam a rodar sozinhas.
6. Acompanhe os resultados no painel de fidelidade.

Dica: ative um template por vez e meça o retorno antes de acumular campanhas.'
WHERE title = 'Como usar templates premium de fidelidade';

UPDATE public.tutorials SET long_description =
'1. Assinantes podem acumular fidelidade junto com os benefícios do plano, se você permitir.
2. Em Fidelidade, defina se os atendimentos cobertos pelo plano geram pontos ou cashback.
3. O comum é dar pontos apenas em serviços pagos à parte, evitando benefício em dobro.
4. Benefícios exclusivos do clube (prioridade, descontos em produtos) aparecem no portal do assinante.
5. Todas as regras ficam visíveis para o cliente, evitando dúvidas no balcão.'
WHERE title = 'Como funciona fidelidade para assinantes';

UPDATE public.tutorials SET long_description =
'1. Em Configurações › Pagamentos, ative o PIX.
2. Informe a chave PIX da barbearia (CNPJ, telefone, e-mail ou aleatória) e o nome do recebedor.
3. Opcionalmente, envie a imagem do QR Code estático.
4. Salve e faça um teste com valor baixo para validar o recebimento.
5. O PIX passa a aparecer como forma de pagamento no fechamento do atendimento e na loja pública.
6. Para gorjetas, cada profissional pode cadastrar a própria chave PIX no cadastro dele.

Atenção: confira a chave com atenção — pagamentos vão direto para a conta informada.'
WHERE title = 'Como configurar PIX';

UPDATE public.tutorials SET long_description =
'1. No fechamento do atendimento, escolha "Pagamento misto".
2. Adicione quantas formas forem necessárias (dinheiro, PIX, débito, crédito, saldo, cupom).
3. O sistema valida se a soma das partes fecha com o total do atendimento.
4. Cada parte é registrada separadamente no financeiro, permitindo conciliação por método.
5. Comissões e cashback são calculados sobre o valor total, não por forma de pagamento.

Dica: use os relatórios por método para negociar taxas com a maquininha.'
WHERE title = 'Como funcionam pagamentos mistos';

UPDATE public.tutorials SET long_description =
'1. Em Financeiro, filtre os lançamentos por tipo Estorno.
2. Cada estorno mostra o atendimento de origem, o motivo e a data.
3. Estornos reduzem o faturamento do período e ajustam a comissão vinculada.
4. Em assinaturas, o estorno pode devolver o uso ao saldo do cliente.
5. Exporte o relatório para conciliar com o extrato do gateway ou da maquininha.

Dica: registre sempre o motivo — é o dado que revela problemas recorrentes de atendimento.'
WHERE title = 'Como acompanhar estornos';

UPDATE public.tutorials SET long_description =
'1. Em Produtos, clique em "Novo produto".
2. Informe nome, descrição, foto, preço de venda e custo (usado na margem).
3. Defina o estoque inicial e o estoque mínimo para alerta.
4. Marque se o produto deve aparecer na loja pública.
5. Salve. O produto fica disponível na comanda, na venda avulsa e na loja online.

Dica: cadastre o custo corretamente — sem ele o relatório de margem fica distorcido.'
WHERE title = 'Como cadastrar produtos';

UPDATE public.tutorials SET long_description =
'1. Marque o produto como visível na loja pública.
2. O cliente escolhe o produto na página da barbearia e clica em comprar.
3. Ele se identifica com nome e telefone (o cadastro é criado ou reaproveitado automaticamente).
4. O pagamento é feito via PIX ou pelo gateway configurado.
5. A venda entra no financeiro e o estoque é baixado.
6. A barbearia recebe a notificação do pedido e combina a retirada.

Dica: produtos com foto boa e preço visível vendem muito mais.'
WHERE title = 'Como vender produtos no frontend';

UPDATE public.tutorials SET long_description =
'1. O estoque é baixado automaticamente em toda venda (comanda, balcão ou loja pública).
2. Em Produtos, use "Ajustar estoque" para entradas de compra, perdas e correções de inventário.
3. Cada movimentação fica registrada com data, tipo e responsável.
4. Produtos abaixo do estoque mínimo recebem alerta no painel.
5. Use o relatório de giro para identificar o que vende e o que está parado.

Dica: faça inventário mensal e ajuste divergências para manter a margem confiável.'
WHERE title = 'Como controlar estoque';

UPDATE public.tutorials SET long_description =
'1. Acesse Suporte e clique em "Abrir chamado".
2. Escolha o tipo (erro, dúvida, financeiro ou sugestão) e a prioridade.
3. Descreva o problema com detalhes: o que você fez, o que esperava e o que aconteceu.
4. Anexe prints ou o link da tela — isso acelera bastante a análise.
5. Envie. Você recebe o número do chamado e acompanha as respostas na mesma página.

Dica: um chamado por assunto facilita o acompanhamento e a resolução.'
WHERE title = 'Como abrir chamado de suporte';

UPDATE public.tutorials SET long_description =
'1. Em Suporte, veja a lista com todos os seus chamados e o status de cada um.
2. Aberto: aguardando análise. Em andamento: já com a equipe. Resolvido: concluído.
3. Clique no chamado para ler as respostas e enviar novas mensagens ou anexos.
4. Você é avisado a cada resposta da equipe.
5. Confirme a solução antes de encerrar — chamados resolvidos ficam no histórico para consulta.'
WHERE title = 'Como acompanhar chamados';

UPDATE public.tutorials SET long_description =
'1. Acesse Tutoriais pelo menu lateral do painel.
2. Use a busca ou os filtros por categoria para achar o assunto.
3. Os cards em Destaque trazem os conteúdos essenciais para começar.
4. Cada tutorial abre com descrição, passo a passo, tempo estimado e nível.
5. No celular, navegue pelas abas por tema.
6. Não achou o que precisa? Abra uma sugestão em Suporte pedindo o tutorial.'
WHERE title = 'Como acessar tutoriais e ajuda';

UPDATE public.tutorials SET long_description =
'1. Crie a conta na Z-API e gere uma instância dedicada à barbearia.
2. Copie Instance ID, Token e Client-Token.
3. Em Integrações › WhatsApp, cole as três credenciais e salve.
4. Leia o QR Code com o celular que será o número oficial da barbearia.
5. Configure a URL de webhook indicada na tela para receber as respostas dos clientes.
6. Envie uma mensagem de teste para validar a conexão.

Atenção: use um número exclusivo do negócio e evite desconectar o aparelho.'
WHERE title = 'Como configurar Z-API';

UPDATE public.tutorials SET long_description =
'1. Em Integrações › WhatsApp, clique em "Testar conexão".
2. O sistema verifica as credenciais e o status da instância (conectado / desconectado).
3. Envie uma mensagem de teste para o seu próprio número.
4. Se falhar, confira: instância conectada, credenciais corretas e webhook configurado.
5. Consulte o log de mensagens para ver o retorno exato do erro.

Dica: teste sempre depois de trocar o celular ou reiniciar a instância.'
WHERE title = 'Como testar conexão do WhatsApp';

UPDATE public.tutorials SET long_description =
'1. Em Automações você vê todos os eventos do sistema: novo agendamento, confirmação, lembrete, conclusão, cancelamento, reagendamento, aniversário, avaliação e outros.
2. Cada automação tem um gatilho, um destinatário (cliente, profissional ou equipe interna) e um modelo de mensagem.
3. Use variáveis como {customer_name}, {barbershop_name}, {service_name}, {date} e {time} para personalizar o texto.
4. Ative ou desative cada automação individualmente e defina atrasos (ex.: avaliação 15 minutos após a conclusão).
5. Use "Diagnosticar último" para ver o que foi enviado, para quem e o retorno do WhatsApp.
6. Mensagens duplicadas são bloqueadas automaticamente pelo controle de deduplicação.

Dica: revise os textos com a voz da sua marca — isso muda a percepção do cliente.'
WHERE title = 'Como funcionam as automações';
