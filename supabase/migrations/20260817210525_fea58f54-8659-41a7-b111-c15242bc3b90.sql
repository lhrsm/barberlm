-- REPARAR CLIENTE 2 (Carlos Menezes)
-- Remover vínculo incorreto que aponta para o ID do administrador
UPDATE public.customers 
SET user_id = NULL, auth_migration_status = 'legacy' 
WHERE id = 'a43d0f80-7cc0-4d2d-b89e-d50a8d7c9aa6' 
AND user_id = 'c54ac1ac-49be-4505-b7a4-d257ed023f08';

-- BLINDAGEM ADICIONAL: Limpar quaisquer outros customers que apontem para donos de tenants
-- (Somente para os IDs que identifiquei na auditoria para ser seguro e controlado conforme pedido)
UPDATE public.customers
SET user_id = NULL, auth_migration_status = 'legacy'
WHERE user_id = 'c54ac1ac-49be-4505-b7a4-d257ed023f08'
AND id != 'a43d0f80-7cc0-4d2d-b89e-d50a8d7c9aa6'; -- redundante mas seguro
