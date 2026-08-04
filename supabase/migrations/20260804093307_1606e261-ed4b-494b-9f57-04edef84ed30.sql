-- Seed Academy Paths
INSERT INTO public.academy_paths (name, description, icon, profile_target, status, "order", duration, difficulty, level)
VALUES 
('Trilha do Administrador', 'Domine todas as ferramentas de gestão do Barbex.', 'Shield', 'admin', 'published', 1, '10h', 'Intermediário', 'Profissional'),
('Trilha da Recepção', 'Aprenda a operar a recepção com máxima eficiência.', 'Headset', 'reception', 'published', 2, '5h', 'Básico', 'Operacional'),
('Trilha do Profissional', 'Gerencie sua agenda, comissões e avaliações.', 'Scissors', 'barber', 'published', 3, '4h', 'Básico', 'Profissional'),
('Trilha do Financeiro', 'Gestão avançada de caixa, DRE e conciliação.', 'DollarSign', 'admin', 'published', 4, '8h', 'Avançado', 'Especialista');

-- Seed Modules for Administrator Path
WITH path_id AS (SELECT id FROM public.academy_paths WHERE name = 'Trilha do Administrador' LIMIT 1)
INSERT INTO public.academy_modules (path_id, name, "order")
VALUES 
((SELECT id FROM path_id), 'Conhecendo o Barbex', 1),
((SELECT id FROM path_id), 'Configurando a barbearia', 2),
((SELECT id FROM path_id), 'Serviços e profissionais', 3),
((SELECT id FROM path_id), 'Agenda', 4),
((SELECT id FROM path_id), 'Clientes e CRM', 5);

-- Seed Modules for Reception Path
WITH path_id AS (SELECT id FROM public.academy_paths WHERE name = 'Trilha da Recepção' LIMIT 1)
INSERT INTO public.academy_modules (path_id, name, "order")
VALUES 
((SELECT id FROM path_id), 'Central da Recepção', 1),
((SELECT id FROM path_id), 'Agenda do dia', 2),
((SELECT id FROM path_id), 'Cadastro de cliente', 3);

-- Seed a sample lesson for 'Conhecendo o Barbex'
WITH module_id AS (SELECT id FROM public.academy_modules WHERE name = 'Conhecendo o Barbex' LIMIT 1)
INSERT INTO public.academy_lessons (module_id, title, summary, content, duration, "order")
VALUES 
((SELECT id FROM module_id), 'Visão Geral do Sistema', 'Uma introdução completa à interface do Barbex.', 'Nesta aula você aprenderá como navegar pelo painel administrativo...', '15 min', 1);
