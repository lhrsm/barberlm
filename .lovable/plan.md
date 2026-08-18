# BARBEX — AUDITORIA E CORREÇÃO PONTA A PONTA
# DASHBOARD ADMIN + BOOKING + PORTAL DO CLIENTE + PERSISTÊNCIA DO AGENDAMENTO

Este plano aborda a correção integral do fluxo, desde o Dashboard Administrativo até o Portal do Cliente, garantindo a persistência correta dos agendamentos e a identidade visual premium.

## Problemas Identificados

1.  **Dashboard Administrativo Preto**: O shell carrega, mas o conteúdo principal desaparece após o carregamento inicial. Provável causa: filtros de `tenant_id` ou `loading` no `AdminDashboardView` ou subcomponentes retornando `null`.
2.  **Estilo do Cliente Reconhecido**: O feedback visual de cliente encontrado no booking perdeu o padrão premium (card verde).
3.  **Roteamento do Portal do Cliente**: A rota `/$slug/portal` está renderizando a landing page `/$slug` em vez do portal, e o login de cliente ainda depende de `/auth?tab=client`.
4.  **Persistência e Visibilidade de Agendamentos**: Agendamentos feitos não aparecem no portal do cliente, indicando falha no vínculo de `customer_id` ou nas queries de busca.

## Ações Técnicas

### 1. Dashboard Admin
- Auditar `src/routes/dashboard.index.tsx` e `src/components/dashboard/views/AdminDashboardView.tsx`.
- Substituir retornos `null` por skeletons ou estados de erro explícitos.
- Validar as queries de `stats` e `todayAppointments` para garantir que `tenant_id` está presente e as tabelas estão sendo consultadas corretamente.

### 2. Booking (Cliente Reconhecido)
- Criar/Restaurar `src/components/public/booking/BookingConfirmationCard.tsx` com o estilo Gold Premium (verde suave, borda verde, ícone check).
- Integrar este card em `src/routes/$slug.tsx` para substituir a exibição simples do nome.
- Garantir que o nome exibido venha estritamente da busca atual (`tenant_id` + `phone`).

### 3. Portal do Cliente & Roteamento
- Corrigir a hierarquia de rotas em `src/routes/$slug.tsx` para garantir que `/$slug/portal` (definido em `src/routes/$slug.portal.tsx`) renderize seu próprio conteúdo e não a landing pai.
- Implementar o fluxo de login em `/$slug/portal` quando não houver sessão, usando o `ClientLoginForm`.
- Redirecionar agendamentos concluídos para `/$slug/portal`.

### 4. Persistência e Queries
- Auditar a função `triggerAutomation` e o processo de criação de agendamentos no frontend para garantir que `customer_id` (não `auth_user_id`) seja salvo.
- Revisar a query de agendamentos em `src/routes/$slug.portal.tsx` para buscar por `customer_id` vinculado ao perfil logado.

## Resumo de Arquitetura Final

- **Público**: `/$slug` (Landing + Booking).
- **Portal/Login Cliente**: `/$slug/portal` (Substitui `/auth?tab=client`).
- **Login Admin**: `/auth`.
- **Painel Admin**: `/dashboard` (Funcional e populado).

---
*Nenhuma alteração destrutiva em bancos de dados, chaves de API ou segredos de autenticação será realizada.*
