# Plano de Implementação: Módulo de Fidelização Gamificada (Loyalty Premium)

Este plano detalha a implementação do sistema de fidelização gamificada no Barbex, elevando a retenção de clientes através de níveis, conquistas e recompensas exclusivas, mantendo o padrão Gold Premium.

## 1. Expansão da Camada de Dados
- Criar a tabela `loyalty_levels` para definir a progressão (Bronze, Silver, Gold, Platinum, Diamond).
- Criar a tabela `loyalty_achievements` para desafios específicos (ex: "Madrugador", "Cliente Fiel", "Influenciador").
- Criar a tabela `customer_achievements` para rastrear o progresso individual.
- Adicionar colunas de experiência (XP) e nível atual na tabela `customers` (ou perfil estendido).

## 2. Lógica de Gamificação (Server-Side)
- Implementar `loyalty-gamification.functions.ts` para processar ganho de XP em eventos (agendamento concluído, compra de produto, indicação).
- Criar triggers no banco de dados para automação de desbloqueio de conquistas.

## 3. Interface do Cliente (Portal do Cliente)
- **Dashboard de Nível:** Barra de progresso visual com estilo Gold Premium.
- **Lista de Conquistas:** Galeria de medalhas e troféus desbloqueáveis.
- **Histórico de XP:** Extrato detalhado de como o cliente ganhou seus pontos.

## 4. Interface Administrativa (Painel do Barbeiro)
- **Loyalty Level Viewer:** Visualização clara do status do cliente durante o atendimento.
- **Configurador de Gamificação:** Painel para o dono da barbearia ajustar XP por serviço e recompensas de nível.

## Detalhes Técnicos
- Uso de `framer-motion` para animações de subida de nível e desbloqueio de medalhas.
- Integração com o sistema de WhatsApp (Z-API) para enviar notificações automáticas quando um cliente sobe de nível ("Parabéns! Você agora é um Cliente Diamond 💎").
- RLS rigoroso para garantir que clientes só vejam seus próprios dados de fidelidade.

---
**Próximo Passo:** Após aprovação, iniciarei a criação das migrações de banco de dados e dos componentes de UI da barra de progresso.
