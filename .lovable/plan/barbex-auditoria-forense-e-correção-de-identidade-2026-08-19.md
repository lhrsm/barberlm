# Barbex: Auditoria Forense e Correção de Identidade

Este plano visa resolver a causa raiz da falha de reconhecimento de perfis no Portal do Cliente e o loading infinito no Dashboard, baseando-se em diagnósticos reais realizados via browser.

## Diagnóstico Real (Evidências)

- **Portal do Cliente**: Mesmo com `session` ativa e `profile` carregado, o sistema falha em encontrar o registro na tabela `customers` porque a RLS está bloqueando a leitura ou o `user_id` no banco não corresponde ao `auth.uid()` em tempo de execução.
- **Dashboard Admin**: Preso em loading porque `useTenant` falha em resolver o `tenantId` para administradores que não possuem `membership` explícito ou cujo `profile.tenant_id` é nulo.
- **Identidade Híbrida**: O sistema tenta ler o Portal usando `auth.uid()`, mas administradores que são donos de barbearia (como o Louis) não possuem obrigatoriamente um registro em `customers` para sua própria barbearia, causando o erro "Perfil não encontrado" se tentarem acessar `/portal`.

## Ações Propostas

### 1. Correção de RLS e Acesso (Banco de Dados)
- Atualizar a política `Users can view their own customers` para garantir que o usuário autenticado possa ver seu próprio registro em `customers` independente de filtros adicionais.
- Adicionar uma política que permita que usuários vejam seus próprios agendamentos baseando-se no vínculo `customers.user_id = auth.uid()`.

### 2. Estabilização do Portal do Cliente (`src/routes/$slug.portal.tsx`)
- Implementar uma busca de "fallback" por telefone caso a busca por `user_id` falhe (para casos de migração ou inconsistência de auth).
- Remover o timeout de 8s e substituir por um tratamento de erro explícito com botão de retry que realmente limpa o cache.

### 3. Resiliência do Dashboard (`src/routes/dashboard.index.tsx` & `src/hooks/use-tenant.ts`)
- Ajustar `useTenant` para garantir que `owner_id` da barbearia seja usado como fallback prioritário para administradores.
- No Dashboard, garantir que falhas em queries secundárias (analytics) não travem o carregamento dos agendamentos principais.

### 4. Validação Forense Final
- Realizar teste real com janela anônima para cliente e admin, capturando logs `[PORTAL_RESOLUTION_FORENSIC]` e `[DASHBOARD_BOOT_FORENSIC]`.

## Detalhes Técnicos

- Tabela `customers`: Coluna de vínculo é `user_id`.
- Tabela `appointments`: Colunas de vínculo são `customer_id` (vínculo de negócio) e `user_id` (vínculo de auth).
- RLS Policy `customers`: `using ((auth.uid() = user_id))` deve ser absoluta para o comando SELECT do próprio usuário.
